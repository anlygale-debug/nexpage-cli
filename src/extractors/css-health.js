// CSS health audit — operates on page.coverage.stopCSSCoverage() output
// serialized as [{ url, text, totalBytes, ranges:[{start,end}] }].

function countUsed(ranges = []) {
  let used = 0;
  for (const r of ranges) used += Math.max(0, (r.end || 0) - (r.start || 0));
  return used;
}

function countImportant(text) {
  const m = text.match(/!important/g);
  return m ? m.length : 0;
}

function countDuplicates(text) {
  // Count prop:value pairs that appear >=2x across the sheet.
  const seen = new Map();
  const re = /([\w-]+)\s*:\s*([^;{}!]+)(\s*!important)?\s*;?/g;
  for (const m of text.matchAll(re)) {
    const key = `${m[1].trim()}:${m[2].trim()}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  let dup = 0;
  for (const n of seen.values()) if (n >= 2) dup += (n - 1);
  return dup;
}

function countVendorPrefixes(text) {
  return {
    webkit: (text.match(/-webkit-/g) || []).length,
    moz: (text.match(/-moz-/g) || []).length,
    ms: (text.match(/-ms-/g) || []).length,
    o: (text.match(/(^|[^-\w])-o-/g) || []).length,
  };
}

function extractKeyframes(text) {
  const out = [];
  const re = /@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g;
  for (const m of text.matchAll(re)) {
    const body = m[2];
    const steps = (body.match(/(\d+%|from|to)\s*\{/g) || []).length;
    out.push({ name: m[1], steps });
  }
  return out;
}

function specificityFor(selector) {
  // Simple WCAG-ish triple: ids, classes+attrs+pseudo-classes, types
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]+\))?/g) || []).length;
  const types = (selector.match(/(?:^|[\s>+~,])([a-z][\w-]*)/gi) || []).length;
  return [ids, classes, types];
}

function specificityDistribution(text) {
  const triples = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  for (const m of text.matchAll(re)) {
    const selectorList = m[1];
    for (const sel of selectorList.split(',').map(s => s.trim()).filter(Boolean)) {
      if (sel.startsWith('@')) continue;
      triples.push(specificityFor(sel));
    }
  }
  if (triples.length === 0) {
    return { max: [0, 0, 0], average: [0, 0, 0], count: 0 };
  }
  let max = [0, 0, 0];
  let sum = [0, 0, 0];
  for (const t of triples) {
    for (let i = 0; i < 3; i++) {
      sum[i] += t[i];
      if (t[i] > max[i]) max[i] = t[i];
    }
  }
  const avg = sum.map(v => Math.round((v / triples.length) * 100) / 100);
  return { max, average: avg, count: triples.length };
}

export function extractCssHealth(coverage = []) {
  const sheets = [];
  let totalBytes = 0;
  let usedBytes = 0;
  let importantCount = 0;
  let duplicates = 0;
  const vendorPrefixes = { webkit: 0, moz: 0, ms: 0, o: 0 };
  const keyframes = [];
  let specMax = [0, 0, 0];
  let specSumWeighted = [0, 0, 0];
  let specCount = 0;

  for (const c of coverage) {
    const text = c.text || '';
    const sheetTotal = typeof c.totalBytes === 'number' ? c.totalBytes : text.length;
    const sheetUsed = countUsed(c.ranges);
    const sheetUnused = Math.max(0, sheetTotal - sheetUsed);
    sheets.push({
      url: c.url || '',
      totalBytes: sheetTotal,
      usedBytes: sheetUsed,
      unusedBytes: sheetUnused,
      unusedPercent: sheetTotal ? Math.round((sheetUnused / sheetTotal) * 100) : 0,
    });
    totalBytes += sheetTotal;
    usedBytes += sheetUsed;

    importantCount += countImportant(text);
    duplicates += countDuplicates(text);

    const vp = countVendorPrefixes(text);
    vendorPrefixes.webkit += vp.webkit;
    vendorPrefixes.moz += vp.moz;
    vendorPrefixes.ms += vp.ms;
    vendorPrefixes.o += vp.o;

    keyframes.push(...extractKeyframes(text));

    const spec = specificityDistribution(text);
    for (let i = 0; i < 3; i++) {
      if (spec.max[i] > specMax[i]) specMax[i] = spec.max[i];
      specSumWeighted[i] += spec.average[i] * spec.count;
    }
    specCount += spec.count;
  }

  const unusedBytes = Math.max(0, totalBytes - usedBytes);
  const unusedPercent = totalBytes ? Math.round((unusedBytes / totalBytes) * 100) : 0;
  const specAvg = specCount > 0
    ? specSumWeighted.map(v => Math.round((v / specCount) * 100) / 100)
    : [0, 0, 0];

  const issues = [];
  if (importantCount > 0) issues.push(`${importantCount} !important rule${importantCount > 1 ? 's' : ''}`);
  if (duplicates > 0) issues.push(`${duplicates} duplicate declaration${duplicates > 1 ? 's' : ''}`);
  if (unusedPercent >= 50) issues.push(`${unusedPercent}% unused CSS`);

  return {
    sheets,
    totalBytes,
    usedBytes,
    unusedBytes,
    unusedPercent,
    importantCount,
    duplicates,
    vendorPrefixes,
    keyframes,
    specificity: { max: specMax, average: specAvg, count: specCount },
    issues,
  };
}
