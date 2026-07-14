const LAYER_DEFS = [
  { name: 'modal', min: 1000, max: Infinity },
  { name: 'dropdown', min: 100, max: 999 },
  { name: 'sticky', min: 10, max: 99 },
  { name: 'base', min: -Infinity, max: 9 },
];

function elLabel(el) {
  const cls = el.classList?.length ? '.' + [...el.classList].join('.') : '';
  return el.tag + cls;
}

export function extractZIndex(styles) {
  // Filter and parse explicit z-index values
  const entries = styles
    .filter(el => el.zIndex !== 'auto')
    .map(el => ({ value: parseInt(el.zIndex, 10), el }))
    .filter(e => !isNaN(e.value));

  // Group by z-index value
  const byValue = new Map();
  for (const { value, el } of entries) {
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value).push(el);
  }

  const allValues = [...byValue.keys()].sort((a, b) => a - b);

  // Build scale: each unique value with count and representative elements
  const scale = allValues.map(value => ({
    value,
    count: byValue.get(value).length,
    elements: byValue.get(value).map(elLabel),
  }));

  // Build layers from predefined ranges
  const layers = LAYER_DEFS
    .map(def => {
      const matching = allValues.filter(v => v >= def.min && v <= def.max);
      if (!matching.length) return null;
      const elements = matching.flatMap(v => byValue.get(v).map(elLabel));
      return {
        name: def.name,
        range: [Math.min(...matching), Math.max(...matching)],
        elements,
      };
    })
    .filter(Boolean);

  // Detect issues
  const issues = [];
  const highValues = allValues.filter(v => v > 9999);
  if (highValues.length) {
    issues.push({ type: 'excessive', message: `Very high z-index values: ${highValues.join(', ')}` });
  }
  if (allValues.length >= 5) {
    const spread = allValues[allValues.length - 1] - allValues[0];
    const density = allValues.length / (spread || 1);
    if (density > 0.3) {
      issues.push({ type: 'z-index-war', message: `${allValues.length} unique values in a narrow range (${allValues[0]}-${allValues[allValues.length - 1]})` });
    }
  }

  return { layers, allValues, issues, scale };
}
