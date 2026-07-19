function cleanString(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned === '[object Object]' ? '' : cleaned;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function kebabCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function token(value, type) {
  return { $value: value, $type: type };
}

function pixel(value) {
  const number = finiteNumber(value);
  return number === null ? null : `${number}px`;
}

function verifiedValue(entry) {
  return entry && typeof entry === 'object' ? entry.value : undefined;
}

function typographyValue(entry) {
  const value = verifiedValue(entry);
  if (!value || typeof value !== 'object') return null;
  const family = cleanString(value.family);
  if (!family) return null;

  const result = { fontFamily: family };
  const fontSize = pixel(value.size);
  const lineHeight = pixel(value.lineHeight);
  const letterSpacing = pixel(value.letterSpacing);
  const fontWeight = finiteNumber(value.weight) ?? cleanString(value.weight);
  if (fontSize) result.fontSize = fontSize;
  if (fontWeight !== '') result.fontWeight = fontWeight;
  if (lineHeight) result.lineHeight = lineHeight;
  if (letterSpacing) result.letterSpacing = letterSpacing;
  return result;
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function candidateLine(entry) {
  const value = verifiedValue(entry);
  const display = typeof value === 'string'
    ? cleanString(value)
    : cleanString(value?.family || value?.clipPath);
  if (!display) return '';
  const confidence = finiteNumber(entry.confidence);
  return confidence === null ? display : `${display}（置信度 ${Math.round(confidence * 100)}%）`;
}

export function formatVerifiedTokens(model) {
  const colors = {};
  const semanticColors = {};
  for (const [name, entry] of Object.entries(model?.verified?.colors || {})) {
    const value = cleanString(verifiedValue(entry));
    if (!value) continue;
    const primitiveName = kebabCase(name);
    colors[primitiveName] = token(value, 'color');
    semanticColors[name] = token(`{color.${primitiveName}}`, 'color');
  }

  const typography = {};
  const semanticTypography = {};
  for (const [name, entry] of Object.entries(model?.verified?.typography || {})) {
    const value = typographyValue(entry);
    if (!value) continue;
    const primitiveName = kebabCase(name);
    typography[primitiveName] = token(value, 'typography');
    semanticTypography[name] = token(`{typography.${primitiveName}}`, 'typography');
  }

  const spacing = {};
  for (const entry of model?.verified?.spacing || []) {
    const value = finiteNumber(verifiedValue(entry));
    if (value === null) continue;
    spacing[`space-${kebabCase(value)}`] = token(`${value}px`, 'dimension');
  }

  const shapes = {};
  for (const [name, entry] of Object.entries(model?.verified?.shapes || {})) {
    const value = verifiedValue(entry);
    if (!value || typeof value !== 'object') continue;
    const shape = {};
    const clipPath = cleanString(value.clipPath);
    const borderRadius = pixel(value.borderRadius);
    if (clipPath) shape.clipPath = clipPath;
    if (borderRadius) shape.borderRadius = borderRadius;
    if (Object.keys(shape).length) shapes[name] = shape;
  }

  const result = {
    $metadata: {
      generator: 'nexpage',
      source: cleanString(model?.meta?.source),
      model: 'verified-visual-model',
    },
  };
  if (Object.keys(colors).length) result.color = colors;
  if (Object.keys(typography).length) result.typography = typography;
  if (Object.keys(spacing).length) result.spacing = spacing;

  const semantic = {};
  if (Object.keys(semanticColors).length) semantic.color = semanticColors;
  if (Object.keys(semanticTypography).length) semantic.typography = semanticTypography;
  result.semantic = semantic;
  if (Object.keys(shapes).length) {
    result.$extensions = { 'nexpage/shapes': shapes };
  }
  return formatJson(result);
}

export function formatVerifiedCss(model) {
  const declarations = [];
  for (const [name, entry] of Object.entries(model?.verified?.colors || {})) {
    const value = cleanString(verifiedValue(entry));
    if (value) declarations.push([`color-${kebabCase(name)}`, value]);
  }

  for (const [name, entry] of Object.entries(model?.verified?.typography || {})) {
    const value = verifiedValue(entry);
    if (!value || typeof value !== 'object') continue;
    const prefix = `typography-${kebabCase(name)}`;
    const family = cleanString(value.family);
    const size = pixel(value.size);
    const lineHeight = pixel(value.lineHeight);
    const letterSpacing = pixel(value.letterSpacing);
    const fontWeight = finiteNumber(value.weight) ?? cleanString(value.weight);
    if (family) declarations.push([`${prefix}-font-family`, family]);
    if (size) declarations.push([`${prefix}-font-size`, size]);
    if (fontWeight !== '') declarations.push([`${prefix}-font-weight`, String(fontWeight)]);
    if (lineHeight) declarations.push([`${prefix}-line-height`, lineHeight]);
    if (letterSpacing) declarations.push([`${prefix}-letter-spacing`, letterSpacing]);
  }

  for (const entry of model?.verified?.spacing || []) {
    const value = finiteNumber(verifiedValue(entry));
    if (value !== null) declarations.push([`spacing-${kebabCase(value)}`, `${value}px`]);
  }

  for (const [name, entry] of Object.entries(model?.verified?.shapes || {})) {
    const value = verifiedValue(entry);
    if (!value || typeof value !== 'object') continue;
    const prefix = `shape-${kebabCase(name)}`;
    const clipPath = cleanString(value.clipPath);
    const borderRadius = pixel(value.borderRadius);
    if (clipPath) declarations.push([`${prefix}-clip-path`, clipPath]);
    if (borderRadius) declarations.push([`${prefix}-border-radius`, borderRadius]);
  }

  return [':root {', ...declarations.map(([name, value]) => `  --${name}: ${value};`), '}', ''].join('\n');
}

export function formatVerifiedMotion(model) {
  const animations = (model?.verified?.motion || []).flatMap(entry => {
    const value = verifiedValue(entry);
    const name = cleanString(value?.name);
    const target = cleanString(value?.target);
    const duration = finiteNumber(value?.duration);
    if (!name || !target || duration === null) return [];
    return [{
      name,
      target,
      duration,
      easing: cleanString(value.easing) || 'linear',
      iterations: finiteNumber(value.iterations) ?? 'infinite',
      category: duration >= 1000 ? 'ambient' : 'transition',
      reducedMotion: 'disable',
    }];
  });
  return formatJson({ animations });
}

export function formatVerifiedCodexContext(model) {
  const title = cleanString(model?.meta?.title) || 'Extracted Website';
  const source = cleanString(model?.meta?.source) || '未记录';
  const lines = [`# ${title} — Codex 视觉上下文`, ''];

  lines.push('## 用途与边界', '');
  lines.push('- 本目录用于把已验证的视觉语言应用到新产品，不要复刻来源页面。');
  lines.push(`- 来源页面：${source}`);
  lines.push('- 只迁移抽象的颜色、排版、间距、形状、材质与动效规律。', '');

  lines.push('## Codex 行为规则', '');
  lines.push('- 本目录只用于建立视觉语言，不用于复刻来源页面。');
  lines.push('- 不复制来源品牌、Logo、文案、专有插画、产品内容或信息架构。');
  lines.push('- 如果尚未收到新产品需求，确认已读取视觉基准后等待用户继续说明需求。');
  lines.push('- 如果视觉包与产品需求同时提供，先设计新产品自己的信息架构，再应用本视觉语言。');
  lines.push('- 截图决定视觉比例，已验证规则决定语义，机器文件提供精确数值；候选不是强制规范。', '');

  lines.push('## 阅读顺序与证据优先级', '');
  lines.push('用户需求 → 两张截图 → CODEX 已验证规则 → CSS/Token/Motion → 低可信候选。', '');

  lines.push('## 已验证视觉语言', '');
  const colors = Object.entries(model?.verified?.colors || {});
  const typography = Object.entries(model?.verified?.typography || {});
  const spacing = model?.verified?.spacing || [];
  const shapes = Object.entries(model?.verified?.shapes || {});
  if (!colors.length && !typography.length && !spacing.length && !shapes.length) {
    lines.push('- 暂无可安全提升为规则的视觉值。');
  }
  for (const [name, entry] of colors) {
    const value = cleanString(verifiedValue(entry));
    if (value) lines.push(`- 颜色 ${name}：\`${value}\``);
  }
  for (const [name, entry] of typography) {
    const value = verifiedValue(entry);
    const family = cleanString(value?.family);
    if (family) lines.push(`- 排版 ${name}：${family}${finiteNumber(value?.size) === null ? '' : ` · ${value.size}px`}`);
  }
  if (spacing.length) {
    const values = spacing.map(entry => finiteNumber(verifiedValue(entry))).filter(value => value !== null);
    if (values.length) lines.push(`- 间距节奏：${values.map(value => `${value}px`).join(' · ')}`);
  }
  for (const [name, entry] of shapes) {
    const value = verifiedValue(entry);
    const clipPath = cleanString(value?.clipPath);
    const radius = pixel(value?.borderRadius);
    const details = [clipPath && `clip-path ${clipPath}`, radius && `圆角 ${radius}`].filter(Boolean);
    if (details.length) lines.push(`- 形状 ${name}：${details.join('；')}`);
  }
  lines.push('');

  lines.push('## 低可信候选', '');
  const candidates = Object.entries(model?.candidates || {}).flatMap(([kind, entries]) =>
    (Array.isArray(entries) ? entries : []).map(entry => [kind, candidateLine(entry)]));
  if (!candidates.length) lines.push('- 暂无低可信候选。');
  for (const [kind, value] of candidates) {
    if (value) lines.push(`- ${kind}：${value}`);
  }
  lines.push('- 候选只用于对照截图，不得自动提升为强制规范。', '');

  lines.push('## 抽象视觉节奏', '');
  const surfaces = (model?.rhythm?.surfaceSequence || []).map(cleanString).filter(Boolean);
  const principles = (model?.rhythm?.principles || []).map(cleanString).filter(Boolean);
  if (surfaces.length) lines.push(`- 表面序列：${surfaces.join(' → ')}`);
  if (principles.length) principles.forEach(principle => lines.push(`- ${principle}`));
  if (!surfaces.length && !principles.length) lines.push('- 当前覆盖范围不足以确认完整页面节奏。');
  lines.push('');

  lines.push('## 覆盖范围与限制', '');
  if (model?.coverage?.fullPage === true) {
    lines.push('- 已获取桌面视口与完整页面证据，可描述页面级视觉节奏。');
  } else {
    lines.push('- 当前证据只覆盖桌面首屏，不得推断完整页面节奏。');
  }
  if (cleanString(model?.coverage?.fullPageError)) {
    lines.push(`- 完整页面采集限制：${cleanString(model.coverage.fullPageError)}`);
  }
  lines.push('- 自动提取不能证明移动端、登录态、动态 Canvas、WebGL、视频或未触发交互的最终表现。', '');

  return lines.join('\n');
}

export function buildVerifiedContextFiles(model) {
  const files = {
    'CODEX.md': formatVerifiedCodexContext(model),
    'tokens.json': formatVerifiedTokens(model),
    'variables.css': formatVerifiedCss(model),
  };
  if ((model?.verified?.motion || []).length > 0) {
    files['motion.json'] = formatVerifiedMotion(model);
  }
  return files;
}
