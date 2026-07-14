// nexpage badge — shields.io-style SVG badge for design score.
// Uses Verdana web-safe font + computed text width so it renders identically
// on GitHub, npm, and arbitrary markdown. No external font dependency.

const COLORS = {
  A: '#0a8a52',
  B: '#1f6feb',
  C: '#b08400',
  D: '#d2691e',
  F: '#c43d3d',
  unknown: '#555',
};

// Verdana 11px character width approximation (em units × 11). Verdana is
// chosen because it ships natively on every OS and matches shields.io's
// rendering, so widths are predictable across platforms.
const VERDANA_WIDTHS = {
  ' ': 5, '!': 5, '#': 9, '$': 7, '%': 12, '&': 9, "'": 3, '(': 5, ')': 5,
  '*': 7, '+': 7, ',': 5, '-': 5, '.': 5, '/': 5, '0': 7, '1': 7, '2': 7,
  '3': 7, '4': 7, '5': 7, '6': 7, '7': 7, '8': 7, '9': 7, ':': 5, ';': 5,
  '<': 7, '=': 7, '>': 7, '?': 7, '@': 12, 'A': 8, 'B': 8, 'C': 8, 'D': 9,
  'E': 7, 'F': 7, 'G': 9, 'H': 9, 'I': 5, 'J': 5, 'K': 8, 'L': 7, 'M': 10,
  'N': 9, 'O': 9, 'P': 7, 'Q': 9, 'R': 8, 'S': 7, 'T': 7, 'U': 9, 'V': 8,
  'W': 12, 'X': 8, 'Y': 8, 'Z': 7, '[': 5, ']': 5, '_': 7, '`': 7,
  'a': 7, 'b': 7, 'c': 6, 'd': 7, 'e': 7, 'f': 4, 'g': 7, 'h': 7, 'i': 3,
  'j': 4, 'k': 7, 'l': 3, 'm': 11, 'n': 7, 'o': 7, 'p': 7, 'q': 7, 'r': 5,
  's': 6, 't': 4, 'u': 7, 'v': 7, 'w': 10, 'x': 7, 'y': 7, 'z': 6, '|': 5,
};

function textWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += VERDANA_WIDTHS[ch] ?? 7;
  return w;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Render a shields.io-style two-section SVG badge.
 *   formatBadge({ label: 'design', value: 'B · 87', grade: 'B' })
 *
 * @param {object} opts
 * @param {string} opts.label  — left-side label (default 'design')
 * @param {string} opts.value  — right-side value (e.g. 'B · 87' or 'F · 12')
 * @param {string} [opts.grade] — A–F, controls right-side fill color
 * @param {string} [opts.color] — explicit hex override
 * @returns {string} SVG markup
 */
export function formatBadge({ label = 'design', value = '—', grade, color } = {}) {
  const fill = color || COLORS[grade] || COLORS.unknown;
  const labelW = textWidth(label) + 12;   // 6px padding each side
  const valueW = textWidth(value) + 12;
  const totalW = labelW + valueW;
  const labelX = labelW / 2;
  const valueX = labelW + valueW / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
  <title>${esc(label)}: ${esc(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${fill}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelX * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${textWidth(label) * 10}">${esc(label)}</text>
    <text x="${labelX * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${textWidth(label) * 10}">${esc(label)}</text>
    <text aria-hidden="true" x="${valueX * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${textWidth(value) * 10}">${esc(value)}</text>
    <text x="${valueX * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${textWidth(value) * 10}">${esc(value)}</text>
  </g>
</svg>`;
}

/** Convenience: render a badge directly from a design.score object. */
export function formatScoreBadge(score, opts = {}) {
  if (!score || !score.grade) {
    return formatBadge({ label: opts.label || 'design', value: '—', grade: 'unknown' });
  }
  return formatBadge({
    label: opts.label || 'design',
    value: `${score.grade} · ${score.overall}`,
    grade: score.grade,
  });
}
