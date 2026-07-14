// v10.2 — Responsive Screenshots
//
// Full-page PNGs at each breakpoint × (light, dark). Lives alongside the
// component screenshots dir so output stays organised. Writes to
// `screenshots/responsive/<breakpoint>-<scheme>.png` and returns an index.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BREAKPOINTS = [
  { slug: 'mobile', width: 375, height: 812 },
  { slug: 'tablet', width: 768, height: 1024 },
  { slug: 'desktop', width: 1280, height: 800 },
  { slug: 'wide', width: 1920, height: 1080 },
];

async function captureAt(url, dir, bp, scheme, channel) {
  const browser = await chromium.launch({ headless: true, ...(channel && { channel }) });
  try {
    const ctx = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: bp.slug === 'mobile' ? 2 : 1,
      colorScheme: scheme,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const file = `${bp.slug}-${scheme}.png`;
    const path = join(dir, file);
    await page.screenshot({ path, fullPage: true });
    return { breakpoint: bp.slug, scheme, width: bp.width, path: `screenshots/responsive/${file}` };
  } finally {
    await browser.close();
  }
}

export async function captureResponsiveScreenshots(url, outDir, { includeDark = true, channel } = {}) {
  const dir = join(outDir, 'screenshots', 'responsive');
  mkdirSync(dir, { recursive: true });
  const out = [];
  const schemes = includeDark ? ['light', 'dark'] : ['light'];
  for (const bp of BREAKPOINTS) {
    for (const scheme of schemes) {
      try {
        const row = await captureAt(url, dir, bp, scheme, channel);
        out.push(row);
      } catch (e) {
        out.push({ breakpoint: bp.slug, scheme, error: e.message });
      }
    }
  }
  return { count: out.filter(r => !r.error).length, shots: out };
}
