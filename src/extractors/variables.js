export function extractVariables(cssVariables) {
  const categories = { colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, other: {} };

  for (const [name, value] of Object.entries(cssVariables)) {
    const lower = name.toLowerCase();
    if (/color|bg|foreground|primary|secondary|accent|muted|border|ring|destructive|card|popover|chart/.test(lower)) {
      categories.colors[name] = value;
    } else if (/spacing|gap|padding|margin|space|size/.test(lower)) {
      categories.spacing[name] = value;
    } else if (/font|text|line-height|letter|tracking|leading/.test(lower)) {
      categories.typography[name] = value;
    } else if (/shadow/.test(lower)) {
      categories.shadows[name] = value;
    } else if (/radius|rounded/.test(lower)) {
      categories.radii[name] = value;
    } else {
      categories.other[name] = value;
    }
  }

  // Build dependency map: which variables reference other variables
  const dependencies = {};
  for (const [name, value] of Object.entries(cssVariables)) {
    const refs = [...value.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]);
    if (refs.length > 0) {
      dependencies[name] = refs;
    }
  }

  // Semantic grouping by name patterns
  const semantic = { success: {}, warning: {}, error: {}, info: {} };
  for (const [name, value] of Object.entries(cssVariables)) {
    const lower = name.toLowerCase();
    if (/success|green|valid|positive/.test(lower)) semantic.success[name] = value;
    else if (/warning|warn|yellow|caution|amber/.test(lower)) semantic.warning[name] = value;
    else if (/error|danger|destructive|red|invalid|negative/.test(lower)) semantic.error[name] = value;
    else if (/info|informati|blue|notice/.test(lower)) semantic.info[name] = value;
  }

  return { ...categories, dependencies, semantic };
}
