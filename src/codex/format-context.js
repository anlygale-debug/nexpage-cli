function cleanString(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  const normalized = cleaned.toLowerCase();
  return ['null', 'undefined', '[object object]'].includes(normalized) ? '' : cleaned;
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
  lines.push('- 自动提取的语义角色可能误判或缺失；必须先用视觉能力检查截图，再决定如何使用结构化规则。', '');

  lines.push('## 阅读顺序与证据优先级', '');
  lines.push('用户需求 → 两张截图 → CODEX 已验证规则 → CSS/Token/Motion → 低可信候选。', '');

  lines.push('## 视觉冲突裁决（必须执行）', '');
  lines.push('- 开始实现前必须实际查看 `reference.png`；有长页证据时也要查看 `reference-full.png`，不能只阅读文字和 Token。');
  lines.push('- 当自动语义角色（如 actionPrimary、surface、ink）或视觉层级与截图冲突时，语义角色以截图为准，不得盲从自动标签。');
  lines.push('- 允许根据截图重新映射 `actionPrimary` 等角色，例如把自动标为次操作、表面色或候选的颜色用于真正的主操作。');
  lines.push('- 截图负责判断“哪个元素是什么角色”，Token/CSS 负责提供该元素已采集到的精确数值；数值可靠不代表语义标签一定可靠。');
  lines.push('- 角色缺失时，先从已提取颜色、组件和低可信候选中寻找与截图匹配的精确值；仍无法确认时，按截图克制补全并在完成报告中标明推断。');
  lines.push('- 忽略截图中的 Cookie、隐私、地区、登录、验证等临时浮层，不把它们作为目标视觉语言。', '');

  lines.push('## 已验证视觉语言', '');
  const colors = Object.entries(model?.verified?.colors || {});
  const typography = Object.entries(model?.verified?.typography || {});
  const spacing = model?.verified?.spacing || [];
  const shapes = Object.entries(model?.verified?.shapes || {});
  const materials = Array.isArray(model?.verified?.materials) ? model.verified.materials : [];
  const actionComponents = Array.isArray(model?.verified?.components?.actions)
    ? model.verified.components.actions
    : [];
  const cardComponents = Array.isArray(model?.verified?.components?.cards)
    ? model.verified.components.cards
    : [];
  if (!colors.length && !typography.length && !spacing.length && !shapes.length
    && !materials.length && !actionComponents.length && !cardComponents.length) {
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

  lines.push('### 材质与表面', '');
  if (!materials.length) lines.push('- 暂无经过重复证据支持的表面材质规则。');
  for (const entry of materials) {
    const value = verifiedValue(entry);
    const role = cleanString(value?.role);
    const roleLabel = role === 'surfaceLight' ? '浅色表面' : role === 'surfaceDark' ? '深色表面' : '';
    const background = cleanString(value?.background);
    const foreground = cleanString(value?.foreground);
    if (!roleLabel || !background) continue;
    lines.push(`- ${roleLabel}：背景 \`${background}\`${foreground ? `；前景 \`${foreground}\`` : ''}`);
  }
  lines.push('');

  lines.push('### 组件规则', '');
  if (!actionComponents.length && !cardComponents.length) {
    lines.push('- 暂无经过重复证据支持的组件规则。');
  }
  for (const entry of actionComponents) {
    const value = verifiedValue(entry);
    const role = cleanString(value?.role);
    const roleLabel = role === 'primary' ? '主操作 / 按钮' : role === 'secondary' ? '次操作 / 按钮' : '';
    const background = cleanString(value?.background);
    const foreground = cleanString(value?.foreground);
    if (!roleLabel || !background) continue;
    const details = [`背景 \`${background}\``];
    if (foreground) details.push(`前景 \`${foreground}\``);
    const clipPath = cleanString(value?.shape?.clipPath);
    const radius = pixel(value?.shape?.borderRadius);
    if (clipPath) details.push(`裁切形状 ${clipPath}`);
    if (radius) details.push(`圆角 ${radius}`);
    lines.push(`- ${roleLabel}：${details.join('；')}`);
  }
  for (const entry of cardComponents) {
    const value = verifiedValue(entry);
    const background = cleanString(value?.background);
    if (!background) continue;
    const details = [`背景 \`${background}\``];
    const foreground = cleanString(value?.foreground);
    const borderColor = cleanString(value?.border?.color);
    const borderWidth = pixel(value?.border?.width);
    const clipPath = cleanString(value?.shape?.clipPath);
    const radius = pixel(value?.shape?.borderRadius);
    if (foreground) details.push(`前景 \`${foreground}\``);
    if (borderWidth && borderColor) details.push(`边框 ${borderWidth} \`${borderColor}\``);
    if (clipPath) details.push(`裁切形状 ${clipPath}`);
    if (radius) details.push(`圆角 ${radius}`);
    lines.push(`- 卡片：${details.join('；')}`);
  }
  lines.push('- 这些规则只描述可复用视觉结构，不携带来源品牌、文案或信息架构。', '');

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

function verifiedColorLines(model) {
  return Object.entries(model?.verified?.colors || {}).flatMap(([name, entry]) => {
    const value = cleanString(verifiedValue(entry));
    return value ? [`- ${name}：\`${value}\``] : [];
  });
}

function verifiedTypographyLines(model) {
  return Object.entries(model?.verified?.typography || {}).flatMap(([name, entry]) => {
    const value = verifiedValue(entry);
    const family = cleanString(value?.family);
    if (!family) return [];
    const details = [family, finiteNumber(value?.size) !== null && `${value.size}px`, cleanString(value?.weight)]
      .filter(Boolean);
    return [`- ${name}：${details.join(' · ')}`];
  });
}

function formatStrictDesign(model) {
  const lines = ['# 严格视觉规则', '', '以下数值来自真实渲染证据，但自动分配的语义角色可能出错。先用截图确认角色，再把对应精确数值作为不可随意改写的视觉锚点。', ''];
  lines.push('## 必须保持', '');
  const colors = verifiedColorLines(model);
  const typography = verifiedTypographyLines(model);
  if (colors.length) lines.push('### 颜色角色', '', ...colors, '');
  if (typography.length) lines.push('### 排版角色', '', ...typography, '');
  const spacing = (model?.verified?.spacing || []).map(entry => finiteNumber(verifiedValue(entry))).filter(value => value !== null);
  if (spacing.length) lines.push('### 间距尺度', '', `- 只优先使用：${spacing.map(value => `${value}px`).join('、')}。`, '');
  lines.push('## 硬性失败条件', '');
  lines.push('- 把主操作色替换成更常见的紫色渐变、蓝色按钮或框架默认色。');
  lines.push('- 忽略 `reference.png` 的首屏比例，生成普通模板化 Hero。');
  lines.push('- 擅自加入玻璃拟态、柔光、渐变、超大圆角或阴影，而截图和已验证规则没有支持。');
  lines.push('- 复制来源品牌、Logo、文案、插画或产品信息架构。');
  lines.push('- 把低可信候选当成强制 Token。', '');
  lines.push('- 在截图明显不支持时仍盲目使用 `actionPrimary`、surface 或组件语义标签。', '');
  return lines.join('\n');
}

function formatComponents(model) {
  const lines = ['# 组件视觉规则', '', '组件需要继承来源视觉语言，但内容、名称和业务结构必须来自用户自己的产品。', ''];
  const actions = Array.isArray(model?.verified?.components?.actions) ? model.verified.components.actions : [];
  lines.push('## 主操作与次操作', '');
  if (!actions.length) lines.push('- 没有足够的重复证据建立完整按钮组件；以 `reference.png` 和已验证操作色为准。');
  for (const entry of actions) {
    const value = verifiedValue(entry) || {};
    const label = value.role === 'primary' ? '主操作' : value.role === 'secondary' ? '次操作' : '操作';
    const details = [value.background && `背景 \`${value.background}\``, value.foreground && `文字 \`${value.foreground}\``];
    if (value.shape?.borderRadius !== undefined) details.push(`圆角 ${value.shape.borderRadius}px`);
    if (cleanString(value.shape?.clipPath)) details.push(`裁切 ${cleanString(value.shape.clipPath)}`);
    lines.push(`- ${label}：${details.filter(Boolean).join('；')}。`);
  }
  lines.push('', '## 卡片与表面', '');
  const cards = Array.isArray(model?.verified?.components?.cards) ? model.verified.components.cards : [];
  if (!cards.length) lines.push('- 没有足够的重复证据建立卡片 Token；不要自动套用常见 SaaS 圆角卡片。');
  cards.forEach((entry, index) => {
    const value = verifiedValue(entry) || {};
    const details = [value.background && `背景 \`${value.background}\``, value.foreground && `文字 \`${value.foreground}\``];
    if (value.border) details.push(`边框 ${value.border.width}px \`${value.border.color}\``);
    if (value.shape?.borderRadius !== undefined) details.push(`圆角 ${value.shape.borderRadius}px`);
    lines.push(`- 卡片 ${index + 1}：${details.filter(Boolean).join('；')}。`);
  });
  lines.push('', '## 状态补全原则', '', '- hover、focus、active 和 disabled 状态优先保持同一形状、字体和色彩关系。');
  lines.push('- 原页面没有提供状态证据时，允许为可用性补全，但不得改变视觉身份。', '');
  return lines.join('\n');
}

function formatCodexInstructions(model) {
  const hasFullPage = model?.coverage?.fullPage === true;
  return [
    '# Codex 执行说明', '',
    '## 阅读顺序', '',
    '1. 先阅读 `CODEX.md`，确认用途、证据边界和用户的新产品需求。',
    '2. 查看 `reference.png`，理解首屏比例、排版尺度和视觉重心。',
    hasFullPage ? '3. 查看 `reference-full.png`，理解长页面节奏和表面变化。' : '3. 当前没有可靠完整页证据，不推断长页面节奏。',
    '4. 阅读 `design-strict.md`、`components.md` 和 `STYLE-GUARDRAILS.md`。',
    '5. 使用 `tokens.json` 与 `variables.css` 中的精确值实现。', '',
    '## 实现流程', '',
    '- 先根据用户需求设计信息架构，再应用视觉语言。',
    '- 必须用视觉能力查看两张参考图；不得盲目把 `actionPrimary` 或其他自动语义标签直接当作正确答案。',
    '- 如果截图与语义标签冲突，按截图重新分配角色，再从 Token、组件规则或候选中使用视觉匹配的精确值。',
    '- 开始编码前，列出页面区域、将使用的视觉锚点以及需要补全的未知项。',
    '- 优先复用已验证 Token；无法证明的设计选择必须保持克制。',
    '- 同时检查桌面和移动端，不要通过缩小桌面页面代替响应式设计。',
    '- 完成后逐项执行 `acceptance-checklist.md`，发现硬性失败时继续修正。', '',
    '## 完成报告', '',
    '- 说明使用了哪些已验证视觉规则。',
    '- 标出哪些部分属于合理补全，而不是来源事实。',
    '- 说明没有复制来源品牌、文案和信息架构。', '',
  ].join('\n');
}

function formatStyleGuardrails(model) {
  const anchors = [...verifiedColorLines(model), ...verifiedTypographyLines(model)];
  return [
    '# STYLE GUARDRAILS', '',
    '## 视觉锚点', '',
    ...(anchors.length ? anchors : ['- 当前结构化锚点有限，必须以两张参考截图为最高视觉依据。']), '',
    '## 防跑偏规则', '',
    '- 禁止把页面做成通用 AI SaaS 模板。',
    '- 不得为了“更现代”而替换已验证的主色、字体、形状和表面关系。',
    '- 自动语义标签与截图冲突时，按截图重新映射角色；这不等于随意替换视觉数值。',
    '- 截图没有出现渐变、玻璃、柔光、厚阴影或大圆角时，不得自行加入。',
    '- 强调色只用于真正需要强调的位置，不得平均铺满页面。',
    '- 保持标题与正文的尺度差、内容密度和留白节奏，不只复制颜色。',
    '- 禁止复制来源 Logo、品牌名称、原文案、插画和业务模块顺序。', '',
  ].join('\n');
}

function formatAcceptanceChecklist(model) {
  const primary = cleanString(verifiedValue(model?.verified?.colors?.actionPrimary));
  return [
    '# 视觉验收清单', '',
    '## 视觉一致性', '',
    '- [ ] 与 `reference.png` 并排检查，首屏视觉重心、字号比例和留白关系一致。',
    model?.coverage?.fullPage === true
      ? '- [ ] 与 `reference-full.png` 并排检查，长页面密度与深浅表面节奏一致。'
      : '- [ ] 没有假装掌握未采集的长页面节奏。',
    primary
      ? `- [ ] 已用截图确认自动主操作标签 \`${primary}\`；若不一致，已重新映射正确角色并记录原因。`
      : '- [ ] 已从截图判断是否存在主操作；没有在证据不足时虚构主操作颜色。',
    '- [ ] display、body 和 mono 字体角色没有混用。',
    '- [ ] 按钮、卡片、输入框的圆角、边框和阴影属于同一形状语言。',
    '- [ ] 强调色比例接近参考图，没有为了热闹而扩大使用面积。', '',
    '## 产品与可用性', '',
    '- [ ] 页面信息架构来自用户需求，不是来源网页的板块复刻。',
    '- [ ] 没有复制来源品牌、Logo、文案或专有资产。',
    '- [ ] 键盘焦点可见，文字和操作具备可读对比度。',
    '- [ ] 1280px 桌面与 390px 移动端都完成检查。', '',
    '## 硬性失败', '',
    '- [ ] 没有出现错误主色、普通紫色渐变、无证据玻璃拟态或模板化 Hero。',
    '- [ ] 没有断裂 Token、非法 CSS、溢出、遮挡或不可操作控件。', '',
  ].join('\n');
}

export function buildVerifiedContextFiles(model) {
  const files = {
    'CODEX.md': formatVerifiedCodexContext(model),
    'tokens.json': formatVerifiedTokens(model),
    'variables.css': formatVerifiedCss(model),
    'design-strict.md': formatStrictDesign(model),
    'components.md': formatComponents(model),
    'codex-instructions.md': formatCodexInstructions(model),
    'STYLE-GUARDRAILS.md': formatStyleGuardrails(model),
    'acceptance-checklist.md': formatAcceptanceChecklist(model),
  };
  if ((model?.verified?.motion || []).length > 0) {
    files['motion.json'] = formatVerifiedMotion(model);
  }
  return files;
}
