export function extractIcons(iconData) {
  if (!iconData || !iconData.length) {
    return { icons: [], sizeDistribution: { xs: 0, sm: 0, md: 0, lg: 0, xl: 0 }, dominantStyle: 'none', colorPalette: [], count: 0 };
  }

  function classifySize(w, h) {
    const s = Math.max(w || 0, h || 0);
    if (s < 16) return 'xs';
    if (s < 20) return 'sm';
    if (s < 28) return 'md';
    if (s < 40) return 'lg';
    return 'xl';
  }

  function cleanSvg(svg) {
    return svg.replace(/\s*(data-[a-z-]*|class|id)="[^"]*"/g, '').replace(/\s+/g, ' ').trim();
  }
  function simplify(svg) { return cleanSvg(svg); }

  function detectStyle(svg) {
    const hasStroke = /stroke="(?!none)[^"]+"|stroke-width="[^0"][^"]*"/.test(svg);
    const hasFill = /fill="(?!none|transparent)[^"]+"|<(rect|circle|path)[^>]*(?!fill="none")/.test(svg);
    const fillNone = /fill="none"/.test(svg);
    if (hasStroke && (fillNone || !hasFill)) return 'outlined';
    if (hasStroke && hasFill) return 'duo-tone';
    return 'filled';
  }

  function extractColors(svg) {
    const colors = new Set();
    for (const m of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      if (m[1] !== 'none' && m[1] !== 'transparent') colors.add(m[1]);
    }
    return [...colors];
  }

  // Deduplicate
  const seen = new Map();
  for (const icon of iconData) {
    const key = simplify(icon.svg);
    if (!seen.has(key)) seen.set(key, icon);
  }

  const sizeDistribution = { xs: 0, sm: 0, md: 0, lg: 0, xl: 0 };
  const styleCounts = { outlined: 0, filled: 0, 'duo-tone': 0 };
  const allColors = new Set();

  const icons = [];
  for (const icon of seen.values()) {
    const cleaned = cleanSvg(icon.svg);
    const sc = classifySize(icon.width, icon.height);
    const style = detectStyle(icon.svg);
    const colors = extractColors(icon.svg);
    if (icon.fill && icon.fill !== 'none') colors.push(icon.fill);
    if (icon.stroke && icon.stroke !== 'none') colors.push(icon.stroke);
    const uniqueColors = [...new Set(colors)];

    sizeDistribution[sc]++;
    styleCounts[style]++;
    uniqueColors.forEach(c => allColors.add(c));

    icons.push({
      svg: cleaned,
      size: { width: icon.width, height: icon.height },
      sizeClass: sc,
      style,
      colors: uniqueColors,
    });
  }

  const dominantStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0][0];

  return {
    icons,
    sizeDistribution,
    dominantStyle,
    colorPalette: [...allColors],
    count: icons.length,
  };
}
