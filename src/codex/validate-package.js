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

function validateCodexMarkdown(markdown, fullPageExists, errors) {
  const requirements = [
    [/^##\s+用途与边界\s*$/m, 'CODEX.md 缺少“用途与边界”部分。'],
    [/^##\s+(?:Codex\s*)?行为规则\s*$/im, 'CODEX.md 缺少“行为规则”部分。'],
    [/^##\s+阅读顺序(?:与证据优先级)?\s*$/m, 'CODEX.md 缺少“阅读顺序”部分。'],
    [/不(?:要|得|应)?(?:复刻|复制)/, 'CODEX.md 必须明确不复刻或不复制来源页面。'],
    [/(?:等待[^\n。]{0,40}需求|需求[^\n。]{0,40}等待)/, 'CODEX.md 必须明确等待新产品需求。'],
  ];

  for (const [pattern, message] of requirements) {
    if (!pattern.test(markdown)) errors.push(message);
  }

  if (fullPageExists === false) {
    const hasCoverageLimit = /只覆盖[^\n。]*(?:桌面)?首屏[^\n。]*不(?:得|要|应)?推断[^\n。]*(?:完整页面|页面节奏)/.test(markdown);
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
        inspectMachineValue(motion, 'motion.json', errors);
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
