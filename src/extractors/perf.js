// v10.3 — Perf & Bundle Profile
//
// Opens a fresh Playwright context, captures every network response, and
// measures Core Web Vitals via PerformanceObserver. Returns a single JSON
// payload a bin-level consumer can write as `*-perf.json`.
//
// No Lighthouse dependency — everything is pure `playwright` + the page's own
// `PerformanceObserver` API, which keeps the package size flat.

import { chromium } from 'playwright';

const THIRD_PARTY_HOSTS = [
  'google-analytics', 'googletagmanager', 'analytics.google', 'segment.', 'mixpanel',
  'amplitude', 'posthog', 'intercom', 'hotjar', 'fullstory', 'sentry', 'datadog',
  'cloudflare', 'fastly', 'doubleclick', 'facebook.net', 'adservice.google', 'hs-analytics',
  'stripe.com', 'recaptcha', 'hcaptcha', 'sentry-cdn', 'optimizely', 'statsig',
];

function categorize(url) {
  if (!url) return 'other';
  if (/\.(js|mjs)(?:\?|$)/i.test(url)) return 'js';
  if (/\.(css)(?:\?|$)/i.test(url)) return 'css';
  if (/\.(woff2?|ttf|otf|eot)(?:\?|$)/i.test(url)) return 'font';
  if (/\.(png|jpe?g|webp|avif|gif|svg|ico)(?:\?|$)/i.test(url)) return 'image';
  if (/fonts\.gstatic|fonts\.googleapis/.test(url)) return 'font';
  if (/\.(html?)(?:\?|$)/i.test(url)) return 'document';
  return 'other';
}

function isThirdParty(resUrl, pageHost) {
  try {
    const u = new URL(resUrl);
    if (u.hostname === pageHost) return false;
    if (THIRD_PARTY_HOSTS.some(h => u.hostname.includes(h))) return true;
    return u.hostname !== pageHost;
  } catch { return false; }
}

function fontLoadingStrategy(stack) {
  const classes = (stack.classNameSample || []).join(' ');
  const metas = (stack.metas || []).map(m => `${m.name || ''}=${m.content || ''}`).join(' ');
  const preloadCount = ((metas + classes).match(/preload|rel=["']preload/g) || []).length;
  return { preloadCount };
}

export async function captureCoreWebVitals(url, { width = 1280, height = 800, channel, timeout = 30000 } = {}) {
  const browser = await chromium.launch({ headless: true, ...(channel && { channel }) });
  try {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' });
    const page = await ctx.newPage();

    const requests = [];
    page.on('response', async (res) => {
      try {
        const req = res.request();
        const headers = res.headers();
        const contentLength = Number(headers['content-length'] || 0);
        requests.push({
          url: res.url(),
          method: req.method(),
          status: res.status(),
          type: categorize(res.url()),
          bytes: contentLength,
          fromCache: res.fromServiceWorker() || /hit/i.test(headers['x-cache'] || ''),
        });
      } catch { /* ignore */ }
    });

    await page.addInitScript(() => {
      window.__dlVitals = { lcp: 0, cls: 0, inp: 0 };
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__dlVitals.lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}
      try {
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) cls += e.value;
          }
          window.__dlVitals.cls = cls;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if ((e.duration || 0) > window.__dlVitals.inp) window.__dlVitals.inp = e.duration;
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      } catch {}
    });

    const start = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    // Give the observers a moment; synthesize an interaction so INP reports.
    await page.mouse.move(100, 100);
    await page.mouse.click(100, 100).catch(() => {});
    await page.waitForTimeout(1200);

    const ttfbish = Date.now() - start;
    const vitals = await page.evaluate(() => ({ ...(window.__dlVitals || {}) }));
    const pageHost = new URL(url).hostname;

    const totals = { js: 0, css: 0, font: 0, image: 0, document: 0, other: 0 };
    const counts = { js: 0, css: 0, font: 0, image: 0, document: 0, other: 0 };
    let thirdPartyCount = 0, thirdPartyBytes = 0;
    for (const r of requests) {
      totals[r.type] = (totals[r.type] || 0) + (r.bytes || 0);
      counts[r.type] = (counts[r.type] || 0) + 1;
      if (isThirdParty(r.url, pageHost)) {
        thirdPartyCount++;
        thirdPartyBytes += r.bytes || 0;
      }
    }

    return {
      vitals: {
        lcp: Math.round(vitals.lcp || 0),
        cls: Number((vitals.cls || 0).toFixed(4)),
        inp: Math.round(vitals.inp || 0),
        // Rough classification vs Google's good/needs-improvement thresholds.
        lcpGrade: vitals.lcp < 2500 ? 'good' : vitals.lcp < 4000 ? 'needs-improvement' : 'poor',
        clsGrade: (vitals.cls || 0) < 0.1 ? 'good' : (vitals.cls || 0) < 0.25 ? 'needs-improvement' : 'poor',
      },
      ttfbApprox: ttfbish,
      bytes: totals,
      counts,
      thirdParty: { count: thirdPartyCount, bytes: thirdPartyBytes },
      requestsTotal: requests.length,
    };
  } finally {
    await browser.close();
  }
}

export function extractFontLoading(stack = {}) {
  return fontLoadingStrategy(stack);
}
