// Figma Variables JSON format (compatible with Figma Variables import)
export function formatFigma(design) {
  const collections = [];

  // --- Brand collection (colors with light/dark modes) ---
  const brandVars = [];
  const hasDarkMode = !!design.darkMode;
  const brandModes = hasDarkMode ? ['light', 'dark'] : ['light'];

  // Brand colors
  if (design.colors.primary) {
    const v = { name: 'color/primary', type: 'COLOR', values: { light: colorVal(design.colors.primary.hex) } };
    if (hasDarkMode && design.darkMode.colors.primary) v.values.dark = colorVal(design.darkMode.colors.primary.hex);
    else if (hasDarkMode) v.values.dark = v.values.light;
    brandVars.push(v);
  }
  if (design.colors.secondary) {
    const v = { name: 'color/secondary', type: 'COLOR', values: { light: colorVal(design.colors.secondary.hex) } };
    if (hasDarkMode && design.darkMode.colors.secondary) v.values.dark = colorVal(design.darkMode.colors.secondary.hex);
    else if (hasDarkMode) v.values.dark = v.values.light;
    brandVars.push(v);
  }
  if (design.colors.accent) {
    const v = { name: 'color/accent', type: 'COLOR', values: { light: colorVal(design.colors.accent.hex) } };
    if (hasDarkMode && design.darkMode.colors.accent) v.values.dark = v.values.light;
    brandVars.push(v);
  }

  // Neutrals
  for (let i = 0; i < design.colors.neutrals.length && i < 10; i++) {
    const label = i * 100 || 50;
    const v = { name: `color/neutral/${label}`, type: 'COLOR', values: { light: colorVal(design.colors.neutrals[i].hex) } };
    if (hasDarkMode && design.darkMode.colors.neutrals[i]) v.values.dark = colorVal(design.darkMode.colors.neutrals[i].hex);
    else if (hasDarkMode) v.values.dark = v.values.light;
    brandVars.push(v);
  }

  // Semantic colors (backgrounds, text)
  for (let i = 0; i < design.colors.backgrounds.length; i++) {
    const label = i === 0 ? 'default' : `${i}`;
    const v = { name: `color/background/${label}`, type: 'COLOR', values: { light: colorVal(design.colors.backgrounds[i]) } };
    if (hasDarkMode && design.darkMode.colors.backgrounds[i]) v.values.dark = colorVal(design.darkMode.colors.backgrounds[i]);
    else if (hasDarkMode) v.values.dark = v.values.light;
    brandVars.push(v);
  }
  for (let i = 0; i < design.colors.text.length && i < 5; i++) {
    const label = i === 0 ? 'default' : `${i}`;
    const v = { name: `color/text/${label}`, type: 'COLOR', values: { light: colorVal(design.colors.text[i]) } };
    if (hasDarkMode && design.darkMode.colors.text[i]) v.values.dark = colorVal(design.darkMode.colors.text[i]);
    else if (hasDarkMode) v.values.dark = v.values.light;
    brandVars.push(v);
  }

  collections.push({ name: 'Brand', modes: brandModes, variables: brandVars });

  // --- Typography collection ---
  const typoVars = [];
  for (const s of design.typography.scale.slice(0, 12)) {
    typoVars.push({ name: `font/size/${s.size}`, type: 'FLOAT', values: { default: s.size } });
    if (s.weight) {
      typoVars.push({ name: `font/weight/${s.size}`, type: 'FLOAT', values: { default: parseInt(s.weight) || 400 } });
    }
    if (s.lineHeight && s.lineHeight !== 'normal') {
      const lh = parseFloat(s.lineHeight);
      if (!isNaN(lh)) {
        typoVars.push({ name: `font/lineHeight/${s.size}`, type: 'FLOAT', values: { default: lh } });
      }
    }
  }
  if (typoVars.length > 0) {
    collections.push({ name: 'Typography', modes: ['default'], variables: typoVars });
  }

  // --- Spacing collection ---
  const spacingVars = [];
  for (const v of design.spacing.scale.slice(0, 20)) {
    spacingVars.push({ name: `spacing/${v}`, type: 'FLOAT', values: { default: v } });
  }
  // Border radius
  for (const r of design.borders.radii) {
    spacingVars.push({ name: `radius/${r.label}`, type: 'FLOAT', values: { default: r.value } });
  }
  if (spacingVars.length > 0) {
    collections.push({ name: 'Spacing', modes: ['default'], variables: spacingVars });
  }

  return JSON.stringify({ collections }, null, 2);
}

function colorVal(hex) {
  const rgb = hexToRgb(hex);
  return { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255, a: 1 };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
