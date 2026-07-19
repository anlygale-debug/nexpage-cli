import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiedVisualModel } from '../src/codex/verified-model.js';
import { buildVerifiedContextFiles } from '../src/codex/format-context.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

const design = {
  meta: { url: 'https://www.greptile.com/', title: 'Greptile', elementCount: 1200 },
  spacing: { scale: [4, 8, 16, 24, 32, 64, 233] },
  motion: { keyframes: [{ name: 'float-code', used: true }, { name: 'grid-drift', used: true }] },
};

test('Greptile regression preserves the verified visual signature', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });
  const files = buildVerifiedContextFiles(model);
  const combined = Object.values(files).join('\n');

  assert.doesNotMatch(combined, /\[object Object\]|\{radius\.|\{shadow\./);
  assert.match(files['variables.css'], /#28e99f/);
  assert.match(files['variables.css'], /#3d3b4f/);
  assert.match(files['tokens.json'], /Anybody/);
  assert.match(files['tokens.json'], /DM Sans/);
  assert.match(files['tokens.json'], /Space Mono/);
  assert.match(files['tokens.json'], /polygon\(/);
  assert.match(files['motion.json'], /6000/);
  assert.match(files['motion.json'], /40000/);
  assert.doesNotMatch(files['CODEX.md'], /复制.*(Hero|Testimonials|FAQ)/i);
});
