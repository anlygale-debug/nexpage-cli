export function extractImageStyles(imageData) {
  const ratioCount = new Map();
  const shapeCount = new Map();
  const filterCount = new Map();
  const fitCount = new Map();
  const patternCount = new Map();

  const knownRatios = [
    [1, 1, '1:1'], [4, 3, '4:3'], [3, 4, '3:4'], [16, 9, '16:9'], [9, 16, '9:16'],
    [3, 2, '3:2'], [2, 3, '2:3'], [21, 9, '21:9'],
  ];

  function closestRatio(w, h) {
    if (!w || !h) return null;
    const r = w / h;
    let best = null, bestDiff = 0.15;
    for (const [rw, rh, label] of knownRatios) {
      const diff = Math.abs(r - rw / rh);
      if (diff < bestDiff) { best = label; bestDiff = diff; }
    }
    return best || `${Math.round(r * 100) / 100}:1`;
  }

  function classifyShape(borderRadius) {
    const br = parseFloat(borderRadius) || 0;
    if (br >= 50) return 'circular';
    if (br >= 20) return 'pill';
    if (br > 0) return 'rounded';
    return 'square';
  }

  function classifyPattern(img, shape) {
    const w = img.width || 0, h = img.height || 0;
    const area = w * h;
    if (shape === 'circular' && area <= 22500) return 'avatar';
    if (w >= 600 && h >= 200 && img.objectFit === 'cover') return 'hero';
    if (area <= 40000 && (shape === 'rounded' || shape === 'square')) return 'thumbnail';
    if (w >= 400 && h >= 400 && shape === 'square') return 'gallery';
    return 'general';
  }

  function incMap(map, key, extra) {
    if (!map.has(key)) map.set(key, { count: 0, ...extra });
    map.get(key).count++;
  }

  for (const img of imageData) {
    const ratio = closestRatio(img.width, img.height);
    if (ratio) incMap(ratioCount, ratio);

    const shape = classifyShape(img.borderRadius);
    incMap(shapeCount, shape, { borderRadius: img.borderRadius || '0' });

    if (img.filter && img.filter !== 'none') {
      for (const f of img.filter.match(/[a-z-]+\(/g) || [img.filter]) {
        incMap(filterCount, f.replace('(', ''));
      }
    }

    if (img.objectFit && img.objectFit !== 'initial') incMap(fitCount, img.objectFit);

    const pattern = classifyPattern(img, shape);
    incMap(patternCount, pattern, { styles: { objectFit: img.objectFit, borderRadius: img.borderRadius, shape } });
  }

  const toArray = (map, keyName) =>
    Array.from(map.entries()).map(([k, v]) => ({ [keyName]: k, ...v })).sort((a, b) => b.count - a.count);

  return {
    patterns: toArray(patternCount, 'name'),
    aspectRatios: toArray(ratioCount, 'ratio'),
    shapes: toArray(shapeCount, 'shape'),
    filters: toArray(filterCount, 'filter'),
    objectFitUsage: toArray(fitCount, 'value'),
  };
}
