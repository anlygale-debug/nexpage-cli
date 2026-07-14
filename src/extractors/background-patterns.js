// v10.4 — Background Patterns
//
// Classifies the visual backgrounds on a site from computed-style evidence:
// noise (repeated grain PNG/SVG), dot-grid, line-grid, gradient-mesh (multiple
// radial gradients), chequer, diagonal stripes, SVG patterns, or plain.
//
// Pure function — reads `rawData.light.computedStyles`, which every extractor
// already has access to, plus the `modernColors` and any collected svgs.

// All pattern detectors operate on a length-capped string. Adversarial CSS
// background-image values (data URIs in particular) can run several KB; cap
// to 4KB so the regexes can never run quadratic over megabyte payloads.
const MAX_BG_LEN = 4096;
function cap(s) {
  return typeof s === 'string' ? s.slice(0, MAX_BG_LEN) : '';
}

function looksLikeDotGrid(image) {
  const s = cap(image);
  // Bounded inner content (.{0,256}) instead of unbounded .* — no nested quantifier risk.
  return /radial-gradient\([^)]{0,256}\)/i.test(s) && /repeat/i.test(s) && /\d{1,4}px\s{0,4}\d{1,4}px/.test(s);
}

function looksLikeLineGrid(image) {
  // repeating-linear-gradient with a narrow colored band.
  return /repeating-linear-gradient/i.test(cap(image));
}

function looksLikeNoise(image) {
  const s = cap(image);
  // Bounded character class instead of .+ — `.+` could backtrack on long data URIs.
  return /feTurbulence|data:image\/svg[^"']{0,2048}fractalNoise/i.test(s) || /noise\.(png|svg|webp)/i.test(s);
}

function countRadialGradients(image) {
  return (image.match(/radial-gradient\(/gi) || []).length;
}

function countLinearGradients(image) {
  return (image.match(/linear-gradient\(/gi) || []).length;
}

function detectSvgPattern(image) {
  return /url\("data:image\/svg/i.test(image) && !looksLikeNoise(image);
}

export function extractBackgroundPatterns(rawData = {}) {
  const styles = (rawData.light?.computedStyles) || [];
  let dotGrid = 0, lineGrid = 0, noise = 0, svgPattern = 0, radialSum = 0, linearSum = 0, meshCount = 0, plain = 0;
  const samples = [];

  for (const s of styles) {
    const bg = s.backgroundImage || s['background-image'] || '';
    if (!bg || bg === 'none') { plain++; continue; }
    const radial = countRadialGradients(bg);
    const linear = countLinearGradients(bg);
    radialSum += radial;
    linearSum += linear;
    let tag = null;
    if (looksLikeNoise(bg)) { noise++; tag = 'noise'; }
    else if (looksLikeDotGrid(bg)) { dotGrid++; tag = 'dot-grid'; }
    else if (looksLikeLineGrid(bg)) { lineGrid++; tag = 'line-grid'; }
    else if (radial >= 2) { meshCount++; tag = 'gradient-mesh'; }
    else if (detectSvgPattern(bg)) { svgPattern++; tag = 'svg-pattern'; }
    if (tag && samples.length < 8) samples.push({ tag, value: bg.slice(0, 200) });
  }

  const total = styles.length || 1;
  const labels = [];
  if (noise / total > 0.002) labels.push('noise');
  if (dotGrid / total > 0.002) labels.push('dot-grid');
  if (lineGrid / total > 0.002) labels.push('line-grid');
  if (meshCount > 0) labels.push('gradient-mesh');
  if (svgPattern > 0) labels.push('svg-pattern');
  if (!labels.length) labels.push('plain');

  return {
    labels,
    counts: { noise, dotGrid, lineGrid, meshCount, svgPattern },
    gradientTotals: { radial: radialSum, linear: linearSum },
    samples,
  };
}
