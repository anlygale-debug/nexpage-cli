import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiedVisualModel } from '../src/codex/verified-model.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

const design = {
  meta: { url: 'https://www.greptile.com/', title: 'Greptile', elementCount: 1200 },
  colors: { all: [{ hex: '#0000ee', count: 22 }, { hex: '#28e99f', count: 4 }] },
  typography: { families: [], scale: [] },
  spacing: { scale: [4, 8, 16, 24, 32, 64, 233, 337] },
  borders: { radii: [] },
  shadows: { values: [] },
  motion: { keyframes: [{ name: 'float-code', used: true }, { name: 'grid-drift', used: true }] },
  sectionRoles: { readingOrder: ['hero', 'testimonials', 'faq'] },
};

test('model promotes rendered semantic evidence instead of raw frequency', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, {
    hostname: 'greptile-com', fullPageCaptured: true,
  });
  assert.equal(model.kind, 'nexpage-verified-visual-model');
  assert.equal(model.verified.colors.actionPrimary.value, '#28e99f');
  assert.equal(model.verified.colors.ink.value, '#3d3b4f');
  assert.ok(model.verified.materials.some(item => item.value.background === '#3d3b4f'));
  assert.equal(model.verified.typography.display.value.family, 'Anybody');
  assert.equal(model.verified.typography.body.value.family, 'DM Sans');
  assert.equal(model.verified.typography.mono.value.family, 'Space Mono');
  assert.match(model.verified.shapes.actionPrimary.value.clipPath, /^polygon\(/);
});

test('model rejects one-off measurements and source information architecture', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });
  const scale = model.verified.spacing.map(item => item.value);
  assert.equal(scale.includes(233), false);
  assert.equal(scale.includes(337), false);
  assert.equal(JSON.stringify(model.rhythm).includes('testimonials'), false);
  assert.equal(JSON.stringify(model.rhythm).includes('faq'), false);
  assert.ok(model.rejected.some(item => item.path.includes('spacing')));
});

test('model binds animation targets to actual durations', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });
  assert.deepEqual(model.verified.motion.map(item => item.value.duration), [6000, 40000]);
  assert.deepEqual(model.verified.motion.map(item => item.value.target), ['.code-window', '.background-grid']);
});

test('model records limited coverage without inventing full-page rhythm', () => {
  const model = buildVerifiedVisualModel(design, {
    ...greptileEvidence,
    surfaces: greptileEvidence.surfaces.slice(0, 1),
  }, { fullPageCaptured: false, fullPageError: 'page height exceeded limit' });
  assert.equal(model.coverage.fullPage, false);
  assert.equal(model.coverage.fullPageError, 'page height exceeded limit');
  assert.deepEqual(model.rhythm.surfaceSequence, []);
});
