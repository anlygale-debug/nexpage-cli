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
