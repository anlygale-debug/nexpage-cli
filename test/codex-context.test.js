import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as nexpage from '../src/index.js';

test('exports a Codex context formatter', () => {
  assert.equal(typeof nexpage.formatCodexContext, 'function');
});

function fixture(overrides = {}) {
  return {
    meta: {
      url: 'https://example.test/',
      title: 'Example Product',
      elementCount: 1000,
      timestamp: '2026-07-19T00:00:00.000Z',
    },
    score: { grade: 'A', overall: 92, issues: [], strengths: ['Consistent spacing'] },
    colors: {
      primary: { hex: '#635bff', count: 120, confidence: 0.9 },
      secondary: { hex: '#111111', count: 80, confidence: 0.8 },
      accent: { hex: '#ffdd33', count: 20, confidence: 0.7 },
      neutrals: [{ hex: '#111111' }, { hex: '#ffffff' }],
      backgrounds: ['#ffffff'],
      text: ['#111111'],
      all: [
        { hex: '#ffffff', count: 600, contexts: ['background'] },
        { hex: '#111111', count: 400, contexts: ['text'] },
        { hex: '#635bff', count: 120, contexts: ['background', 'text'] },
      ],
    },
    typography: {
      families: [
        { name: 'Example Sans', count: 900, usage: 'all' },
        { name: 'Example Mono', count: 100, usage: 'body' },
      ],
      scale: [
        { size: 64, weight: '700', lineHeight: '68px', tags: ['h1'], count: 2 },
        { size: 32, weight: '600', lineHeight: '38px', tags: ['h2'], count: 6 },
        { size: 16, weight: '400', lineHeight: '24px', tags: ['p'], count: 80 },
      ],
    },
    spacing: { base: 4, scale: [4, 8, 16, 24, 32, 64] },
    borders: { radii: [{ label: 'md', value: 12 }, { label: 'full', value: 999 }] },
    shadows: { values: [{ label: 'md', raw: '0 8px 24px rgba(0,0,0,.12)' }] },
    variables: {},
    breakpoints: [{ value: 768, label: 'md', type: 'min-width' }],
    layout: {
      gridCount: 4,
      flexCount: 20,
      containerWidths: [{ maxWidth: '1200px', padding: '32px' }],
      gaps: ['16px', '24px'],
    },
    componentAnatomy: [
      {
        kind: 'button',
        totalInstances: 8,
        slots: { label: true, icon: true },
        variants: [{ name: 'primary', count: 5 }, { name: 'secondary', count: 3 }],
      },
    ],
    sectionRoles: {
      readingOrder: ['nav', 'hero', 'feature-grid', 'cta', 'footer'],
      sections: [
        { role: 'hero', heading: 'Build faster', confidence: 0.85 },
        { role: 'feature-grid', heading: 'Features', confidence: 0.8 },
      ],
    },
    pageIntent: { type: 'landing', confidence: 0.9 },
    materialLanguage: { label: 'flat', confidence: 0.8 },
    imageryStyle: { label: 'product-screenshot', confidence: 0.7 },
    voice: {
      tone: 'direct',
      pronoun: 'you-only',
      headingStyle: { case: 'sentence', lengthClass: 'short' },
      ctaVerbs: [{ verb: 'start', count: 4 }, { verb: 'try', count: 2 }],
    },
    accessibility: { score: 96, failCount: 1 },
    motion: {
      durations: [{ name: 'fast', css: '160ms', ms: 160 }],
      easings: [{ family: 'ease-out', raw: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }],
      springs: [],
      keyframes: [],
      feel: 'snappy',
      scrollLinked: { present: false },
    },
    warnings: [],
    ...overrides,
  };
}

test('writes a self-contained CODEX.md without broken object serialization', () => {
  const markdown = nexpage.formatCodexContext(fixture(), { hostname: 'example-test' });

  for (const heading of [
    '# Example Product — Codex Design Context',
    '## 使用顺序',
    '## 视觉方向',
    '## 颜色系统',
    '## 排版系统',
    '## 布局与间距',
    '## 组件模式',
    '## 页面结构参考',
    '## Codex 实现规则',
    '## 数据可信度与限制',
  ]) {
    assert.match(markdown, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(markdown, /start.*4/);
  assert.doesNotMatch(markdown, /\[object Object\]|\bundefined\b|\bnull\b/);
  assert.doesNotMatch(markdown, /designlang/i);
});

test('marks weak primary-color inference as a candidate instead of a hard rule', () => {
  const design = fixture({
    colors: {
      ...fixture().colors,
      primary: { hex: '#0000ee', count: 2, confidence: 0.95 },
    },
  });

  const markdown = nexpage.formatCodexContext(design, { hostname: 'example-test' });

  assert.match(markdown, /#0000ee/);
  assert.match(markdown, /低可信候选/);
  assert.match(markdown, /reference\.png/);
  assert.doesNotMatch(markdown, /必须.*#0000ee/);
});

test('builds the exact default Codex package and adds motion only when meaningful', () => {
  assert.equal(typeof nexpage.buildCodexContextFiles, 'function');

  const withMotion = nexpage.buildCodexContextFiles(fixture(), { hostname: 'example-test' });
  assert.deepEqual(Object.keys(withMotion).sort(), [
    'CODEX.md',
    'motion.json',
    'tokens.json',
    'variables.css',
  ]);

  const withoutMotion = nexpage.buildCodexContextFiles(fixture({
    motion: { durations: [], easings: [], springs: [], keyframes: [], scrollLinked: { present: false } },
  }), { hostname: 'example-test' });
  assert.deepEqual(Object.keys(withoutMotion).sort(), [
    'CODEX.md',
    'tokens.json',
    'variables.css',
  ]);
});

test('recognizes only the explicit codex profile flag', () => {
  assert.equal(typeof nexpage.isCodexProfile, 'function');
  assert.equal(nexpage.isCodexProfile(['https://example.test', '--profile', 'codex']), true);
  assert.equal(nexpage.isCodexProfile(['https://example.test', '--profile', 'full']), false);
  assert.equal(nexpage.isCodexProfile(['https://example.test']), false);
  assert.equal(nexpage.isCodexProfile(['https://example.test', '--profile']), false);
});

test('recognizes the additive Codex flag separately from the exclusive profile', () => {
  assert.equal(typeof nexpage.isWithCodex, 'function');
  assert.equal(nexpage.isWithCodex(['https://example.test', '--with-codex']), true);
  assert.equal(nexpage.isWithCodex(['https://example.test', '--profile', 'codex']), false);
  assert.equal(nexpage.isWithCodex(['https://example.test']), false);
});

test('writes an isolated codex-context directory with a copied visual reference', () => {
  assert.equal(typeof nexpage.writeCodexContextPack, 'function');
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
    const screenshotPath = join(root, 'page-screenshot.png');
    writeFileSync(screenshotPath, 'fake-png');

    const result = nexpage.writeCodexContextPack({
      design: fixture(),
      outDir: root,
      screenshotPath,
      hostname: 'example-test',
    });

    assert.equal(result.directory, join(root, 'codex-context'));
    assert.deepEqual(result.files.sort(), [
      'CODEX.md',
      'motion.json',
      'reference.png',
      'tokens.json',
      'variables.css',
    ]);
    assert.equal(readFileSync(join(result.directory, 'reference.png'), 'utf8'), 'fake-png');
    assert.match(readFileSync(join(result.directory, 'CODEX.md'), 'utf8'), /Example Product/);
    assert.equal(existsSync(join(root, 'result.json')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('accepts a screenshot already stored as codex-context/reference.png', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-direct-test-'));
  try {
    const directory = join(root, 'codex-context');
    mkdirSync(directory, { recursive: true });
    const screenshotPath = join(directory, 'reference.png');
    writeFileSync(screenshotPath, 'direct-png');

    const result = nexpage.writeCodexContextPack({
      design: fixture(),
      outDir: root,
      screenshotPath,
      hostname: 'example-test',
    });

    assert.equal(readFileSync(screenshotPath, 'utf8'), 'direct-png');
    assert.equal(result.files.includes('reference.png'), true);
    assert.deepEqual(readdirSync(root), ['codex-context']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('omits false-positive motion and preserves keyframes that are actually used', () => {
  const falsePositive = fixture({
    motion: {
      durations: [],
      easings: [],
      springs: [],
      keyframes: [{ name: 'unusedFloat', used: false, usageCount: 0, steps: [] }],
      scrollLinked: { present: true, signals: ['view:none', 'scroll:none'] },
    },
  });
  const falsePositiveFiles = nexpage.buildCodexContextFiles(falsePositive, { hostname: 'example-test' });
  assert.equal(Object.hasOwn(falsePositiveFiles, 'motion.json'), false);

  const usedKeyframe = fixture({
    motion: {
      durations: [],
      easings: [],
      springs: [],
      keyframes: [{
        name: 'heroReveal',
        used: true,
        usageCount: 2,
        propertiesAnimated: ['opacity', 'transform'],
        steps: [{ offset: '0%', style: 'opacity: 0' }, { offset: '100%', style: 'opacity: 1' }],
      }],
      scrollLinked: { present: false, signals: [] },
      feel: 'calm',
    },
  });
  const usedFiles = nexpage.buildCodexContextFiles(usedKeyframe, { hostname: 'example-test' });
  const motion = JSON.parse(usedFiles['motion.json']);
  assert.equal(motion.keyframes[0].name, 'heroReveal');
  assert.equal(motion.keyframes[0].usageCount, 2);
});

test('uses a body-like typography sample instead of the largest heading in tokens.json', () => {
  const files = nexpage.buildCodexContextFiles(fixture(), { hostname: 'example-test' });
  const tokens = JSON.parse(files['tokens.json']);
  assert.equal(tokens.semantic.typography.body.$value.fontSize, '16px');
  assert.equal(tokens.semantic.typography.body.$value.fontWeight, '400');
});

test('keeps every CSS custom property name unique in the Codex package', () => {
  const design = fixture({
    borders: {
      radii: [
        { label: 'md', value: 8 },
        { label: 'md', value: 12 },
        { label: 'full', value: 999 },
      ],
    },
  });
  const files = nexpage.buildCodexContextFiles(design, { hostname: 'example-test' });
  const names = [...files['variables.css'].matchAll(/^\s*(--[a-z0-9-]+):/gim)].map(match => match[1]);
  assert.equal(new Set(names).size, names.length);
  assert.match(files['variables.css'], /--radius-md: 8px/);
  assert.match(files['variables.css'], /--radius-md-2: 12px/);
});

test('calls out browser-default colors wherever they appear as semantic candidates', () => {
  const design = fixture({
    colors: {
      ...fixture().colors,
      secondary: { hex: '#0000ee', count: 200, confidence: 0.9 },
    },
  });
  const markdown = nexpage.formatCodexContext(design, { hostname: 'example-test' });
  assert.match(markdown, /#0000ee.*浏览器默认色/);
});
