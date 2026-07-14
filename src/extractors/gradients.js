export function extractGradients(styles) {
  const seen = new Set();
  const gradients = [];

  for (const el of styles) {
    const bg = el.backgroundImage;
    if (!bg || !bg.includes('gradient')) continue;
    const rawGradients = splitGradients(bg);
    for (let raw of rawGradients) {
      // Normalize vendor prefixes
      raw = raw.replace(/-(webkit|moz)-/g, '');
      if (seen.has(raw)) continue;
      seen.add(raw);
      gradients.push(parseGradient(raw));
    }
  }

  return { gradients, count: gradients.length };
}

function splitGradients(value) {
  // Split comma-separated gradient layers, respecting nested parens
  const results = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === ',' && depth === 0) {
      const chunk = value.slice(start, i).trim();
      if (chunk.includes('gradient')) results.push(chunk);
      start = i + 1;
    }
  }
  const last = value.slice(start).trim();
  if (last.includes('gradient')) results.push(last);
  return results;
}

function parseGradient(raw) {
  const typeMatch = raw.match(/^(repeating-)?(linear|radial|conic)-gradient/);
  const type = typeMatch ? (typeMatch[1] || '') + typeMatch[2] : 'linear';

  // Extract content inside outermost parens
  const inner = raw.slice(raw.indexOf('(') + 1, raw.lastIndexOf(')'));

  // Split top-level arguments by comma (respecting nested parens)
  const args = [];
  let depth = 0, start = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') depth++;
    else if (inner[i] === ')') depth--;
    else if (inner[i] === ',' && depth === 0) {
      args.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(inner.slice(start).trim());

  // First arg is direction/angle if it doesn't look like a color
  let direction = null;
  let stopArgs = args;
  const first = args[0] || '';
  if (/^(to |from |\d+(\.\d+)?(deg|grad|rad|turn)|at )/.test(first) || /^(circle|ellipse)/.test(first)) {
    direction = first;
    stopArgs = args.slice(1);
  }

  const stops = stopArgs.map(s => {
    // Match position only if it's outside parentheses (not inside rgb/hsl)
    // Position is a percentage or length at the end, after the color value
    const trimmed = s.trim();
    // Check if trailing value is outside any parens
    const lastParen = trimmed.lastIndexOf(')');
    const trailing = lastParen >= 0 ? trimmed.slice(lastParen + 1).trim() : trimmed;
    const posMatch = trailing.match(/([\d.]+(%|px|em|rem|vw|vh)?)$/);
    let position = null;
    let color = trimmed;
    if (posMatch && posMatch[0] !== trimmed) {
      // Position found after the color function closes
      position = posMatch[0];
      color = trimmed.slice(0, trimmed.length - trailing.length + trailing.indexOf(posMatch[0])).trim();
    } else if (lastParen < 0) {
      // No parens — simple color like "red 50%"
      const simplePos = trimmed.match(/\s+([\d.]+(%|px|em|rem|vw|vh)?)$/);
      if (simplePos) {
        position = simplePos[1];
        color = trimmed.slice(0, simplePos.index).trim();
      }
    }
    return { color, position };
  });

  const colorCount = stops.length;
  let classification = 'subtle';
  if (colorCount > 4) classification = 'complex';
  else if (colorCount > 2) classification = 'bold';
  else if (colorCount === 2) classification = 'brand';

  return { raw, type, direction, stops, classification };
}
