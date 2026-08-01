function finitePositive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function renderedPageState(page) {
  const [url, title, elementCount] = await Promise.all([
    Promise.resolve().then(() => page.url()).catch(() => ''),
    Promise.resolve().then(() => page.title()).catch(() => ''),
    Promise.resolve().then(() => page.evaluate(() => document.body?.querySelectorAll('*').length || 0)).catch(() => 0),
  ]);
  const useful = typeof url === 'string'
    && /^https?:/i.test(url)
    && typeof title === 'string'
    && title.trim().length > 0
    && Number.isFinite(elementCount)
    && elementCount >= 20;
  return { useful, url, title, elementCount };
}

export async function navigateForCapture(page, url, options = {}) {
  if (!page || typeof page.goto !== 'function') throw new TypeError('page.goto is required');
  const maximumAttempts = Math.max(1, Math.round(finitePositive(options.attempts, 2)));
  const timeoutMs = finitePositive(options.timeoutMs, 60000);
  const retryDelayMs = Number.isFinite(options.retryDelayMs) && options.retryDelayMs >= 0
    ? options.retryDelayMs
    : 800;
  let finalError = null;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const waitUntil = attempt === 1 ? 'domcontentloaded' : 'commit';
      await page.goto(url, { waitUntil, timeout: timeoutMs });
      if (attempt > 1 && typeof page.waitForLoadState === 'function') {
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      }
      return { attempts: attempt, degraded: false, warning: null };
    } catch (error) {
      finalError = error;
      const state = await renderedPageState(page);
      if (state.useful) {
        return {
          attempts: attempt,
          degraded: true,
          warning: error?.message || String(error),
          state,
        };
      }
      if (attempt < maximumAttempts && typeof page.waitForTimeout === 'function') {
        await page.waitForTimeout(retryDelayMs);
      }
    }
  }

  throw finalError || new Error(`failed to navigate to ${url}`);
}
