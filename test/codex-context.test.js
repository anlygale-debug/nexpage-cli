import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as nexpage from '../src/index.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

test('exports a Codex context formatter', () => {
  assert.equal(typeof nexpage.formatCodexContext, 'function');
  assert.equal(typeof nexpage.formatVerifiedCodexContext, 'function');
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

const verifiedOptions = {
  hostname: 'example-test',
  evidence: greptileEvidence,
  fullPageCaptured: true,
};

function fixtureWithVerifiedMotion() {
  return fixture({
    motion: {
      keyframes: [
        { name: 'float-code', used: true },
        { name: 'grid-drift', used: true },
      ],
    },
  });
}

test('writes a self-contained CODEX.md without broken object serialization', () => {
  const markdown = nexpage.formatCodexContext(fixture(), verifiedOptions);

  for (const heading of [
    '# Example Product — Codex 视觉上下文',
    '## 用途与边界',
    '## Codex 行为规则',
    '## 阅读顺序与证据优先级',
    '## 已验证视觉语言',
    '## 低可信候选',
    '## 抽象视觉节奏',
    '## 覆盖范围与限制',
  ]) {
    assert.match(markdown, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(markdown, /#28e99f/);
  assert.doesNotMatch(markdown, /\[object Object\]|\bundefined\b|\bnull\b/);
  assert.doesNotMatch(markdown, /designlang/i);
});

test('does not promote browser-default raw colors into verified context', () => {
  const design = fixture({
    colors: {
      ...fixture().colors,
      all: [...fixture().colors.all, { hex: '#0000ee', count: 200 }],
    },
  });

  const files = nexpage.buildCodexContextFiles(design, verifiedOptions);

  assert.doesNotMatch(files['CODEX.md'], /#0000ee/);
  assert.doesNotMatch(files['tokens.json'], /#0000ee/);
  assert.match(files['CODEX.md'], /低可信候选/);
});

test('builds the exact default Codex package and adds motion only when meaningful', () => {
  assert.equal(typeof nexpage.buildCodexContextFiles, 'function');

  const withMotion = nexpage.buildCodexContextFiles(fixtureWithVerifiedMotion(), verifiedOptions);
  assert.deepEqual(Object.keys(withMotion).sort(), [
    'CODEX.md',
    'motion.json',
    'tokens.json',
    'variables.css',
  ]);

  const withoutMotion = nexpage.buildCodexContextFiles(fixture({ motion: { keyframes: [] } }), verifiedOptions);
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
      design: fixtureWithVerifiedMotion(),
      outDir: root,
      screenshotPath,
      ...verifiedOptions,
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

test('omits unmatched motion and preserves rendered animations matched to used keyframes', () => {
  const falsePositive = fixture({
    motion: {
      durations: [],
      easings: [],
      springs: [],
      keyframes: [{ name: 'unusedFloat', used: false, usageCount: 0, steps: [] }],
      scrollLinked: { present: true, signals: ['view:none', 'scroll:none'] },
    },
  });
  const falsePositiveFiles = nexpage.buildCodexContextFiles(falsePositive, verifiedOptions);
  assert.equal(Object.hasOwn(falsePositiveFiles, 'motion.json'), false);

  const usedKeyframe = fixture({
    motion: {
      durations: [],
      easings: [],
      springs: [],
      keyframes: [{ name: 'float-code', used: true }],
    },
  });
  const usedFiles = nexpage.buildCodexContextFiles(usedKeyframe, verifiedOptions);
  const motion = JSON.parse(usedFiles['motion.json']);
  assert.equal(motion.animations[0].name, 'float-code');
  assert.equal(motion.animations[0].target, '.code-window');
});

test('uses a body-like typography sample instead of the largest heading in tokens.json', () => {
  const files = nexpage.buildCodexContextFiles(fixture(), verifiedOptions);
  const tokens = JSON.parse(files['tokens.json']);
  assert.equal(tokens.semantic.typography.body.$value, '{typography.body}');
  assert.equal(tokens.typography.body.$value.fontFamily, 'DM Sans');
  assert.equal(tokens.typography.body.$value.fontSize, '18px');
});

test('keeps every verified CSS custom property name unique', () => {
  const files = nexpage.buildCodexContextFiles(fixture(), verifiedOptions);
  const names = [...files['variables.css'].matchAll(/^\s*(--[a-z0-9-]+):/gim)].map(match => match[1]);
  assert.equal(new Set(names).size, names.length);
  assert.match(files['variables.css'], /--color-action-primary: #28e99f/);
  assert.match(files['variables.css'], /--shape-action-primary-clip-path: polygon\(/);
});

test('facade forwards partial full-page coverage into CODEX limitations', () => {
  const markdown = nexpage.formatCodexContext(fixture(), {
    ...verifiedOptions,
    fullPageCaptured: false,
    fullPageError: 'page height exceeded limit',
  });
  assert.match(markdown, /只覆盖桌面首屏/);
  assert.match(markdown, /page height exceeded limit/);
});
