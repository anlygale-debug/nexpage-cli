// Internal helper: resolve DTCG reference strings like "{primitive.color.brand.primary}"
// against a token tree, following chains until we reach a non-reference $value.

const REF_PATTERN = /^\{([^}]+)\}$/;

function parseRef(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(REF_PATTERN);
  return match ? match[1] : null;
}

function getAtPath(tokens, path) {
  const parts = path.split('.');
  let node = tokens;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

// Resolve a token at the given dotted path to its leaf $value (following references).
// Returns undefined if the path is missing or a reference cannot be resolved.
export function resolveRef(tokens, path, seen = new Set()) {
  if (seen.has(path)) return undefined; // cycle
  seen.add(path);

  const node = getAtPath(tokens, path);
  if (node == null) return undefined;

  // If we got a token object with $value
  if (typeof node === 'object' && '$value' in node) {
    const inner = node.$value;
    const refPath = parseRef(inner);
    if (refPath) return resolveRef(tokens, refPath, seen);
    return inner;
  }

  // If the node is itself a reference string
  const refPath = parseRef(node);
  if (refPath) return resolveRef(tokens, refPath, seen);

  return node;
}
