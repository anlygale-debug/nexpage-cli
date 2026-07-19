import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVerifiedContextFiles,
  formatVerifiedCodexContext,
  formatVerifiedTokens,
  formatVerifiedCss,
  formatVerifiedMotion,
} from '../src/codex/format-context.js';
import { buildVerifiedVisualModel } from '../src/codex/verified-model.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

const design = {
  meta: { url: 'https://www.greptile.com/', title: 'Greptile', elementCount: 1200 },
  spacing: { scale: [4, 8, 16, 24, 32, 64, 233] },
  motion: { keyframes: [{ name: 'float-code', used: true }, { name: 'grid-drift', used: true }] },
};
const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });

test('machine files contain verified values and no object strings', () => {
  const files = buildVerifiedContextFiles(model);
  assert.deepEqual(Object.keys(files).sort(), ['CODEX.md', 'motion.json', 'tokens.json', 'variables.css']);
  assert.doesNotMatch(files['variables.css'], /\[object Object\]|undefined|null/);
  assert.doesNotMatch(files['tokens.json'], /\[object Object\]|undefined/);
  assert.match(files['variables.css'], /--color-action-primary: #28e99f;/);
  assert.match(files['variables.css'], /--shape-action-primary-clip-path: polygon\(/);
});

test('tokens only create semantic references backed by primitive definitions', () => {
  const tokens = JSON.parse(formatVerifiedTokens(model));
  assert.equal(tokens.semantic.color.actionPrimary.$value, '{color.action-primary}');
  assert.equal(tokens.color['action-primary'].$value, '#28e99f');
  assert.equal(tokens.semantic.radius, undefined);
  assert.equal(tokens.semantic.shadow, undefined);
  assert.match(tokens.$extensions['nexpage/shapes'].actionPrimary.clipPath, /^polygon\(/);
});

test('CODEX context establishes style and waits for product requirements', () => {
  const markdown = formatVerifiedCodexContext(model);
  assert.match(markdown, /不要复刻来源页面/);
  assert.match(markdown, /尚未收到新产品需求.*等待/);
  assert.match(markdown, /先设计新产品自己的信息架构/);
  assert.doesNotMatch(markdown, /Hero.*Testimonials.*FAQ/i);
});

test('motion output preserves real target and duration', () => {
  const motion = JSON.parse(formatVerifiedMotion(model));
  assert.deepEqual(motion.animations.map(item => item.duration), [6000, 40000]);
  assert.equal(motion.animations[1].target, '.background-grid');
});

test('machine formatters omit object-like strings from scalar fields', () => {
  const unsafeModel = structuredClone(model);
  unsafeModel.verified.typography.body.value.weight = '[object Object]';

  assert.doesNotMatch(formatVerifiedTokens(unsafeModel), /\[object Object\]/);
  assert.doesNotMatch(formatVerifiedCss(unsafeModel), /\[object Object\]/);
});
