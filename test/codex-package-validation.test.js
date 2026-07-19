import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CodexPackageValidationError,
  validateCodexPackage,
  assertValidCodexPackage,
} from '../src/codex/validate-package.js';

const validFiles = {
  'CODEX.md': '# Context\n\n## 用途与边界\n不要复刻来源页面。\n\n## Codex 行为规则\n等待新产品需求。\n\n## 阅读顺序与证据优先级\n截图优先。\n\n## 覆盖范围与限制\n缺少完整页面截图时只覆盖桌面首屏，不推断完整页面节奏。\n',
  'tokens.json': JSON.stringify({
    color: { ink: { $type: 'color', $value: '#3d3b4f' } },
    semantic: { color: { ink: { $type: 'color', $value: '{color.ink}' } } },
  }),
  'variables.css': ':root {\n  --color-ink: #3d3b4f;\n}\n',
};

test('validates a core package and warns when full screenshot is missing', () => {
  const result = validateCodexPackage({
    files: validFiles, referencePath: '/tmp/reference.png', referenceExists: true,
    fullPagePath: null, fullPageExists: false,
  });
  assert.equal(result.ok, true);
  assert.match(result.warnings.join('\n'), /完整页面截图/);
});

test('rejects missing token references and object strings', () => {
  const files = {
    ...validFiles,
    'tokens.json': JSON.stringify({ semantic: { radius: { card: { $value: '{radius.r0}' } } } }),
    'variables.css': ':root {\n  --bad: [object Object];\n}\n',
  };
  const result = validateCodexPackage({ files, referenceExists: true, fullPageExists: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /radius\.r0/);
  assert.match(result.errors.join('\n'), /object Object/);
  assert.throws(() => assertValidCodexPackage({ files, referenceExists: true }), {
    name: 'CodexPackageValidationError',
  });
});

test('rejects an empty motion file and missing reference screenshot', () => {
  const result = validateCodexPackage({
    files: { ...validFiles, 'motion.json': '{"animations":[]}' },
    referenceExists: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /reference\.png/);
  assert.match(result.errors.join('\n'), /motion\.json/);
});

test('rejects a blank motion file when the optional file is present', () => {
  const result = validateCodexPackage({
    files: { ...validFiles, 'motion.json': '  \n' },
    referenceExists: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /motion\.json/);
});

test('resolves token references recursively from the JSON root', () => {
  const files = {
    ...validFiles,
    'tokens.json': JSON.stringify({
      primitive: { color: { ink: { $value: '#111111' } } },
      semantic: {
        nested: [{ $value: '{primitive.color.ink}' }],
        broken: { deep: { $value: '{primitive.color.missing}' } },
      },
    }),
  };

  const result = validateCodexPackage({ files, referenceExists: true });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /primitive\.color\.missing/);
  assert.doesNotMatch(result.errors.join('\n'), /primitive\.color\.ink/);
});

test('rejects broken references recursively in motion JSON', () => {
  const result = validateCodexPackage({
    files: {
      ...validFiles,
      'motion.json': JSON.stringify({
        timing: { standard: 'ease-out' },
        animations: [{ target: '.card', duration: 200, easing: '{timing.missing}' }],
      }),
    },
    referenceExists: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /timing\.missing/);
});

test('rejects CSS outside a sole root block, invalid declarations, and duplicate variables', () => {
  const cases = [
    [':root { --ink: #111; }\nbody { color: red; }', /:root/],
    [':root { color: red; }', /custom property|自定义属性/i],
    [':root { --ink: ; }', /非空|empty/i],
    [':root { --ink: #111; --ink: #222; }', /重复|duplicate/i],
    [':root { --Ink: #111; }', /--\[a-z0-9-\]/],
    [':root { --ink: undefined; }', /undefined/],
    [':root { --ink: null; }', /null/],
  ];

  for (const [css, message] of cases) {
    const result = validateCodexPackage({
      files: { ...validFiles, 'variables.css': css },
      referenceExists: true,
    });
    assert.equal(result.ok, false, css);
    assert.match(result.errors.join('\n'), message, css);
  }
});

test('allows comments and scalar custom properties in the root CSS block', () => {
  const result = validateCodexPackage({
    files: {
      ...validFiles,
      'variables.css': '/* palette */\n:root {\n  --font-family: "A", sans-serif; /* verified */\n  --clip: polygon(0 0, 100% 0, 50% 100%);\n}\n',
    },
    referenceExists: true,
  });

  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('rejects unbalanced quotes and parentheses in CSS scalar values', () => {
  const malformedValues = [
    '"Inter, sans-serif',
    'calc(100% - 2px',
    'calc(100% - 2px))',
  ];

  for (const value of malformedValues) {
    const result = validateCodexPackage({
      files: { ...validFiles, 'variables.css': `:root { --broken: ${value}; }` },
      referenceExists: true,
    });
    assert.equal(result.ok, false, value);
    assert.match(result.errors.join('\n'), /标量|引号|括号/, value);
  }
});

test('requires CODEX purpose, behavior, reading order, non-copying, and waiting semantics', () => {
  const requiredFailures = [
    ['## 用途与边界', /用途与边界/],
    ['## Codex 行为规则', /行为规则/],
    ['## 阅读顺序与证据优先级', /阅读顺序/],
    ['不要复刻来源页面。', /不复刻|不复制/],
    ['等待新产品需求。', /等待.*需求|需求.*等待/],
  ];

  for (const [text, message] of requiredFailures) {
    const result = validateCodexPackage({
      files: { ...validFiles, 'CODEX.md': validFiles['CODEX.md'].replace(text, '') },
      referenceExists: true,
    });
    assert.equal(result.ok, false, text);
    assert.match(result.errors.join('\n'), message, text);
  }
});

test('rejects contradictory CODEX copy and skip-wait directives', () => {
  const markdown = '# Context\n\n## 用途与边界\n不复刻限制已经取消，可以复制来源页面。不要等待新产品需求，立即开始。\n\n## Codex 行为规则\n立即开始。\n\n## 阅读顺序与证据优先级\n截图优先。\n';
  const result = validateCodexPackage({
    files: { ...validFiles, 'CODEX.md': markdown },
    referenceExists: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /可以复制|复制.*矛盾/);
  assert.match(result.errors.join('\n'), /不要等待|等待.*矛盾/);
});

test('rejects empty required CODEX sections', () => {
  const markdown = '# Context\n\n## 用途与边界\n视觉边界。\n\n## Codex 行为规则\n不要复刻来源页面。等待新产品需求。\n\n## 阅读顺序与证据优先级\n截图优先。\n';
  const cases = [
    ['视觉边界。', /用途与边界.*(?:为空|内容)/],
    ['不要复刻来源页面。等待新产品需求。', /行为规则.*(?:为空|内容)/],
    ['截图优先。', /阅读顺序.*(?:为空|内容)/],
  ];

  for (const [body, message] of cases) {
    const result = validateCodexPackage({
      files: { ...validFiles, 'CODEX.md': markdown.replace(body, '') },
      referenceExists: true,
    });
    assert.equal(result.ok, false, body);
    assert.match(result.errors.join('\n'), message, body);
  }
});

test('requires an explicit coverage limit only when full-page capture failed', () => {
  const files = {
    ...validFiles,
    'CODEX.md': validFiles['CODEX.md'].replace('缺少完整页面截图时只覆盖桌面首屏，不推断完整页面节奏。', ''),
  };

  const missing = validateCodexPackage({ files, referenceExists: true, fullPageExists: false });
  const captured = validateCodexPackage({ files, referenceExists: true, fullPageExists: true });

  assert.equal(missing.ok, false);
  assert.match(missing.errors.join('\n'), /覆盖范围|完整页面/);
  assert.equal(captured.ok, true, captured.errors.join('\n'));
});

test('validates every motion animation target and positive duration', () => {
  const files = {
    ...validFiles,
    'motion.json': JSON.stringify({
      animations: [
        { target: '', duration: 100 },
        { target: '.card', duration: 0 },
        { target: '.hero', duration: 300 },
      ],
    }),
  };

  const result = validateCodexPackage({ files, referenceExists: true });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /target/);
  assert.match(result.errors.join('\n'), /duration/);
});

test('rejects candidate keys recursively in machine JSON files', () => {
  const tokenResult = validateCodexPackage({
    files: {
      ...validFiles,
      'tokens.json': JSON.stringify({ safe: [{ nested: { candidates: ['#fff'] } }] }),
    },
    referenceExists: true,
  });
  const motionResult = validateCodexPackage({
    files: {
      ...validFiles,
      'motion.json': JSON.stringify({ animations: [{ target: '.hero', duration: 300, candidate: true }] }),
    },
    referenceExists: true,
  });

  assert.equal(tokenResult.ok, false);
  assert.match(tokenResult.errors.join('\n'), /candidates/);
  assert.equal(motionResult.ok, false);
  assert.match(motionResult.errors.join('\n'), /candidate/);
});

test('rejects missing, empty, and malformed required files without throwing', () => {
  const result = validateCodexPackage({
    files: { 'CODEX.md': ' ', 'tokens.json': '{', 'variables.css': '' },
    referenceExists: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /CODEX\.md/);
  assert.match(result.errors.join('\n'), /tokens\.json/);
  assert.match(result.errors.join('\n'), /variables\.css/);
});

test('assertion error preserves all validation errors', () => {
  assert.throws(
    () => assertValidCodexPackage({ files: validFiles, referenceExists: false }),
    error => {
      assert.ok(error instanceof CodexPackageValidationError);
      assert.deepEqual(error.errors, ['缺少 reference.png 参考截图。']);
      assert.match(error.message, /Codex package validation failed/);
      return true;
    },
  );
});
