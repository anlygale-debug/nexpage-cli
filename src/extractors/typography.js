import { parseCSSValue } from '../utils.js';

// Filter set for fonts that aren't part of the site's brand typography:
// generic CSS fallbacks, OS UI stacks, icon fonts, and inherited "no
// declaration" values. These slipped into families[] before and polluted
// the brand book + grade summary.
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
  'inherit', 'initial', 'unset', 'revert', 'auto', '-apple-system',
  'blinkmacsystemfont', 'apple-system',
]);
const ICON_FAMILY_RE = /^(material[-\s]?icons|font\s?awesome|fa-?solid|fa-?regular|fa-?brands|ionicons|glyphicons|bootstrap-icons|remixicon|feather|tabler-icons|lucide)/i;

function normaliseFamily(raw) {
  if (!raw) return null;
  // Strip quotes + take the first stack member (sites declare e.g.
  // `"Inter", "Helvetica Neue", sans-serif` — only the first is the
  // *intended* family).
  const first = String(raw).replace(/["']/g, '').split(',')[0].trim();
  if (!first) return null;
  return first;
}

function isMeaningfulFamily(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (GENERIC_FAMILIES.has(lower)) return false;
  if (ICON_FAMILY_RE.test(name)) return false;
  // Single-character or all-symbol names are extraction noise.
  if (name.length < 2) return false;
  if (!/[a-z]/i.test(name)) return false;
  return true;
}

export function extractTypography(computedStyles) {
  const familyCount = new Map();
  const sizeEntries = [];
  const weightCount = new Map();

  for (const el of computedStyles) {
    // Font families — normalised first-of-stack, with noise filtered out.
    const family = normaliseFamily(el.fontFamily);
    if (family && isMeaningfulFamily(family)) {
      familyCount.set(family, (familyCount.get(family) || 0) + 1);
    }

    // Font sizes
    const sizeVal = parseCSSValue(el.fontSize);
    if (sizeVal) {
      sizeEntries.push({
        size: sizeVal.value,
        weight: el.fontWeight,
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing,
        tag: el.tag,
        family,
      });
    }

    // Weights
    if (el.fontWeight) weightCount.set(el.fontWeight, (weightCount.get(el.fontWeight) || 0) + 1);
  }

  // Unique font families sorted by usage
  const families = [...familyCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      const usedOn = computedStyles
        .filter(el => el.fontFamily?.includes(name))
        .map(el => el.tag);
      const headingUse = usedOn.some(t => /^h[1-6]$/.test(t));
      const bodyUse = usedOn.some(t => ['p', 'span', 'li', 'div'].includes(t));
      return { name, count, usage: headingUse && bodyUse ? 'all' : headingUse ? 'headings' : 'body' };
    });

  // Build type scale from unique sizes
  const sizeMap = new Map();
  for (const entry of sizeEntries) {
    const key = entry.size;
    if (!sizeMap.has(key)) {
      sizeMap.set(key, { size: entry.size, weight: entry.weight, lineHeight: entry.lineHeight, letterSpacing: entry.letterSpacing, tags: new Set(), count: 0 });
    }
    const s = sizeMap.get(key);
    s.tags.add(entry.tag);
    s.count++;
  }

  const scale = [...sizeMap.values()]
    .sort((a, b) => b.size - a.size)
    .map(s => ({ ...s, tags: [...s.tags] }));

  // Identify heading sizes (from h1-h6 tags)
  const headings = scale.filter(s => s.tags.some(t => /^h[1-6]$/.test(t)));

  // Body text: most common size on p/span/li
  const bodyEntries = sizeEntries.filter(e => ['p', 'span', 'li'].includes(e.tag));
  const bodySizeCount = new Map();
  for (const e of bodyEntries) bodySizeCount.set(e.size, (bodySizeCount.get(e.size) || 0) + 1);
  const bodySize = [...bodySizeCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const body = bodySize ? scale.find(s => s.size === bodySize[0]) : null;

  // Weights
  const weights = [...weightCount.entries()].sort((a, b) => b[1] - a[1]).map(([w, count]) => ({ weight: w, count }));

  return { families, scale, headings, body, weights };
}
