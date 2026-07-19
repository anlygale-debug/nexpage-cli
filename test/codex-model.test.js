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

test('model keeps an unassigned repeated action shape as a candidate instead of naming it primary', () => {
  const actions = greptileEvidence.actions.map((action, index) => ({
    ...action,
    scope: index === 0 ? 'nav' : 'footer',
    style: {
      ...action.style,
      backgroundColor: index === 0 ? 'rgb(40, 233, 159)' : 'rgb(255, 120, 80)',
    },
  }));
  const model = buildVerifiedVisualModel(design, { ...greptileEvidence, actions }, { fullPageCaptured: true });

  assert.equal(model.verified.shapes.actionPrimary, undefined);
  assert.ok(model.candidates.shapes.some(entry => /^polygon\(/.test(entry.value.clipPath)));
});

test('model derives primary and secondary action shapes from their own color roles', () => {
  const makeAction = ({ backgroundColor, clipPath = 'none', borderRadius = '0px', index, scope }) => ({
    ...greptileEvidence.actions[0],
    selector: `.role-action-${index}`,
    scope,
    rect: { x: 40, y: 80 + (index * 52), width: 140, height: 44 },
    style: {
      ...greptileEvidence.actions[0].style,
      backgroundColor,
      clipPath,
      borderRadius,
    },
  });
  const primaryClip = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';
  const actions = [
    makeAction({ backgroundColor: 'rgb(40, 233, 159)', clipPath: primaryClip, index: 0, scope: 'nav' }),
    makeAction({ backgroundColor: 'rgb(40, 233, 159)', clipPath: primaryClip, index: 1, scope: 'main' }),
    ...Array.from({ length: 6 }, (_, index) => makeAction({
      backgroundColor: 'rgb(61, 59, 79)',
      borderRadius: '24px',
      index: index + 2,
      scope: index === 0 ? 'nav' : 'main',
    })),
  ];

  const model = buildVerifiedVisualModel(design, { ...greptileEvidence, actions }, { fullPageCaptured: true });

  assert.equal(model.verified.colors.actionPrimary.value, '#28e99f');
  assert.match(model.verified.shapes.actionPrimary.value.clipPath, /^polygon\(/);
  assert.equal(model.verified.shapes.actionPrimary.value.borderRadius, undefined);
  assert.equal(model.verified.colors.actionSecondary.value, '#3d3b4f');
  assert.equal(model.verified.shapes.actionSecondary.value.borderRadius, 24);
  assert.equal(model.verified.shapes.actionSecondary.value.clipPath, undefined);
});

test('model does not promote a semi-transparent action background as a filled role', () => {
  const action = {
    ...greptileEvidence.actions[1],
    style: {
      ...greptileEvidence.actions[1].style,
      backgroundColor: 'rgba(40, 233, 159, 0.05)',
    },
  };
  const model = buildVerifiedVisualModel(design, {
    ...greptileEvidence,
    actions: [action],
  }, { fullPageCaptured: true });

  assert.equal(model.verified.colors.actionPrimary, undefined);
});

test('model rejects semi-transparent semantic ink instead of flattening it to opaque hex', () => {
  const color = 'rgba(61, 59, 79, 0.55)';
  const evidence = {
    ...greptileEvidence,
    headings: greptileEvidence.headings.map(item => ({ ...item, style: { ...item.style, color } })),
    bodyText: greptileEvidence.bodyText.map(item => ({ ...item, style: { ...item.style, color } })),
  };

  const model = buildVerifiedVisualModel(design, evidence, { fullPageCaptured: true });

  assert.equal(model.verified.colors.ink, undefined);
  assert.ok(model.rejected.some(item => item.path.includes('style.color') && /alpha|半透明/i.test(item.reason)));
});

test('model rejects semi-transparent light and dark surfaces as verified surface materials', () => {
  const surfaces = greptileEvidence.surfaces.map((surface, index) => ({
    ...surface,
    style: {
      ...surface.style,
      backgroundColor: index === 1 ? 'rgba(61, 59, 79, 0.6)' : 'rgba(245, 244, 237, 0.6)',
    },
  }));

  const model = buildVerifiedVisualModel(design, { ...greptileEvidence, surfaces }, { fullPageCaptured: true });

  assert.equal(model.verified.colors.surface, undefined);
  assert.deepEqual(model.verified.materials, []);
  assert.ok(model.rejected.some(item => item.path.includes('surfaces') && /alpha|半透明/i.test(item.reason)));
});

test('model rejects a semi-transparent raw palette entry without creating an opaque candidate', () => {
  const translucentDesign = {
    ...design,
    colors: { all: [{ value: 'rgba(40, 233, 159, 0.4)' }] },
  };

  const model = buildVerifiedVisualModel(translucentDesign, {
    ...greptileEvidence,
    actions: [], headings: [], bodyText: [], labels: [], surfaces: [], cards: [],
  }, { fullPageCaptured: true });

  assert.equal(model.candidates.colors.some(entry => entry.value === '#28e99f'), false);
  assert.ok(model.rejected.some(item => item.path === 'colors.all[0]' && /alpha|半透明/i.test(item.reason)));
});

test('model builds abstract repeated action, card, and surface material rules', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });

  assert.deepEqual(model.verified.materials.map(entry => entry.value.role).sort(), ['surfaceDark', 'surfaceLight']);
  assert.ok(model.verified.components.actions.some(entry => entry.value.role === 'primary'
    && entry.evidence.instances === 2));
  assert.ok(model.verified.components.cards.some(entry => entry.evidence.instances === 2
    && entry.value.background === '#f5f4ed'
    && entry.value.border?.color === '#3d3b4f'));
  assert.doesNotMatch(JSON.stringify(model.verified.components), /Get started|Book a demo|Build software with confidence/);
});

test('model does not turn a one-off main action into a reusable component rule', () => {
  const model = buildVerifiedVisualModel(design, {
    ...greptileEvidence,
    actions: [greptileEvidence.actions[1]],
  }, { fullPageCaptured: true });

  assert.equal(model.verified.colors.actionPrimary.value, '#28e99f');
  assert.deepEqual(model.verified.components.actions, []);
});

test('model favors a prominent chromatic action over numerous muted secondary actions', () => {
  const makeAction = ({ backgroundColor, index, scope, text, width = 108, height = 40 }) => ({
    ...greptileEvidence.actions[0],
    selector: `.action-${index}`,
    text,
    scope,
    rect: { x: 40 + index, y: 80 + (index * 48), width, height },
    style: { ...greptileEvidence.actions[0].style, backgroundColor },
  });
  const actions = [
    ...Array.from({ length: 6 }, (_, index) => makeAction({
      backgroundColor: 'rgb(61, 59, 79)',
      index,
      scope: index === 0 ? 'nav' : 'main',
      text: index === 0 ? 'Contact Sales' : `Learn ${index}`,
    })),
    makeAction({ backgroundColor: 'rgb(40, 233, 159)', index: 6, scope: 'nav', text: 'Sign up', width: 124, height: 44 }),
    makeAction({ backgroundColor: 'rgb(40, 233, 159)', index: 7, scope: 'main', text: 'Start now', width: 152, height: 48 }),
    makeAction({ backgroundColor: 'rgb(255, 105, 180)', index: 8, scope: 'main', text: 'Try feature A', width: 92, height: 36 }),
    makeAction({ backgroundColor: 'rgb(255, 105, 180)', index: 9, scope: 'main', text: 'Try feature B', width: 92, height: 36 }),
  ];

  const model = buildVerifiedVisualModel(design, { ...greptileEvidence, actions }, { fullPageCaptured: true });

  assert.equal(model.verified.colors.actionPrimary.value, '#28e99f');
  assert.equal(model.verified.colors.actionSecondary.value, '#3d3b4f');
});

test('model chooses a representative non-mono body family instead of the first announcement', () => {
  const bodyText = [
    {
      ...greptileEvidence.bodyText[0],
      selector: '.announcement',
      rect: { x: 80, y: 72, width: 800, height: 20 },
      style: {
        ...greptileEvidence.bodyText[0].style,
        fontFamily: 'Space Mono, monospace',
        fontSize: '14px',
        lineHeight: '20px',
      },
    },
    {
      ...greptileEvidence.bodyText[0],
      selector: 'main .hero-copy',
      rect: { x: 96, y: 350, width: 640, height: 72 },
      style: { ...greptileEvidence.bodyText[0].style, fontSize: '24px', lineHeight: '34px' },
    },
    greptileEvidence.bodyText[0],
    {
      ...greptileEvidence.bodyText[0],
      selector: 'main .feature-copy',
      rect: { x: 96, y: 800, width: 520, height: 58 },
    },
  ];

  const model = buildVerifiedVisualModel(design, { ...greptileEvidence, bodyText }, { fullPageCaptured: true });

  assert.equal(model.verified.typography.body.value.family, 'DM Sans');
  assert.equal(model.verified.typography.mono.value.family, 'Space Mono');
});

test('model does not treat a near-white tint as more chromatic than the primary accent', () => {
  const makeAction = ({ backgroundColor, index, scope, width, height }) => ({
    ...greptileEvidence.actions[0],
    selector: `.contrast-action-${index}`,
    scope,
    rect: { x: 80, y: 100 + (index * 52), width, height },
    style: { ...greptileEvidence.actions[0].style, backgroundColor },
  });
  const actions = [
    makeAction({ backgroundColor: 'rgb(40, 233, 159)', index: 0, scope: 'nav', width: 124, height: 44 }),
    makeAction({ backgroundColor: 'rgb(40, 233, 159)', index: 1, scope: 'main', width: 152, height: 48 }),
    ...Array.from({ length: 4 }, (_, index) => makeAction({
      backgroundColor: 'rgb(255, 250, 250)',
      index: index + 2,
      scope: index === 0 ? 'nav' : 'main',
      width: 132,
      height: 44,
    })),
  ];

  const model = buildVerifiedVisualModel(design, { ...greptileEvidence, actions }, { fullPageCaptured: true });

  assert.equal(model.verified.colors.actionPrimary.value, '#28e99f');
});

test('model keeps the first minority body family as a candidate when another family wins', () => {
  const minority = {
    ...greptileEvidence.bodyText[0],
    selector: '.minority-copy',
    rect: { x: 80, y: 120, width: 280, height: 24 },
    style: { ...greptileEvidence.bodyText[0].style, fontFamily: 'Minority Sans, sans-serif' },
  };
  const bodyText = [
    minority,
    greptileEvidence.bodyText[0],
    { ...greptileEvidence.bodyText[0], selector: 'main .body-copy-two' },
    { ...greptileEvidence.bodyText[0], selector: 'main .body-copy-three' },
  ];

  const model = buildVerifiedVisualModel(design, { ...greptileEvidence, bodyText }, { fullPageCaptured: true });

  assert.equal(model.verified.typography.body.value.family, 'DM Sans');
  assert.ok(model.candidates.typography.some(entry => entry.value.family === 'Minority Sans'));
});
