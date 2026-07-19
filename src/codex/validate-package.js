const REQUIRED_FILES = ['CODEX.md', 'tokens.json', 'variables.css'];
const TOKEN_REFERENCE = /^\{([a-zA-Z0-9_$-]+(?:\.[a-zA-Z0-9_$-]+)*)\}$/;

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function resolvePath(root, path) {
  let current = root;
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || !hasOwn(current, part)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

function inspectMachineValue(value, fileName, errors, options = {}, path = '$') {
  if (typeof value === 'string') {
    const reference = options.references && value.match(TOKEN_REFERENCE);
    if (reference && !resolvePath(options.root, reference[1])) {
      errors.push(`${fileName} 包含断裂引用 ${reference[1]}（位于 ${path}）。`);
    }
    return;
  }

  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectMachineValue(item, fileName, errors, options, `${path}[${index}]`));
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`;
    if (key === 'candidate' || key === 'candidates') {
      errors.push(`${fileName} 的机器数据不得包含 ${key} 键（位于 ${itemPath}）。`);
    }
    inspectMachineValue(item, fileName, errors, options, itemPath);
  }
}

function parseJsonFile(files, fileName, errors) {
  const source = files[fileName];
  if (typeof source !== 'string' || source.trim() === '') return null;
  try {
    return JSON.parse(source);
  } catch (error) {
    errors.push(`${fileName} 不是有效 JSON：${error.message}`);
    return null;
  }
}

function isBalancedCssScalar(value) {
  let quote = null;
  let escaped = false;
  const delimiters = [];

  for (const character of value) {
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(' || character === '[') {
      delimiters.push(character);
    } else if (character === ')' || character === ']') {
      const expected = character === ')' ? '(' : '[';
      if (delimiters.pop() !== expected) return false;
    }
  }

  return quote === null && delimiters.length === 0;
}

function validateCss(source, errors) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const root = withoutComments.match(/^\s*:root\s*\{([\s\S]*)\}\s*$/);
  if (!root || /[{}]/.test(root[1])) {
    errors.push('variables.css 必须只包含一个 :root 块。');
    return;
  }

  const body = root[1];
  const names = new Set();
  const declaration = /--([a-z0-9-]+)\s*:\s*([^;{}]*?)\s*;/y;
  let position = 0;

  while (position < body.length) {
    const whitespace = body.slice(position).match(/^\s+/);
    if (whitespace) {
      position += whitespace[0].length;
      continue;
    }

    declaration.lastIndex = position;
    const match = declaration.exec(body);
    if (!match) {
      const rest = body.slice(position);
      if (/^--[a-z0-9-]+\s*:\s*;/.test(rest)) {
        errors.push('variables.css 的自定义属性必须使用非空标量值。');
      } else if (/^--/.test(rest)) {
        errors.push('variables.css 的变量名必须匹配 --[a-z0-9-]+。');
      } else {
        errors.push('variables.css 的 :root 中只能包含 custom property 自定义属性声明。');
      }
      return;
    }

    const [, name, rawValue] = match;
    const value = rawValue.trim();
    if (!value) {
      errors.push(`variables.css 的 --${name} 必须使用非空标量值。`);
    }
    if (!isBalancedCssScalar(value)) {
      errors.push(`variables.css 的 --${name} 标量值包含未配对的引号、圆括号或方括号。`);
    }
    if (/\[object Object\]|\bundefined\b|\bnull\b/i.test(value)) {
      const invalid = value.match(/\[object Object\]|\bundefined\b|\bnull\b/i)?.[0];
      errors.push(`variables.css 的 --${name} 包含非法值 ${invalid}。`);
    }
    if (names.has(name)) {
      errors.push(`variables.css 包含重复变量 --${name}。`);
    }
    names.add(name);
    position = declaration.lastIndex;
  }
}

function stripFencedCodeBlocks(markdown) {
  const lines = markdown.split('\n');
  let fence = null;

  return lines.map(line => {
    if (fence) {
      const closing = line.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) {
        fence = null;
      }
      return '';
    }

    const opening = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (opening) {
      fence = opening[1];
      return '';
    }
    return line;
  }).join('\n');
}

function stripHtmlComments(markdown) {
  return markdown.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
}

function getMarkdownSectionBody(markdown, titlePattern) {
  const headings = [...markdown.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)];
  const sectionIndex = headings.findIndex(match => match[1].length === 2 && titlePattern.test(match[2]));
  if (sectionIndex === -1) return null;

  const section = headings[sectionIndex];
  const next = headings.slice(sectionIndex + 1).find(match => match[1].length <= 2);
  const body = markdown.slice(section.index + section[0].length, next?.index ?? markdown.length);
  return body.replace(/^#{3,6}\s+.*$/gm, '').trim();
}

function validateCodexMarkdown(markdown, fullPageExists, errors) {
  const prose = stripFencedCodeBlocks(stripHtmlComments(markdown));
  const requiredSections = [
    ['用途与边界', /^用途与边界$/],
    ['行为规则', /^(?:Codex\s*)?行为规则$/i],
    ['阅读顺序', /^阅读顺序(?:与证据优先级)?$/],
  ];
  const sections = new Map();

  for (const [name, titlePattern] of requiredSections) {
    const body = getMarkdownSectionBody(prose, titlePattern);
    sections.set(name, body);
    if (body === null) {
      errors.push(`CODEX.md 缺少“${name}”部分。`);
    } else if (body === '') {
      errors.push(`CODEX.md 的“${name}”部分内容不得为空。`);
    }
  }

  const directiveText = `${sections.get('用途与边界') || ''}\n${sections.get('行为规则') || ''}`;
  const directiveLines = directiveText
    .split('\n')
    .filter(line => line.trim() && !/^(?: {4}|\t)/.test(line) && !line.includes('`'))
    .map(line => line.trim());
  const invalidation = /废止|作废|取消|解除|无效|不再适用|失效|废除/;
  const directiveMeaning = /规则|限制|要求|指令|等待|需求|复制|复刻/;
  const permissionToCopy = /(?:(?:可以|允许|准许)[^。\n]{0,12}(?:复制|复刻)|(?:复制|复刻)[^。\n]{0,12}(?:可以|允许|准许))/;
  const invalidationConflict = directiveLines.some(line => invalidation.test(line) && directiveMeaning.test(line));
  const copyConflict = directiveLines.some(line =>
    (/(?:复制|复刻)/.test(line) && invalidation.test(line)) || permissionToCopy.test(line));
  const waitConflict = directiveLines.some(line =>
    (/(?:等待|新产品需求)/.test(line) && invalidation.test(line))
    || /(?:不要|无需|不用|跳过)[^。\n]{0,8}等待/.test(line)
    || /(?:立即|马上)开始/.test(line));
  const copyDirective = /^(?:-\s+)?[^。\n]*(?:不要复刻来源页面|不用于复刻来源页面|不复制来源品牌[^。\n]*)。?$/;
  const waitDirective = /^(?:-\s+)?(?:等待新产品需求|如果尚未收到新产品需求，[^。\n]*等待用户继续说明需求)。?$/;

  if (invalidationConflict) {
    errors.push('CODEX.md 包含使规则失效的矛盾指令。');
  }
  if (copyConflict) {
    errors.push('CODEX.md 包含“可以复制”或取消不复刻限制的矛盾指令。');
  }
  if (waitConflict) {
    errors.push('CODEX.md 包含“不要等待”需求的矛盾指令。');
  }
  if (!directiveLines.some(line => copyDirective.test(line))) {
    errors.push('CODEX.md 必须明确不复刻或不复制来源页面。');
  }
  if (!directiveLines.some(line => waitDirective.test(line))) {
    errors.push('CODEX.md 必须明确等待新产品需求。');
  }

  if (fullPageExists === false) {
    const hasCoverageLimit = /只覆盖[^\n。]*(?:桌面)?首屏[^\n。]*不(?:得|要|应)?推断[^\n。]*(?:完整页面|页面节奏)/.test(prose);
    if (!hasCoverageLimit) {
      errors.push('缺少完整页面截图时，CODEX.md 必须说明只覆盖桌面首屏且不得推断完整页面节奏。');
    }
  }
}

function validateMotion(motion, errors) {
  if (!motion || typeof motion !== 'object' || !Array.isArray(motion.animations) || motion.animations.length === 0) {
    errors.push('motion.json 的 animations 必须是非空数组。');
    return;
  }

  motion.animations.forEach((animation, index) => {
    if (!animation || typeof animation !== 'object' || typeof animation.target !== 'string' || animation.target.trim() === '') {
      errors.push(`motion.json animations[${index}].target 必须是非空字符串。`);
    }
    if (!animation || typeof animation !== 'object' || typeof animation.duration !== 'number' || !Number.isFinite(animation.duration) || animation.duration <= 0) {
      errors.push(`motion.json animations[${index}].duration 必须大于 0。`);
    }
  });
}

export class CodexPackageValidationError extends Error {
  constructor(errors) {
    super(`Codex package validation failed:\n- ${errors.join('\n- ')}`);
    this.name = 'CodexPackageValidationError';
    this.errors = errors;
  }
}

export function validateCodexPackage(input = {}) {
  const errors = [];
  const warnings = [];
  const files = input.files && typeof input.files === 'object' ? input.files : {};

  for (const fileName of REQUIRED_FILES) {
    if (typeof files[fileName] !== 'string' || files[fileName].trim() === '') {
      errors.push(`必需文件 ${fileName} 不存在或为空。`);
    }
  }

  if (input.referenceExists !== true) {
    errors.push('缺少 reference.png 参考截图。');
  }
  if (input.fullPageExists === false) {
    warnings.push('缺少完整页面截图，将限制为桌面首屏覆盖。');
  }

  const tokens = parseJsonFile(files, 'tokens.json', errors);
  if (tokens !== null) {
    inspectMachineValue(tokens, 'tokens.json', errors, { references: true, root: tokens });
  }

  if (typeof files['variables.css'] === 'string' && files['variables.css'].trim() !== '') {
    validateCss(files['variables.css'], errors);
  }

  if (typeof files['CODEX.md'] === 'string' && files['CODEX.md'].trim() !== '') {
    validateCodexMarkdown(files['CODEX.md'], input.fullPageExists, errors);
  }

  if (hasOwn(files, 'motion.json')) {
    if (typeof files['motion.json'] !== 'string' || files['motion.json'].trim() === '') {
      errors.push('motion.json 存在时不得为空。');
    } else {
      const motion = parseJsonFile(files, 'motion.json', errors);
      if (motion !== null) {
        inspectMachineValue(motion, 'motion.json', errors, { references: true, root: motion });
        validateMotion(motion, errors);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertValidCodexPackage(input) {
  const result = validateCodexPackage(input);
  if (!result.ok) throw new CodexPackageValidationError(result.errors);
  return result;
}
