import { parseCSSValue, detectScale } from '../utils.js';

function naturalBreakCluster(values) {
  if (values.length <= 1) return values;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length <= 2) return sorted;

  // Compute gaps between consecutive values
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }

  // Find median gap
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];

  // Split into clusters at gaps larger than the median
  const clusters = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (gaps[i - 1] > medianGap) {
      clusters.push([sorted[i]]);
    } else {
      clusters[clusters.length - 1].push(sorted[i]);
    }
  }

  // Use the first (smallest) value in each cluster as representative
  return clusters.map(c => c[0]);
}

export function extractSpacing(computedStyles) {
  const allValues = new Set();

  for (const el of computedStyles) {
    for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap']) {
      const val = parseCSSValue(el[prop]);
      if (val && val.value > 0 && val.value < 500) {
        allValues.add(Math.round(val.value));
      }
    }
  }

  const sorted = [...allValues].sort((a, b) => a - b);
  const clustered = naturalBreakCluster(sorted);
  const { base, scale } = detectScale(clustered);

  // Build named tokens
  const tokens = {};
  if (base) {
    for (const v of scale) {
      const step = v / base;
      if (Number.isInteger(step)) {
        tokens[String(step)] = `${v}px`;
      } else {
        tokens[`${v}px`] = `${v}px`;
      }
    }
  } else {
    for (let i = 0; i < scale.length; i++) {
      tokens[String(i)] = `${scale[i]}px`;
    }
  }

  return { base, scale, tokens, raw: sorted };
}
