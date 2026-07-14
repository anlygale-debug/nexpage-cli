export function extractFonts({ fontFaces = [], googleFontsLinks = [], documentFonts = [] }) {
  const fontMap = new Map();

  // Parse Google Fonts URLs into a lookup: family -> weights
  const googleFamilies = new Map();
  for (const url of googleFontsLinks) {
    const params = new URL(url).searchParams;
    for (const val of (params.getAll('family'))) {
      const [name, spec] = val.split(':');
      const family = name.replace(/\+/g, ' ');
      const weights = spec?.match(/\d{3}/g) || ['400'];
      googleFamilies.set(family, [...new Set([...(googleFamilies.get(family) || []), ...weights])]);
    }
  }

  const getSource = (family, src) => {
    if (googleFamilies.has(family)) return 'google-fonts';
    if (src && /url\(/.test(src)) return /fonts\.(googleapis|gstatic|cdnfonts|bunny)/.test(src) ? 'cdn' : 'self-hosted';
    return 'system';
  };

  const getOrCreate = (family) => {
    if (!fontMap.has(family)) {
      fontMap.set(family, { family, source: 'system', weights: new Set(), styles: new Set(), urls: [], fontFaceCSS: '' });
    }
    return fontMap.get(family);
  };

  // Process @font-face rules
  for (const ff of fontFaces) {
    const family = ff.family?.replace(/["']/g, '');
    if (!family) continue;
    const entry = getOrCreate(family);
    entry.source = getSource(family, ff.src);
    if (ff.weight) entry.weights.add(String(ff.weight));
    if (ff.style) entry.styles.add(ff.style);
    if (ff.src) entry.urls.push(ff.src);
  }

  // Process document.fonts entries
  for (const df of documentFonts) {
    const family = df.family?.replace(/["']/g, '');
    if (!family) continue;
    const entry = getOrCreate(family);
    if (entry.source === 'system') entry.source = getSource(family, '');
    if (df.weight) entry.weights.add(String(df.weight));
    if (df.style) entry.styles.add(df.style);
  }

  // Add Google Fonts families not yet seen
  for (const [family, weights] of googleFamilies) {
    const entry = getOrCreate(family);
    entry.source = 'google-fonts';
    for (const w of weights) entry.weights.add(w);
  }

  // Build output
  const fonts = [];
  const systemFonts = [];

  for (const entry of fontMap.values()) {
    const weights = [...entry.weights].sort();
    const styles = [...entry.styles];
    if (!weights.length) weights.push('400');
    if (!styles.length) styles.push('normal');

    const fontFaceCSS = entry.source === 'self-hosted'
      ? entry.urls.map((src, i) =>
        `@font-face {\n  font-family: '${entry.family}';\n  font-weight: ${weights[i] || weights[0]};\n  font-style: ${styles[i] || styles[0]};\n  src: ${src};\n}`
      ).join('\n\n')
      : '';

    if (entry.source === 'system') { systemFonts.push(entry.family); continue; }
    fonts.push({ family: entry.family, source: entry.source, weights, styles, urls: entry.urls, fontFaceCSS });
  }

  const googleFontsUrl = googleFontsLinks[0] || (googleFamilies.size
    ? `https://fonts.googleapis.com/css2?${[...googleFamilies].map(([f, w]) => `family=${f.replace(/ /g, '+')}:wght@${w.join(';')}`).join('&')}&display=swap`
    : '');

  return { fonts, googleFontsUrl, systemFonts };
}
