import { parseCSSValue, clusterValues } from '../utils.js';

function parseBorderRadius(raw) {
  if (!raw || raw === '0px') return [];
  // Handle slash-separated (x/y) syntax — take the x part
  const parts = raw.split('/')[0].trim().split(/\s+/);
  const values = [];
  for (const p of parts) {
    const v = parseCSSValue(p);
    if (v && v.value > 0) values.push(Math.round(v.value));
  }
  return values;
}

export function extractBorders(computedStyles) {
  const radiiSet = new Map(); // value -> count
  const widthSet = new Set();
  const styleSet = new Set();

  for (const el of computedStyles) {
    if (el.borderRadius && el.borderRadius !== '0px') {
      const values = parseBorderRadius(el.borderRadius);
      if (values.length > 0) {
        // Use the max value from the shorthand as the representative
        const representative = Math.max(...values);
        radiiSet.set(representative, (radiiSet.get(representative) || 0) + 1);
      }
    }

    // Collect border widths
    if (el.borderWidth) {
      const parts = el.borderWidth.split(/\s+/);
      for (const p of parts) {
        const v = parseCSSValue(p);
        if (v && v.value > 0) widthSet.add(Math.round(v.value));
      }
    }

    // Collect border styles
    if (el.borderStyle) {
      const parts = el.borderStyle.split(/\s+/);
      for (const p of parts) {
        if (p && p !== 'none' && p !== 'initial') styleSet.add(p);
      }
    }
  }

  const sorted = [...radiiSet.keys()].sort((a, b) => a - b);
  const clustered = clusterValues(sorted, 2);

  const radii = clustered.map(v => {
    let label;
    if (v <= 2) label = 'xs';
    else if (v <= 5) label = 'sm';
    else if (v <= 10) label = 'md';
    else if (v <= 16) label = 'lg';
    else if (v <= 24) label = 'xl';
    else label = 'full';
    return { value: v, label, count: radiiSet.get(v) || 0 };
  });

  const widths = [...widthSet].sort((a, b) => a - b);
  const styles = [...styleSet].sort();

  return { radii, widths, styles };
}
