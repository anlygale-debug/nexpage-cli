// A11y remediation: for each failing fg/bg pair, propose the nearest palette
// color that passes the requested WCAG rule.

function toRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const n = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  const i = parseInt(n, 16);
  if (Number.isNaN(i)) return [0, 0, 0];
  return [(i >> 16) & 255, (i >> 8) & 255, i & 255];
}

function relLum([r, g, b]) {
  const f = c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const la = relLum(toRgb(a));
  const lb = relLum(toRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const THRESHOLDS = { 'AA-normal': 4.5, 'AA-large': 3, 'AAA-normal': 7, 'AAA-large': 4.5 };

export function remediateFailingPairs(failing = [], palette = []) {
  return failing.map(p => {
    const target = THRESHOLDS[p.rule] || 4.5;
    let best = null;
    for (const candidate of palette) {
      if (!candidate) continue;
      const newRatio = contrast(candidate, p.bg);
      if (newRatio >= target && (!best || newRatio > best.newRatio)) {
        best = {
          replace: 'fg',
          color: candidate,
          newRatio: Math.round(newRatio * 100) / 100,
        };
      }
    }
    return { ...p, suggestion: best };
  });
}

export { contrast as _contrast };
