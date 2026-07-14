// Interaction state extraction — hover, focus, active styles

import { chromium } from 'playwright';

export async function captureInteractions(url, options = {}) {
  const { width = 1280, height = 800, wait = 0 } = options;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  if (wait > 0) await page.waitForTimeout(wait);
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  const results = { buttons: [], links: [], inputs: [] };

  // Extract button states
  const buttons = await page.$$('button, [role="button"], a[class*="btn"]');
  for (const btn of buttons.slice(0, 10)) {
    try {
      const base = await getStyles(page, btn);
      if (!base || base.display === 'none') continue;

      // Hover
      await btn.hover();
      await page.waitForTimeout(100);
      const hover = await getStyles(page, btn);

      // Focus
      await btn.focus();
      await page.waitForTimeout(100);
      const focus = await getStyles(page, btn);

      const diffs = diffStates(base, hover, focus);
      if (diffs.hasChanges) {
        results.buttons.push({ text: base.text, base: base.styles, ...diffs });
      }
    } catch { /* skip */ }
  }

  // Extract link states
  const links = await page.$$('a:not([role="button"]):not([class*="btn"])');
  for (const link of links.slice(0, 10)) {
    try {
      const base = await getStyles(page, link);
      if (!base || base.display === 'none') continue;

      await link.hover();
      await page.waitForTimeout(100);
      const hover = await getStyles(page, link);

      const diffs = diffStates(base, hover, null);
      if (diffs.hasChanges) {
        results.links.push({ text: base.text, base: base.styles, ...diffs });
        break; // One link pattern is enough
      }
    } catch { /* skip */ }
  }

  // Extract input states
  const inputs = await page.$$('input[type="text"], input[type="email"], input[type="search"], textarea');
  for (const input of inputs.slice(0, 5)) {
    try {
      const base = await getStyles(page, input);
      if (!base || base.display === 'none') continue;

      await input.focus();
      await page.waitForTimeout(100);
      const focus = await getStyles(page, input);

      const diffs = diffStates(base, null, focus);
      if (diffs.hasChanges) {
        results.inputs.push({ base: base.styles, ...diffs });
        break; // One input pattern is enough
      }
    } catch { /* skip */ }
  }

  await browser.close();

  return results;
}

async function getStyles(page, element) {
  return element.evaluate(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    return {
      text: el.textContent?.trim().slice(0, 30) || '',
      display: cs.display,
      styles: {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        boxShadow: cs.boxShadow,
        transform: cs.transform,
        opacity: cs.opacity,
        outline: cs.outline,
        textDecoration: cs.textDecoration,
        scale: cs.scale,
      },
    };
  });
}

function diffStates(base, hover, focus) {
  const result = { hasChanges: false, hover: {}, focus: {} };

  if (hover) {
    for (const [prop, val] of Object.entries(hover.styles)) {
      if (val !== base.styles[prop] && val !== 'none' && val !== 'auto') {
        result.hover[prop] = { from: base.styles[prop], to: val };
        result.hasChanges = true;
      }
    }
  }

  if (focus) {
    for (const [prop, val] of Object.entries(focus.styles)) {
      if (val !== base.styles[prop] && val !== 'none' && val !== 'auto') {
        result.focus[prop] = { from: base.styles[prop], to: val };
        result.hasChanges = true;
      }
    }
  }

  return result;
}
