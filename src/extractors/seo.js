// v10.3 — SEO & Structured Data
//
// Pure extractor — operates on the metas + scripts the crawler already
// collected. Captures Open Graph, Twitter cards, canonical, manifest, theme
// color, and every inline JSON-LD block (schema.org structured data).

function pickMeta(metas, name) {
  const m = metas.find(m => (m.name || '').toLowerCase() === name.toLowerCase());
  return m ? m.content : null;
}

function jsonLdFromScripts(rawScripts = []) {
  // rawScripts here may be just URLs. For JSON-LD we need inline script text,
  // which the crawler doesn't currently capture. Accept an optional `inline`
  // parameter from a richer payload where available.
  return [];
}

export function extractSeo(rawData = {}) {
  const stack = rawData.light?.stack || {};
  const metas = stack.metas || [];
  const openGraph = {};
  const twitter = {};
  for (const m of metas) {
    const name = (m.name || '').toLowerCase();
    if (name.startsWith('og:')) openGraph[name.slice(3)] = m.content;
    else if (name.startsWith('twitter:')) twitter[name.slice(8)] = m.content;
  }
  const description = pickMeta(metas, 'description');
  const canonical = pickMeta(metas, 'canonical');
  const themeColor = pickMeta(metas, 'theme-color');
  const viewport = pickMeta(metas, 'viewport');

  const inlineJsonLd = Array.isArray(rawData.light?.jsonLd) ? rawData.light.jsonLd : [];
  const favicons = rawData.light?.favicons || [];
  const manifest = rawData.light?.manifest || null;

  const structured = [];
  for (const block of inlineJsonLd) {
    try {
      const parsed = typeof block === 'string' ? JSON.parse(block) : block;
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const e of entries) {
        structured.push({ type: e['@type'] || 'Thing', name: e.name || e.headline || null, sample: JSON.stringify(e).slice(0, 400) });
      }
    } catch { /* skip bad JSON-LD */ }
  }

  return {
    openGraph,
    twitter,
    description,
    canonical,
    themeColor,
    viewport,
    favicons,
    manifest,
    structuredData: structured,
    score: {
      hasOg: Object.keys(openGraph).length > 0,
      hasTwitter: Object.keys(twitter).length > 0,
      hasDescription: !!description,
      hasCanonical: !!canonical,
      hasStructuredData: structured.length > 0,
      hasFavicon: favicons.length > 0,
      hasThemeColor: !!themeColor,
    },
  };
}
