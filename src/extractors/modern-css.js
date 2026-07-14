// Extractor for modern CSS features captured by the crawler:
//   - Pseudo-elements (::before / ::after)
//   - Variable-font axes (font-variation-settings)
//   - OpenType features (font-feature-settings)
//   - Modern text layout (text-wrap, text-decoration-*)
//   - Container queries (@container)
//   - env() usage (safe-area-inset-*, viewport-*)

export function extractModernCss(payload) {
  const light = (payload && payload.light) || payload || {};
  const styles = Array.isArray(light.computedStyles) ? light.computedStyles : [];

  // Pseudo-elements
  const pseudoSamples = [];
  let pseudoCount = 0;
  for (const s of styles) {
    const p = s && s.pseudo;
    if (!p) continue;
    if (p.before) { pseudoCount++; if (pseudoSamples.length < 20) pseudoSamples.push({ tag: s.tag, classList: s.classList, which: '::before', style: p.before }); }
    if (p.after) { pseudoCount++; if (pseudoSamples.length < 20) pseudoSamples.push({ tag: s.tag, classList: s.classList, which: '::after', style: p.after }); }
  }

  // Variable fonts
  const axesMap = new Map();
  let variableFontCount = 0;
  for (const s of styles) {
    const v = s && s.fontVariationSettings;
    if (!v || v === 'normal' || v === '') continue;
    variableFontCount++;
    // e.g. "\"wght\" 600, \"slnt\" -4"
    for (const m of String(v).matchAll(/"([^"]+)"\s+(-?\d+(?:\.\d+)?)/g)) {
      const axis = m[1];
      const val = parseFloat(m[2]);
      if (!axesMap.has(axis)) axesMap.set(axis, { axis, min: val, max: val, count: 0 });
      const a = axesMap.get(axis);
      a.min = Math.min(a.min, val);
      a.max = Math.max(a.max, val);
      a.count++;
    }
  }

  // OpenType features
  const featMap = new Map();
  for (const s of styles) {
    const f = s && s.fontFeatureSettings;
    if (!f || f === 'normal' || f === '') continue;
    for (const m of String(f).matchAll(/"([^"]+)"(?:\s+(on|off|\d+))?/g)) {
      const key = m[1];
      featMap.set(key, (featMap.get(key) || 0) + 1);
    }
  }

  // Text-wrap / decoration
  const textWrapMap = new Map();
  const decStyleMap = new Map();
  const thicknessMap = new Map();
  const offsetMap = new Map();
  for (const s of styles) {
    if (s.textWrap && s.textWrap !== 'wrap' && s.textWrap !== '') {
      textWrapMap.set(s.textWrap, (textWrapMap.get(s.textWrap) || 0) + 1);
    }
    if (s.textDecorationStyle && s.textDecorationStyle !== 'solid' && s.textDecorationStyle !== '') {
      decStyleMap.set(s.textDecorationStyle, (decStyleMap.get(s.textDecorationStyle) || 0) + 1);
    }
    if (s.textDecorationThickness && s.textDecorationThickness !== 'auto' && s.textDecorationThickness !== '') {
      thicknessMap.set(s.textDecorationThickness, (thicknessMap.get(s.textDecorationThickness) || 0) + 1);
    }
    if (s.textUnderlineOffset && s.textUnderlineOffset !== 'auto' && s.textUnderlineOffset !== '') {
      offsetMap.set(s.textUnderlineOffset, (offsetMap.get(s.textUnderlineOffset) || 0) + 1);
    }
  }

  const containerQueries = Array.isArray(light.containerQueries) ? light.containerQueries : [];
  const envUsage = Array.isArray(light.envUsage) ? light.envUsage : [];

  return {
    pseudoElements: {
      count: pseudoCount,
      samples: pseudoSamples,
    },
    variableFonts: {
      count: variableFontCount,
      axes: [...axesMap.values()].sort((a, b) => b.count - a.count),
    },
    openTypeFeatures: [...featMap.entries()]
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count),
    textWrap: {
      wrap: [...textWrapMap.entries()].map(([value, count]) => ({ value, count })),
      decorationStyle: [...decStyleMap.entries()].map(([value, count]) => ({ value, count })),
      decorationThickness: [...thicknessMap.entries()].map(([value, count]) => ({ value, count })),
      underlineOffset: [...offsetMap.entries()].map(([value, count]) => ({ value, count })),
    },
    containerQueries: {
      count: containerQueries.length,
      rules: containerQueries,
    },
    envUsage: [...new Set(envUsage)],
  };
}
