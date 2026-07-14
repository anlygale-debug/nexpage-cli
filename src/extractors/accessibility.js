import { parseColor, rgbToHex } from '../utils.js';

// WCAG 2.1 relative luminance
function luminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagLevel(ratio, isLargeText) {
  if (isLargeText) {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA';
    return 'FAIL';
  }
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'FAIL';
}

// Tags where "foreground vs background" contrast is *not* a WCAG text concern —
// SVG/icon glyphs, media, form primitives, and structural containers without
// direct text. Filtering these removes the overlay/decorative false-positives
// that used to crater scores on dark-themed sites.
const NON_TEXT_TAGS = new Set([
  'svg', 'path', 'circle', 'rect', 'polygon', 'polyline', 'line', 'ellipse',
  'use', 'defs', 'g', 'clippath', 'mask', 'filter', 'symbol', 'stop', 'lineargradient', 'radialgradient',
  'img', 'picture', 'video', 'audio', 'canvas', 'iframe', 'source', 'track',
  'br', 'hr', 'wbr',
  'input', 'select', 'textarea', 'progress', 'meter', 'option', 'optgroup',
  'script', 'style', 'link', 'meta', 'head', 'html', 'body',
  'main', 'section', 'article', 'aside', 'header', 'footer', 'nav',
  'div', 'figure', 'form', 'fieldset', 'ul', 'ol', 'dl',
]);

const TEXT_BEARING_TAGS = new Set([
  'p', 'a', 'button', 'label', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'td', 'th', 'code', 'pre', 'em', 'strong', 'small', 'b', 'i', 'u',
  'time', 'summary', 'figcaption', 'blockquote', 'q', 'mark', 'cite', 'abbr',
  'dt', 'dd', 'kbd', 'samp', 'var', 'sub', 'sup', 'del', 'ins', 'caption', 'legend',
  // span is a high-noise/high-signal tag — it wraps both real text and
  // decorative glyphs. Include it but require an explicit background (the
  // opacity filter downstream still removes the decorative transparent ones).
  'span',
]);

function isContrastRelevant(el) {
  const tag = (el.tag || '').toLowerCase();
  if (NON_TEXT_TAGS.has(tag)) return false;
  if (!TEXT_BEARING_TAGS.has(tag)) return false;
  // If the crawler captured hasText, trust it — filters decorative
  // span/link/button wrappers that hold no real glyphs. If hasText wasn't
  // captured (older fixtures, unit tests) fall back to inclusion.
  if (el.hasText === false) return false;
  return true;
}

export function extractAccessibility(computedStyles) {
  const pairs = new Map(); // "fg|bg" -> { fg, bg, count, elements }

  for (const el of computedStyles) {
    if (!isContrastRelevant(el)) continue;

    const fg = parseColor(el.color);
    const bg = parseColor(el.backgroundColor);
    if (!fg || !bg) continue;
    // Skip transparent/semi-transparent — real contrast depends on the parent
    // stack which we don't composite. Counting these as "fails" is noise.
    if (bg.a < 0.9 || fg.a < 0.9) continue;

    const fgHex = rgbToHex(fg);
    const bgHex = rgbToHex(bg);
    if (fgHex === bgHex) continue;
    const key = `${fgHex}|${bgHex}`;

    if (!pairs.has(key)) {
      pairs.set(key, { fg, bg, fgHex, bgHex, count: 0, tags: new Set(), fontSize: null });
    }
    const pair = pairs.get(key);
    pair.count++;
    pair.tags.add(el.tag);
    // Track font size for large text determination
    const size = parseFloat(el.fontSize);
    if (!pair.fontSize || size > pair.fontSize) pair.fontSize = size;
  }

  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (const [, pair] of pairs) {
    if (pair.fgHex === pair.bgHex) continue; // skip same color pairs
    const ratio = contrastRatio(pair.fg, pair.bg);
    const isLargeText = pair.fontSize >= 18 || (pair.fontSize >= 14 && pair.tags.has('b'));
    const level = wcagLevel(ratio, isLargeText);

    if (level === 'FAIL') failCount += pair.count;
    else passCount += pair.count;

    results.push({
      foreground: pair.fgHex,
      background: pair.bgHex,
      ratio: Math.round(ratio * 100) / 100,
      level,
      isLargeText,
      count: pair.count,
      elements: [...pair.tags].slice(0, 5),
    });
  }

  // Sort: failures first, then by count
  results.sort((a, b) => {
    if (a.level === 'FAIL' && b.level !== 'FAIL') return -1;
    if (b.level === 'FAIL' && a.level !== 'FAIL') return 1;
    return b.count - a.count;
  });

  const total = passCount + failCount;
  const score = total > 0 ? Math.round((passCount / total) * 100) : 100;

  return {
    score,
    passCount,
    failCount,
    totalPairs: results.length,
    pairs: results.slice(0, 50), // top 50 pairs
  };
}
