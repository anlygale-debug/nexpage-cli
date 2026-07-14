export function extractShadows(computedStyles) {
  const shadowSet = new Set();
  const textShadowSet = new Set();

  for (const el of computedStyles) {
    if (el.boxShadow && el.boxShadow !== 'none') {
      shadowSet.add(el.boxShadow);
    }
    if (el.textShadow && el.textShadow !== 'none') {
      textShadowSet.add(el.textShadow);
    }
  }

  const values = [...shadowSet].map(raw => parseShadow(raw));
  values.sort((a, b) => a.visualWeight - b.visualWeight);

  const textShadows = [...textShadowSet].map(raw => parseShadow(raw));
  textShadows.sort((a, b) => a.visualWeight - b.visualWeight);

  return { values, textShadows };
}

function parseShadow(raw) {
  const inset = raw.includes('inset');
  const cleaned = raw.replace(/\binset\b/g, '').trim();

  // Extract color (rgb/rgba/hsl/hsla or named/hex) — find the non-numeric portion
  let color = '';
  let numericPart = cleaned;
  // Match color functions first (they may contain commas/numbers)
  const colorFnMatch = cleaned.match(/(rgba?\([^)]+\)|hsla?\([^)]+\))/);
  if (colorFnMatch) {
    color = colorFnMatch[1];
    numericPart = cleaned.replace(color, '').trim();
  } else {
    // Try hex or named color at start or end
    const hexMatch = cleaned.match(/(#[0-9a-fA-F]{3,8})/);
    if (hexMatch) {
      color = hexMatch[1];
      numericPart = cleaned.replace(color, '').trim();
    } else {
      // Named color — typically last or first token that isn't a length
      const tokens = cleaned.split(/\s+/);
      const colorToken = tokens.find(t => !/^-?[\d.]+px$/.test(t) && !/^[\d.]+$/.test(t));
      if (colorToken) {
        color = colorToken;
        numericPart = cleaned.replace(colorToken, '').trim();
      }
    }
  }

  // Parse numeric values (offset-x, offset-y, blur, spread)
  const nums = numericPart.match(/-?[\d.]+px/g)?.map(n => parseFloat(n)) || [];
  const offsetX = nums[0] || 0;
  const offsetY = nums[1] || 0;
  const blur = nums[2] || 0;
  const spread = nums[3] || 0;

  // Visual weight = distance + blur
  const visualWeight = Math.sqrt(offsetX * offsetX + offsetY * offsetY) + blur;

  let label = 'none';
  if (visualWeight > 0 && visualWeight <= 3) label = 'xs';
  else if (visualWeight <= 8) label = 'sm';
  else if (visualWeight <= 16) label = 'md';
  else if (visualWeight <= 32) label = 'lg';
  else if (visualWeight > 32) label = 'xl';

  return { raw, offsetX, offsetY, blur, spread, color, inset, visualWeight: Math.round(visualWeight * 100) / 100, label };
}
