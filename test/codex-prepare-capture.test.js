import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { captureScrollReference, prepareCodexCapture } from '../src/codex/prepare-capture.js';

test('capture preparation removes transient overlays, warms lazy content, and returns to the top', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`
      <style>
        body { margin: 0; }
        main { min-height: 4200px; background: linear-gradient(#fff, #ddd); }
        #privacy-dialog { position: fixed; inset: 80px; z-index: 9999; background: white; }
        #privacy-banner { position: fixed; inset: auto 0 0; height: 20px; z-index: 9998; background: white; }
        .modal-backdrop { position: fixed; inset: 0; z-index: 9997; background: rgba(0, 0, 0, .55); }
      </style>
      <main><h1>Product page</h1><div id="lazy-target"></div></main>
      <div id="privacy-dialog" role="dialog" aria-modal="true">
        We use cookies and personalized advertising. Privacy choices.
        <button>Accept all</button>
      </div>
      <div id="privacy-banner">Cookie privacy choices</div>
      <div class="modal-backdrop"></div>
      <script>
        addEventListener('scroll', () => {
          if (scrollY > 900 && !document.querySelector('#lazy-content')) {
            const content = document.createElement('section');
            content.id = 'lazy-content';
            content.textContent = 'Loaded after scrolling';
            document.querySelector('#lazy-target').append(content);
          }
        });
      </script>
    `);

    const result = await prepareCodexCapture(page, { settleMs: 0, finalSettleMs: 0, maxScrollSteps: 8 });
    const state = await page.evaluate(() => ({
      overlayDisplay: getComputedStyle(document.querySelector('#privacy-dialog')).display,
      bannerDisplay: getComputedStyle(document.querySelector('#privacy-banner')).display,
      backdropDisplay: getComputedStyle(document.querySelector('.modal-backdrop')).display,
      lazyLoaded: Boolean(document.querySelector('#lazy-content')),
      scrollY,
    }));

    assert.equal(state.overlayDisplay, 'none');
    assert.equal(state.bannerDisplay, 'none');
    assert.equal(state.backdropDisplay, 'none');
    assert.equal(state.lazyLoaded, true);
    assert.equal(state.scrollY, 0);
    assert.equal(result.hiddenOverlays, 3);
    assert.ok(result.scrollSteps >= 2);
  } finally {
    await browser.close();
  }
});

test('scroll reference captures viewport-triggered content into one full-height image', async () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-scroll-reference-'));
  const outputPath = join(root, 'reference-full.png');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`
      <style>
        body { margin: 0; }
        header { position: fixed; inset: 0 0 auto; height: 64px; background: black; color: white; z-index: 20; }
        section { height: 800px; opacity: 0; }
        section[data-visible="true"] { opacity: 1; }
      </style>
      <header>Sticky navigation</header>
      <main>
        <section style="background:#ff0000">First</section>
        <section style="background:#00ff00">Second</section>
        <section style="background:#0000ff">Third</section>
      </main>
      <script>
        const reveal = () => document.querySelectorAll('section').forEach(section => {
          const rect = section.getBoundingClientRect();
          if (rect.top < innerHeight && rect.bottom > 0) section.dataset.visible = 'true';
        });
        addEventListener('scroll', reveal);
        reveal();
      </script>
    `);

    const result = await captureScrollReference(page, outputPath, { settleMs: 0, maxSlices: 8 });

    assert.equal(existsSync(outputPath), true);
    assert.ok(statSync(outputPath).size > 1000);
    assert.equal(result.width, 1280);
    assert.equal(result.height, 2400);
    assert.ok(result.slices >= 3);
    assert.equal(await page.evaluate(() => scrollY), 0);
  } finally {
    await browser.close();
    rmSync(root, { recursive: true, force: true });
  }
});
