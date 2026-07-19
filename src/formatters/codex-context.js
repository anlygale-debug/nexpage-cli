import { formatCssVars } from './css-vars.js';
import { formatDtcgTokens } from './dtcg-tokens.js';
import { formatMotionTokens } from './motion-tokens.js';
import { copyFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_BROWSER_COLORS = new Set(['#0000ee', '#0000ff', '#551a8b']);

function scalar(value, fallback = '—') {
  if (typeof value === 'string') {
    const clean = value.replace(/\s+/g, ' ').trim();
    return clean || fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return fallback;
}

function number(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function list(values, formatter = scalar) {
  if (!Array.isArray(values)) return [];
  return values.map(formatter).filter(value => value && value !== '—');
}

function colorHex(value) {
  if (typeof value === 'string') return value.toLowerCase();
  if (value && typeof value.hex === 'string') return value.hex.toLowerCase();
  return '';
}

function colorCount(value) {
  return number(value?.count);
}

function primaryReliability(design) {
  const primary = design.colors?.primary;
  const hex = colorHex(primary);
  const count = colorCount(primary);
  const elements = Math.max(1, number(design.meta?.elementCount, 1));
  const minimumEvidence = Math.max(3, Math.ceil(elements * 0.005));
  const weak = !hex || count < minimumEvidence || DEFAULT_BROWSER_COLORS.has(hex);
  return { hex, count, weak, minimumEvidence };
}

function confidence(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '未提供';
  return `${Math.round(value * 100)}%`;
}

function formatCtaVerbs(verbs) {
  return list(verbs, entry => {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return '';
    const verb = scalar(entry.verb || entry.text || entry.value, '');
    if (!verb) return '';
    return entry.count ? `${verb}（${entry.count} 次）` : verb;
  });
}

function formatVariants(variants) {
  return list(variants, variant => {
    if (typeof variant === 'string') return variant;
    if (!variant || typeof variant !== 'object') return '';
    const name = scalar(variant.name, 'default');
    return variant.count ? `${name}（${variant.count}）` : name;
  });
}

function formatBreakpoints(breakpoints) {
  return list(breakpoints, bp => {
    if (typeof bp === 'number') return `${bp}px`;
    if (!bp || typeof bp !== 'object') return '';
    const value = number(bp.value, NaN);
    if (!Number.isFinite(value)) return '';
    const label = scalar(bp.label, '');
    const type = scalar(bp.type, '');
    return [label, type, `${value}px`].filter(Boolean).join(' · ');
  });
}

function bodyTypeSample(design) {
  const invalidTags = new Set(['head', 'style', 'meta', 'link', 'title', 'script', 'svg', 'path', 'defs', 'g']);
  const candidates = (design.typography?.scale || []).filter(item => {
    const size = number(item?.size, NaN);
    return Number.isFinite(size) && size >= 12 && size <= 32;
  });
  let best = null;
  let bestScore = -Infinity;
  for (const item of candidates) {
    const tags = list(item.tags, tag => scalar(tag, '').toLowerCase());
    const invalidCount = tags.filter(tag => invalidTags.has(tag)).length;
    const headingCount = tags.filter(tag => /^h[1-6]$/.test(tag)).length;
    const score = Math.min(number(item.count), 200)
      + (tags.includes('p') ? 1000 : 0)
      + (tags.includes('body') ? 300 : 0)
      + (tags.includes('div') || tags.includes('span') ? 50 : 0)
      - invalidCount * 50
      - headingCount * 200
      - Math.abs(number(item.size) - 16) * 2;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best || candidates[candidates.length - 1] || design.typography?.scale?.[0] || null;
}

function formatCodexTokens(design) {
  const tokens = formatDtcgTokens(design);
  const body = bodyTypeSample(design);
  if (body && tokens.semantic?.typography?.body?.$value) {
    tokens.semantic.typography.body.$value.fontSize = `${number(body.size)}px`;
    tokens.semantic.typography.body.$value.fontWeight = scalar(body.weight, '400');
    tokens.semantic.typography.body.$value.lineHeight = scalar(body.lineHeight, '1.5');
    tokens.semantic.typography.body.$extensions = {
      'nexpage/inference': 'body-like rendered text sample',
    };
  }
  return JSON.stringify(tokens, null, 2);
}

function formatCodexCssVars(design) {
  const seen = new Map();
  const used = new Set();
  return formatCssVars(design).split('\n').map(line => {
    const match = line.match(/^(\s*)(--[a-z0-9-]+)(:.*)$/i);
    if (!match) return line;
    const [, indent, original, rest] = match;
    const count = (seen.get(original) || 0) + 1;
    seen.set(original, count);
    let name = count === 1 ? original : `${original}-${count}`;
    while (used.has(name)) {
      const next = (seen.get(original) || count) + 1;
      seen.set(original, next);
      name = `${original}-${next}`;
    }
    used.add(name);
    return `${indent}${name}${rest}`;
  }).join('\n');
}

function activeKeyframes(motion) {
  return (motion?.keyframes || []).filter(keyframe =>
    keyframe?.used === true || number(keyframe?.usageCount) > 0
  );
}

function hasRealScrollSignal(motion) {
  return motion?.scrollLinked?.present === true &&
    (motion.scrollLinked.signals || []).some(signal =>
      typeof signal === 'string' && !/:none$/i.test(signal.trim())
    );
}

function hasMeaningfulMotion(motion) {
  if (!motion || typeof motion !== 'object') return false;
  return ['durations', 'easings', 'springs'].some(key =>
    Array.isArray(motion[key]) && motion[key].length > 0
  ) || activeKeyframes(motion).length > 0 || hasRealScrollSignal(motion);
}

function formatCodexMotion(motion) {
  const tokens = JSON.parse(formatMotionTokens(motion));
  const keyframes = activeKeyframes(motion);
  if (keyframes.length) tokens.keyframes = keyframes;
  if (hasRealScrollSignal(motion)) {
    tokens.scrollLinked = {
      present: true,
      signals: motion.scrollLinked.signals.filter(signal => !/:none$/i.test(signal.trim())),
    };
  }
  return JSON.stringify(tokens, null, 2);
}

function addTable(lines, headers, rows) {
  if (!rows.length) {
    lines.push('暂无可靠数据。', '');
    return;
  }
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`|${headers.map(() => '---').join('|')}|`);
  for (const row of rows) {
    lines.push(`| ${row.map(cell => scalar(cell).replace(/\|/g, '\\|')).join(' | ')} |`);
  }
  lines.push('');
}

export function formatCodexContext(design, options = {}) {
  const title = scalar(design.meta?.title, scalar(options.hostname, 'Extracted Website'));
  const source = scalar(design.meta?.url, '未记录');
  const elements = number(design.meta?.elementCount);
  const pageType = scalar(design.pageIntent?.type, 'unknown');
  const material = scalar(design.materialLanguage?.label, 'unknown');
  const imagery = scalar(design.imageryStyle?.label, 'unknown');
  const grade = scalar(design.score?.grade);
  const score = design.score?.overall;
  const primary = primaryReliability(design);
  const lines = [];

  lines.push(`# ${title} — Codex Design Context`, '');
  lines.push('> 这是一份由 nexpage 根据实际渲染页面生成的开发上下文。它用于迁移视觉语言，不用于复制原网站的品牌、Logo、文案或产品信息。', '');
  lines.push(`- 来源页面：${source}`);
  lines.push(`- 分析元素：${elements} 个`);
  lines.push(`- 页面类型：${pageType}（推断置信度 ${confidence(design.pageIntent?.confidence)}）`);
  lines.push(`- 设计评分：${grade}${typeof score === 'number' ? ` · ${score}/100` : ''}`);
  lines.push('');

  lines.push('## 使用顺序', '');
  lines.push('1. 先查看 `reference.png`，以截图中的视觉比例、色彩占比和整体气质为最高视觉依据。');
  lines.push('2. 阅读本文件，理解布局、组件、排版和实现约束。');
  lines.push('3. 将 `variables.css` 接入项目，优先复用其中的 CSS Variables。');
  lines.push('4. 需要结构化 Token 时读取 `tokens.json`。');
  if (hasMeaningfulMotion(design.motion)) {
    lines.push('5. 需要动效时读取 `motion.json`；只迁移动效语言，不照搬原网站交互。');
  }
  lines.push('');

  lines.push('## 视觉方向', '');
  lines.push(`- 页面用途：${pageType}`);
  lines.push(`- 材质语言：${material}（推断置信度 ${confidence(design.materialLanguage?.confidence)}）`);
  lines.push(`- 图像风格：${imagery}（推断置信度 ${confidence(design.imageryStyle?.confidence)}）`);
  const strengths = list(design.score?.strengths);
  if (strengths.length) lines.push(`- 设计优势：${strengths.join('；')}`);
  lines.push('- 实现目标：继承视觉节奏和设计语法，同时使用新产品自己的信息架构、内容与品牌资产。', '');

  lines.push('## 颜色系统', '');
  if (primary.hex) {
    const label = primary.weak ? '低可信候选' : '主要候选';
    lines.push(`- 主色${label}：\`${primary.hex}\`（检测到 ${primary.count} 次）`);
    if (primary.weak) {
      lines.push('- 该颜色的使用证据偏少或接近浏览器默认色，不应作为硬性品牌规则；请以 `reference.png` 和高频颜色分布校验。');
    }
  }
  const secondary = colorHex(design.colors?.secondary);
  const accent = colorHex(design.colors?.accent);
  if (secondary) {
    const note = DEFAULT_BROWSER_COLORS.has(secondary) ? '（接近浏览器默认色，必须结合截图校验）' : '';
    lines.push(`- 次要色候选：\`${secondary}\`${note}`);
  }
  if (accent) {
    const note = DEFAULT_BROWSER_COLORS.has(accent) ? '（接近浏览器默认色，必须结合截图校验）' : '';
    lines.push(`- 强调色候选：\`${accent}\`${note}`);
  }
  lines.push('');

  const colorRows = (design.colors?.all || [])
    .filter(entry => colorHex(entry))
    .sort((a, b) => colorCount(b) - colorCount(a))
    .slice(0, 10)
    .map(entry => [
      `\`${colorHex(entry)}\``,
      colorCount(entry),
      list(entry.contexts).join('、') || '未分类',
    ]);
  lines.push('页面高频颜色：', '');
  addTable(lines, ['颜色', '出现次数', '检测到的用途'], colorRows);

  lines.push('## 排版系统', '');
  const familyRows = (design.typography?.families || []).slice(0, 8).map(family => [
    scalar(family.name),
    number(family.count),
    scalar(family.usage, '未分类'),
  ]);
  addTable(lines, ['字体', '使用次数', '检测用途'], familyRows);

  const scaleRows = (design.typography?.scale || []).slice(0, 10).map(item => [
    `${number(item.size)}px`,
    scalar(item.weight, '400'),
    scalar(item.lineHeight),
    list(item.tags).join('、') || '未分类',
    number(item.count),
  ]);
  lines.push('主要字号样本：', '');
  addTable(lines, ['字号', '字重', '行高', '出现标签', '次数'], scaleRows);
  lines.push('排版标签来自页面统计，不要仅凭字号数组把最大字号定义为正文；标题与正文角色应结合截图和元素标签判断。', '');

  lines.push('## 布局与间距', '');
  lines.push(`- Flex 容器：${number(design.layout?.flexCount)} 个`);
  lines.push(`- Grid 容器：${number(design.layout?.gridCount)} 个`);
  const containers = list(design.layout?.containerWidths, item => {
    if (!item || typeof item !== 'object') return '';
    return `${scalar(item.maxWidth, 'auto')}（padding ${scalar(item.padding, '未记录')}）`;
  });
  if (containers.length) lines.push(`- 主要容器：${containers.join('；')}`);
  const spacing = list(design.spacing?.scale, value => `${value}px`);
  if (spacing.length) lines.push(`- 观察到的间距：${spacing.join(' · ')}`);
  const radii = list(design.borders?.radii, radius => {
    if (!radius || typeof radius !== 'object') return '';
    return `${scalar(radius.label, 'unnamed')}=${number(radius.value)}px`;
  });
  if (radii.length) lines.push(`- 圆角：${radii.join(' · ')}`);
  const breakpoints = formatBreakpoints(design.breakpoints);
  if (breakpoints.length) lines.push(`- 断点：${breakpoints.join('；')}`);
  lines.push('- 这些是页面观察值，不代表每个数值都应成为语义 Token；优先选择高频且能形成稳定节奏的值。', '');

  lines.push('## 组件模式', '');
  const componentRows = (design.componentAnatomy || []).slice(0, 12).map(component => [
    scalar(component.kind),
    number(component.totalInstances),
    formatVariants(component.variants).join('、') || 'default',
    Object.entries(component.slots || {}).filter(([, enabled]) => enabled).map(([name]) => name).join('、') || '未识别',
  ]);
  addTable(lines, ['组件', '实例数', '变体', '槽位'], componentRows);
  lines.push('重复组件应抽成项目组件并复用；组件结构是统计推断，创建前应对照 `reference.png`。', '');

  lines.push('## 页面结构参考', '');
  const order = list(design.sectionRoles?.readingOrder);
  if (order.length) lines.push(`- 检测顺序：${order.join(' → ')}`);
  const sectionRows = (design.sectionRoles?.sections || []).slice(0, 24).map((section, index) => [
    index + 1,
    scalar(section.role, 'content'),
    scalar(section.heading),
    confidence(section.confidence),
  ]);
  addTable(lines, ['序号', '角色', '标题', '置信度'], sectionRows);

  lines.push('## 文案与品牌语气', '');
  lines.push(`- 语气：${scalar(design.voice?.tone, '未识别')}`);
  lines.push(`- 人称倾向：${scalar(design.voice?.pronoun, '未识别')}`);
  lines.push(`- 标题风格：${scalar(design.voice?.headingStyle?.case, '未识别')} · ${scalar(design.voice?.headingStyle?.lengthClass, '未识别')}`);
  const verbs = formatCtaVerbs(design.voice?.ctaVerbs);
  if (verbs.length) lines.push(`- CTA 动词：${verbs.join('、')}`);
  lines.push('- 只迁移语气和表达节奏；不要复用原网站的品牌名、产品承诺或整句文案。', '');

  if (hasMeaningfulMotion(design.motion)) {
    lines.push('## 动效语言', '');
    lines.push(`- 整体感觉：${scalar(design.motion?.feel, '未分类')}`);
    const durations = list(design.motion?.durations, item => {
      if (!item || typeof item !== 'object') return '';
      return `${scalar(item.name, 'duration')}=${scalar(item.css, `${number(item.ms)}ms`)}`;
    });
    if (durations.length) lines.push(`- 时长：${durations.join(' · ')}`);
    const easings = list(design.motion?.easings, item => scalar(item?.raw || item?.family, ''));
    if (easings.length) lines.push(`- 缓动：${easings.join(' · ')}`);
    const keyframes = activeKeyframes(design.motion);
    if (keyframes.length) lines.push(`- 已使用 Keyframes：${keyframes.map(item => scalar(item.name)).join(' · ')}`);
    lines.push('- 尊重 `prefers-reduced-motion`，动画不能阻碍阅读和操作。', '');
  }

  lines.push('## Codex 实现规则', '');
  lines.push('1. 先阅读项目现有技术栈和组件体系，再决定如何接入这些 Token。');
  lines.push('2. 以 `reference.png` 判断视觉比例，以本文件判断设计规则，以 `tokens.json` 和 `variables.css` 提供精确数值。');
  lines.push('3. 不复制原网站的 Logo、品牌名、专有文案和产品信息；只迁移抽象的视觉语言。');
  lines.push('4. 优先使用语义化组件、响应式布局和可维护的 CSS，不按截图堆叠绝对坐标。');
  lines.push('5. 重复 UI 必须组件化；颜色、间距、圆角和字体优先引用变量。');
  lines.push('6. 截图与自动推断冲突时，以截图和实际产品需求为准，并在实现说明中记录取舍。');
  lines.push('7. 完成后运行项目检查，并截图对比整体气质、留白、字号层级和颜色占比。', '');

  lines.push('## 数据可信度与限制', '');
  lines.push('- 当前参考图通常是单一视口截图，不能单独证明移动端和其他断点的最终布局。');
  lines.push('- 页面角色、主色、材质语言和组件类型包含启发式推断，必须结合截图判断。');
  lines.push('- 动态 Canvas、WebGL、视频和复杂交互不一定能还原为可编辑结构。');
  if (primary.weak) lines.push(`- 主色候选 ${primary.hex} 证据不足，禁止把它当作不可更改的品牌结论。`);
  const lowConfidenceSections = (design.sectionRoles?.sections || []).filter(section => number(section.confidence) < 0.5).length;
  if (lowConfidenceSections) lines.push(`- 有 ${lowConfidenceSections} 个页面区域的语义识别置信度低于 50%。`);
  for (const warning of list(design.warnings).slice(0, 8)) lines.push(`- 提取警告：${warning}`);
  for (const issue of list(design.score?.issues).slice(0, 8)) lines.push(`- 设计分析：${issue}`);
  lines.push('');

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function buildCodexContextFiles(design, options = {}) {
  const files = {
    'CODEX.md': formatCodexContext(design, options),
    'tokens.json': formatCodexTokens(design),
    'variables.css': formatCodexCssVars(design),
  };
  if (hasMeaningfulMotion(design.motion)) {
    files['motion.json'] = formatCodexMotion(design.motion);
  }
  return files;
}

export function isCodexProfile(args) {
  if (!Array.isArray(args)) return false;
  const index = args.indexOf('--profile');
  return index >= 0 && args[index + 1] === 'codex';
}

export function isWithCodex(args) {
  return Array.isArray(args) && args.includes('--with-codex');
}

export function writeCodexContextPack({ design, outDir, screenshotPath, hostname }) {
  if (!design || typeof design !== 'object') throw new TypeError('design is required');
  if (typeof outDir !== 'string' || !outDir) throw new TypeError('outDir is required');

  const directory = join(outDir, 'codex-context');
  mkdirSync(directory, { recursive: true });
  const files = buildCodexContextFiles(design, { hostname });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(directory, name), content, 'utf8');
  }

  const motionPath = join(directory, 'motion.json');
  if (!Object.hasOwn(files, 'motion.json') && existsSync(motionPath)) unlinkSync(motionPath);

  const written = Object.keys(files);
  const referencePath = join(directory, 'reference.png');
  if (typeof screenshotPath === 'string' && existsSync(screenshotPath)) {
    if (screenshotPath !== referencePath) copyFileSync(screenshotPath, referencePath);
    written.push('reference.png');
  }

  return { directory, files: written };
}
