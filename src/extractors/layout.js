// Layout extraction — grid, flexbox, container patterns, structural design language

export function extractLayout(computedStyles) {
  const containers = [];
  const gridPatterns = [];
  const flexPatterns = [];
  const columnCounts = new Map();

  for (const el of computedStyles) {
    const isGrid = el.display === 'grid' || el.display === 'inline-grid';
    const isFlex = el.display === 'flex' || el.display === 'inline-flex';

    if (isGrid) {
      gridPatterns.push({
        tag: el.tag,
        classList: el.classList,
        gridTemplateColumns: el.gridTemplateColumns || 'none',
        gridTemplateRows: el.gridTemplateRows || 'none',
        gap: el.gap,
        area: el.area,
      });

      // Count column patterns
      const cols = el.gridTemplateColumns;
      if (cols && cols !== 'none') {
        const colCount = cols.split(/\s+/).filter(v => v && v !== 'none').length;
        if (colCount > 0) columnCounts.set(colCount, (columnCounts.get(colCount) || 0) + 1);
      }
    }

    if (isFlex) {
      flexPatterns.push({
        tag: el.tag,
        classList: el.classList,
        flexDirection: el.flexDirection || 'row',
        flexWrap: el.flexWrap || 'nowrap',
        justifyContent: el.justifyContent || 'normal',
        alignItems: el.alignItems || 'normal',
        gap: el.gap,
        area: el.area,
      });
    }

    // Detect containers (large centered elements)
    if (el.area > 100000 && el.maxWidth && el.maxWidth !== 'none') {
      containers.push({
        tag: el.tag,
        classList: el.classList,
        maxWidth: el.maxWidth,
        paddingLeft: el.paddingLeft,
        paddingRight: el.paddingRight,
      });
    }
  }

  // Summarize flex direction usage
  const flexDirections = {};
  for (const f of flexPatterns) {
    const key = `${f.flexDirection}/${f.flexWrap}`;
    flexDirections[key] = (flexDirections[key] || 0) + 1;
  }

  // Summarize justify/align patterns
  const justifyPatterns = {};
  const alignPatterns = {};
  for (const f of flexPatterns) {
    justifyPatterns[f.justifyContent] = (justifyPatterns[f.justifyContent] || 0) + 1;
    alignPatterns[f.alignItems] = (alignPatterns[f.alignItems] || 0) + 1;
  }

  // Grid column summary
  const gridColumns = [...columnCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cols, count]) => ({ columns: cols, count }));

  // Container widths
  const containerWidths = [];
  const widthSet = new Set();
  for (const c of containers) {
    if (!widthSet.has(c.maxWidth)) {
      widthSet.add(c.maxWidth);
      containerWidths.push({ maxWidth: c.maxWidth, padding: c.paddingLeft });
    }
  }

  // Gap values
  const gaps = new Set();
  for (const el of [...gridPatterns, ...flexPatterns]) {
    if (el.gap && el.gap !== 'normal' && el.gap !== '0px') {
      gaps.add(el.gap);
    }
  }

  return {
    gridCount: gridPatterns.length,
    flexCount: flexPatterns.length,
    gridColumns,
    flexDirections,
    justifyPatterns,
    alignPatterns,
    containerWidths,
    gaps: [...gaps].sort(),
    // Sample grid patterns (top 5 by area)
    topGrids: gridPatterns
      .sort((a, b) => b.area - a.area)
      .slice(0, 5)
      .map(g => ({ columns: g.gridTemplateColumns, rows: g.gridTemplateRows, gap: g.gap })),
    // Sample flex patterns (top 5 by area)
    topFlex: flexPatterns
      .sort((a, b) => b.area - a.area)
      .slice(0, 5)
      .map(f => ({ direction: f.flexDirection, wrap: f.flexWrap, justify: f.justifyContent, align: f.alignItems, gap: f.gap })),
  };
}
