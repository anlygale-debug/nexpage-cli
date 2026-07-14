// Framework-specific theme generators

export function formatReactTheme(design) {
  const { colors, typography, spacing, shadows, borders } = design;

  const theme = {};

  // Colors
  theme.colors = {};
  if (colors.primary) theme.colors.primary = colors.primary.hex;
  if (colors.secondary) theme.colors.secondary = colors.secondary.hex;
  if (colors.accent) theme.colors.accent = colors.accent.hex;
  if (colors.backgrounds.length) theme.colors.background = colors.backgrounds[0];
  if (colors.text.length) theme.colors.foreground = colors.text[0];
  for (let i = 0; i < colors.neutrals.length && i < 10; i++) {
    theme.colors[`neutral${i * 100 || 50}`] = colors.neutrals[i].hex;
  }

  // Typography
  theme.fonts = {};
  for (const f of typography.families) {
    const key = f.name.toLowerCase().includes('mono') ? 'mono' : f.usage === 'headings' ? 'heading' : 'body';
    theme.fonts[key] = `'${f.name}', ${f.name.toLowerCase().includes('mono') ? 'monospace' : 'sans-serif'}`;
  }

  theme.fontSizes = {};
  for (const s of typography.scale.slice(0, 12)) {
    theme.fontSizes[s.size] = `${s.size}px`;
  }

  // Spacing
  theme.space = {};
  for (const v of spacing.scale.slice(0, 16)) {
    theme.space[v] = `${v}px`;
  }

  // Radii
  theme.radii = {};
  for (const r of borders.radii) {
    theme.radii[r.label] = `${r.value}px`;
  }

  // Shadows
  theme.shadows = {};
  for (const s of shadows.values) {
    theme.shadows[s.label] = s.raw;
  }

  // Component variant tokens for interactive states
  theme.states = {
    hover: { opacity: 0.08 },
    focus: { opacity: 0.12 },
    active: { opacity: 0.16 },
    disabled: { opacity: 0.38 },
  };

  // Build MUI v5 theme
  const muiTheme = buildMuiTheme(design);

  // Build TypeScript type definition comment
  const tsType = buildTypeComment(theme);

  return `// React Theme — extracted from ${design.meta.url}
// Compatible with: Chakra UI, Stitches, Vanilla Extract, or any CSS-in-JS

${tsType}

export const theme = ${JSON.stringify(theme, null, 2)};

// MUI v5 theme
export const muiTheme = ${JSON.stringify(muiTheme, null, 2)};

export default theme;
`;
}

function buildTypeComment(theme) {
  const colorKeys = Object.keys(theme.colors || {}).map(k => `    ${k}: string;`).join('\n');
  const fontKeys = Object.keys(theme.fonts || {}).map(k => `    ${k}: string;`).join('\n');
  const sizeKeys = Object.keys(theme.fontSizes || {}).map(k => `    '${k}': string;`).join('\n');
  const spaceKeys = Object.keys(theme.space || {}).map(k => `    '${k}': string;`).join('\n');
  const radiiKeys = Object.keys(theme.radii || {}).map(k => `    ${k}: string;`).join('\n');
  const shadowKeys = Object.keys(theme.shadows || {}).map(k => `    ${k}: string;`).join('\n');

  return `/**
 * TypeScript type definition for this theme:
 *
 * interface Theme {
 *   colors: {
${colorKeys}
 *   };
 *   fonts: {
${fontKeys}
 *   };
 *   fontSizes: {
${sizeKeys}
 *   };
 *   space: {
${spaceKeys}
 *   };
 *   radii: {
${radiiKeys}
 *   };
 *   shadows: {
${shadowKeys}
 *   };
 *   states: {
 *     hover: { opacity: number };
 *     focus: { opacity: number };
 *     active: { opacity: number };
 *     disabled: { opacity: number };
 *   };
 * }
 */`;
}

function buildMuiTheme(design) {
  const { colors, typography, borders, shadows } = design;
  const mui = { palette: {}, typography: {}, shape: {}, shadows: [] };

  // Palette
  if (colors.primary) {
    mui.palette.primary = { main: colors.primary.hex };
    const pHsl = toHslParts(colors.primary.hex);
    if (pHsl) {
      mui.palette.primary.light = `hsl(${pHsl.h}, ${pHsl.s}%, ${Math.min(pHsl.l + 15, 95)}%)`;
      mui.palette.primary.dark = `hsl(${pHsl.h}, ${pHsl.s}%, ${Math.max(pHsl.l - 15, 10)}%)`;
    }
  }
  if (colors.secondary) {
    mui.palette.secondary = { main: colors.secondary.hex };
    const sHsl = toHslParts(colors.secondary.hex);
    if (sHsl) {
      mui.palette.secondary.light = `hsl(${sHsl.h}, ${sHsl.s}%, ${Math.min(sHsl.l + 15, 95)}%)`;
      mui.palette.secondary.dark = `hsl(${sHsl.h}, ${sHsl.s}%, ${Math.max(sHsl.l - 15, 10)}%)`;
    }
  }
  mui.palette.background = {};
  if (colors.backgrounds.length > 0) mui.palette.background.default = colors.backgrounds[0];
  if (colors.backgrounds.length > 1) mui.palette.background.paper = colors.backgrounds[1];
  else if (colors.backgrounds.length > 0) mui.palette.background.paper = colors.backgrounds[0];
  mui.palette.text = {};
  if (colors.text.length > 0) mui.palette.text.primary = colors.text[0];
  if (colors.text.length > 1) mui.palette.text.secondary = colors.text[1];

  // Typography
  const bodyFont = typography.families.find(f => f.usage === 'body');
  const headingFont = typography.families.find(f => f.usage === 'headings');
  mui.typography.fontFamily = bodyFont ? `'${bodyFont.name}', sans-serif` : undefined;
  for (const s of typography.scale.slice(0, 6)) {
    const level = s.size >= 32 ? 'h1' : s.size >= 24 ? 'h2' : s.size >= 20 ? 'h3' : s.size >= 16 ? 'body1' : 'body2';
    mui.typography[level] = {
      fontSize: `${s.size}px`,
      fontWeight: s.weight || 400,
      lineHeight: s.lineHeight || 1.5,
    };
    if (headingFont && level.startsWith('h')) {
      mui.typography[level].fontFamily = `'${headingFont.name}', sans-serif`;
    }
  }

  // Shape
  if (borders.radii.length > 0) {
    const md = borders.radii.find(r => r.label === 'md') || borders.radii[0];
    mui.shape.borderRadius = md.value;
  }

  // Shadows (first few)
  mui.shadows = shadows.values.slice(0, 5).map(s => s.raw);

  return mui;
}

function toHslParts(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return { h: Math.round(hue * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function formatShadcnTheme(design) {
  const { colors, borders } = design;
  const lines = ['@layer base {', '  :root {'];

  // Map to shadcn/ui CSS variable naming convention
  if (colors.backgrounds.length) lines.push(`    --background: ${toHslString(colors.backgrounds[0])};`);
  if (colors.text.length) lines.push(`    --foreground: ${toHslString(colors.text[0])};`);
  if (colors.primary) {
    lines.push(`    --primary: ${toHslString(colors.primary.hex)};`);
    lines.push(`    --primary-foreground: ${isLightHex(colors.primary.hex) ? '0 0% 0%' : '0 0% 100%'};`);
  }
  if (colors.secondary) {
    lines.push(`    --secondary: ${toHslString(colors.secondary.hex)};`);
    lines.push(`    --secondary-foreground: ${isLightHex(colors.secondary.hex) ? '0 0% 0%' : '0 0% 100%'};`);
  }
  if (colors.accent) {
    lines.push(`    --accent: ${toHslString(colors.accent.hex)};`);
    lines.push(`    --accent-foreground: ${isLightHex(colors.accent.hex) ? '0 0% 0%' : '0 0% 100%'};`);
  }
  if (colors.neutrals.length > 0) {
    lines.push(`    --muted: ${toHslString(colors.neutrals[colors.neutrals.length - 1]?.hex || '#888')};`);
    lines.push(`    --muted-foreground: ${toHslString(colors.neutrals[0]?.hex || '#333')};`);
    lines.push(`    --border: ${toHslString(colors.neutrals[Math.min(4, colors.neutrals.length - 1)]?.hex || '#e5e5e5')};`);
  }
  if (borders.radii.length > 0) {
    const md = borders.radii.find(r => r.label === 'md') || borders.radii[0];
    lines.push(`    --radius: ${md.value}px;`);
  }

  lines.push('  }');

  // Dark mode
  if (design.darkMode) {
    lines.push('  .dark {');
    const dc = design.darkMode.colors;
    if (dc.backgrounds.length) lines.push(`    --background: ${toHslString(dc.backgrounds[0])};`);
    if (dc.text.length) lines.push(`    --foreground: ${toHslString(dc.text[0])};`);
    if (dc.primary) lines.push(`    --primary: ${toHslString(dc.primary.hex)};`);
    lines.push('  }');
  }

  lines.push('}');

  return `/* shadcn/ui Theme — extracted from ${design.meta.url} */\n/* Paste into your globals.css */\n\n${lines.join('\n')}\n`;
}

function toHslString(hex) {
  if (!hex) return '0 0% 0%';
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return `${Math.round(hue * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function isLightHex(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
}
