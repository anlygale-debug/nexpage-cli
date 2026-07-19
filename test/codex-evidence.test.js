import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCodexEvidence } from '../src/codex/collect-evidence.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

function evaluateWithTransparentAncestor(callback) {
  class FakeElement {
    constructor({ parentElement = null, tagName = 'DIV', text = '', style = {} } = {}) {
      this.parentElement = parentElement;
      this.tagName = tagName;
      this.innerText = text;
      this.textContent = text;
      this.id = '';
      this.classList = [];
      this.style = style;
    }

    closest() {
      return null;
    }

    getBoundingClientRect() {
      return { x: 0, y: 0, width: 120, height: 24 };
    }
  }

  const transparentParent = new FakeElement({ style: { opacity: '0' } });
  const paragraph = new FakeElement({
    parentElement: transparentParent,
    tagName: 'P',
    text: 'Hidden by parent opacity',
    style: { opacity: '1' },
  });
  const defaults = {
    display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgba(0, 0, 0, 0)', fontFamily: 'sans-serif', fontSize: '16px',
    fontWeight: '400', lineHeight: 'normal', letterSpacing: 'normal', borderRadius: '0px',
    borderWidth: '0px', borderColor: 'rgb(0, 0, 0)', clipPath: 'none',
  };
  const originals = new Map(['Element', 'document', 'getComputedStyle', 'window'].map(key => [key, globalThis[key]]));

  Object.assign(globalThis, {
    Element: FakeElement,
    document: {
      querySelectorAll(selector) {
        return selector === 'p, li, blockquote' ? [paragraph] : [];
      },
      getAnimations() {
        return [];
      },
    },
    getComputedStyle(element) {
      return { ...defaults, ...element.style };
    },
    window: { innerWidth: 1280, innerHeight: 800 },
  });

  try {
    return callback();
  } finally {
    for (const [key, value] of originals) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
}

function evaluateWithSurfaceCandidates(callback, recordSurfaceSelector) {
  class FakeElement {
    constructor({ classList = [], tagName = 'DIV', rect, style = {} }) {
      this.parentElement = null;
      this.tagName = tagName;
      this.innerText = '';
      this.textContent = '';
      this.id = '';
      this.classList = classList;
      this.rect = rect;
      this.style = style;
    }

    closest() {
      return null;
    }

    getBoundingClientRect() {
      return this.rect;
    }
  }

  const transparent = Array.from({ length: 17 }, (_, index) => new FakeElement({
    tagName: 'SECTION',
    rect: { x: 0, y: index * 80, width: 1280, height: 720 },
    style: { backgroundColor: 'rgba(0, 0, 0, 0)' },
  }));
  const translucent = new FakeElement({
    tagName: 'SECTION',
    rect: { x: 0, y: 1350, width: 1280, height: 720 },
    style: { backgroundColor: 'rgba(61, 59, 79, 0.45)', color: 'rgb(245, 244, 237)' },
  });
  const dark = new FakeElement({
    classList: ['relative', 'overflow-hidden', 'bg-slate'],
    rect: { x: 0, y: 1398, width: 1280, height: 1864 },
    style: { backgroundColor: 'rgb(61, 59, 79)', color: 'rgb(245, 244, 237)' },
  });
  const light = new FakeElement({
    classList: ['surface-light'],
    rect: { x: 0, y: 8070, width: 1280, height: 680 },
    style: { backgroundColor: 'rgb(245, 244, 237)', color: 'rgb(61, 59, 79)' },
  });
  const black = new FakeElement({
    classList: ['background-black'],
    rect: { x: 0, y: 5000, width: 1280, height: 640 },
    style: { backgroundColor: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)' },
  });
  const defaults = {
    display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgba(0, 0, 0, 0)', fontFamily: 'sans-serif', fontSize: '16px',
    fontWeight: '400', lineHeight: 'normal', letterSpacing: 'normal', borderRadius: '0px',
    borderWidth: '0px', borderColor: 'rgb(0, 0, 0)', clipPath: 'none',
  };
  const classSurfaces = [dark, black, light];
  const keys = ['CSS', 'Element', 'document', 'getComputedStyle', 'window'];
  const originals = new Map(keys.map(key => [key, globalThis[key]]));

  Object.assign(globalThis, {
    CSS: { escape: value => value },
    Element: FakeElement,
    document: {
      querySelectorAll(selector) {
        const clauses = selector.split(',').map(item => item.trim());
        const isSurfaceQuery = clauses.some(clause => [
          'body', 'main', 'section', 'article', 'footer', '[role="main"]',
          '[class*="bg-"]', '[class*="surface"]', '[class*="background"]',
        ].includes(clause));
        if (!isSurfaceQuery) return [];

        recordSurfaceSelector(selector);
        const matches = [];
        if (clauses.includes('section')) matches.push(...transparent, translucent);
        if (clauses.includes('[class*="bg-"]')) {
          matches.push(...classSurfaces.filter(element => element.classList.some(name => name.includes('bg-'))));
        }
        if (clauses.includes('[class*="surface"]')) {
          matches.push(...classSurfaces.filter(element => element.classList.some(name => name.includes('surface'))));
        }
        if (clauses.includes('[class*="background"]')) {
          matches.push(...classSurfaces.filter(element => element.classList.some(name => name.includes('background'))));
        }
        return [...new Set(matches)];
      },
      getAnimations() {
        return [];
      },
    },
    getComputedStyle(element) {
      return { ...defaults, ...element.style };
    },
    window: { innerWidth: 1280, innerHeight: 800 },
  });

  try {
    return callback();
  } finally {
    for (const [key, value] of originals) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
}

function evaluateWithGenericAnimationTargets(callback) {
  class FakeElement {
    constructor({ tagName = 'DIV', classList = [], parentElement = null } = {}) {
      this.tagName = tagName;
      this.classList = classList;
      this.parentElement = parentElement;
      this.children = [];
      this.id = '';
      this.innerText = '';
      this.textContent = '';
      if (parentElement) parentElement.children.push(this);
    }

    closest() {
      return null;
    }

    getAttribute() {
      return null;
    }

    getBoundingClientRect() {
      return { x: 0, y: 0, width: 640, height: 360 };
    }
  }

  const main = new FakeElement({ tagName: 'MAIN' });
  const section = new FakeElement({ tagName: 'SECTION', parentElement: main });
  const first = new FakeElement({
    classList: ['absolute', 'inset-0', 'pointer-events-none', 'ambient-layer'],
    parentElement: section,
  });
  const second = new FakeElement({
    classList: ['absolute', 'inset-0', 'pointer-events-none', 'ambient-layer'],
    parentElement: section,
  });
  const animations = [first, second].map((target, index) => ({
    animationName: index === 0 ? 'float-code' : 'grid-drift',
    id: '',
    playState: 'running',
    effect: {
      target,
      getTiming: () => ({ duration: index === 0 ? 6000 : 40000, easing: 'linear', iterations: Infinity }),
    },
  }));
  const defaults = {
    display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0, 0, 0)',
    backgroundColor: 'rgba(0, 0, 0, 0)', fontFamily: 'sans-serif', fontSize: '16px',
    fontWeight: '400', lineHeight: 'normal', letterSpacing: 'normal', borderRadius: '0px',
    borderWidth: '0px', borderColor: 'rgb(0, 0, 0)', clipPath: 'none',
  };
  const keys = ['CSS', 'Element', 'document', 'getComputedStyle', 'window'];
  const originals = new Map(keys.map(key => [key, globalThis[key]]));

  Object.assign(globalThis, {
    CSS: { escape: value => value },
    Element: FakeElement,
    document: {
      querySelectorAll(selector) {
        return selector === '.ambient-layer' ? [first, second] : [];
      },
      getAnimations() {
        return animations;
      },
    },
    getComputedStyle() {
      return defaults;
    },
    window: { innerWidth: 1280, innerHeight: 800 },
  });

  try {
    return callback();
  } finally {
    for (const [key, value] of originals) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
}

test('collectCodexEvidence reuses the supplied page exactly once', async () => {
  let calls = 0;
  const page = {
    async evaluate(callback) {
      calls += 1;
      assert.equal(typeof callback, 'function');
      return structuredClone(greptileEvidence);
    },
  };

  const evidence = await collectCodexEvidence(page);
  assert.equal(calls, 1);
  assert.equal(evidence.actions.length, 2);
  assert.deepEqual(evidence.animations.map(item => item.duration), [6000, 40000]);
});

test('collectCodexEvidence rejects an invalid Page', async () => {
  await assert.rejects(() => collectCodexEvidence(null), /page\.evaluate is required/);
});

test('collectCodexEvidence excludes descendants of transparent ancestors', async () => {
  let calls = 0;
  const page = {
    async evaluate(callback) {
      calls += 1;
      return evaluateWithTransparentAncestor(callback);
    },
  };

  const evidence = await collectCodexEvidence(page);
  assert.equal(calls, 1);
  assert.equal(evidence.bodyText.length, 0);
});

test('collectCodexEvidence retains ordered opaque class-based surfaces and excludes translucent candidates', async () => {
  let calls = 0;
  let queriedSurfaceSelector = '';
  const page = {
    async evaluate(callback) {
      calls += 1;
      return evaluateWithSurfaceCandidates(callback, selector => {
        queriedSurfaceSelector = selector;
      });
    },
  };

  const evidence = await collectCodexEvidence(page);
  assert.equal(calls, 1);
  for (const clause of ['[class*="bg-"]', '[class*="surface"]', '[class*="background"]']) {
    assert.equal(queriedSurfaceSelector.includes(clause), true, `surface selector must include ${clause}`);
  }
  assert.deepEqual(evidence.surfaces.map(item => item.style.backgroundColor), [
    'rgb(61, 59, 79)',
    'rgb(0, 0, 0)',
    'rgb(245, 244, 237)',
  ]);
  assert.equal(evidence.surfaces.some(item => item.style.backgroundColor === 'rgba(0, 0, 0, 0)'), false);
  assert.equal(evidence.surfaces.some(item => item.style.backgroundColor === 'rgba(61, 59, 79, 0.45)'), false);
});

test('collectCodexEvidence distinguishes animation targets that only have generic utility classes', async () => {
  const page = {
    async evaluate(callback) {
      return evaluateWithGenericAnimationTargets(callback);
    },
  };

  const evidence = await collectCodexEvidence(page);
  const targets = evidence.animations.map(item => item.target);

  assert.equal(new Set(targets).size, 2);
  assert.ok(targets.every(target => target.includes(':nth-of-type(')));
  assert.ok(targets.every(target => !['.absolute', 'div'].includes(target)));
});
