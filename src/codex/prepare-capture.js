function finiteNonNegative(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export async function prepareCodexCapture(page, options = {}) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new TypeError('page.evaluate is required');
  }

  const settleMs = finiteNonNegative(options.settleMs, 120);
  const finalSettleMs = finiteNonNegative(options.finalSettleMs, 600);
  const maxScrollSteps = Math.max(1, Math.round(finiteNonNegative(options.maxScrollSteps, 24)));

  const hiddenOverlays = await page.evaluate(() => {
    const nuisanceText = /(?:\bcookies?\b|privacy|consent|personalized advertising|tracking preferences|your choices|隐私|私隱|同意|個人化|个性化|所在地|地點|地点|地区|區域|人机验证|驗證)/i;
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const hidden = [];

    const isVisible = element => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0;
    };

    const isPositionedOverlay = element => {
      const position = getComputedStyle(element).position;
      return position === 'fixed' || position === 'sticky';
    };

    const overlayRoot = element => {
      let root = element;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (!isPositionedOverlay(parent)) break;
        root = parent;
      }
      return root;
    };

    const candidates = Array.from(document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"], body *'));
    for (const element of candidates) {
      if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
      const modal = element.matches('dialog, [role="dialog"], [aria-modal="true"]');
      const positionedNuisance = isPositionedOverlay(element)
        && rect.width * rect.height >= viewportArea * 0.01
        && nuisanceText.test(text);
      if (!modal && !positionedNuisance) continue;

      const root = overlayRoot(element);
      if (hidden.some(item => item === root || item.contains(root))) continue;
      root.setAttribute('data-nexpage-capture-hidden', 'true');
      root.style.setProperty('display', 'none', 'important');
      hidden.push(root);
    }

    for (const element of Array.from(document.querySelectorAll('body *'))) {
      if (!(element instanceof HTMLElement) || !isVisible(element) || !isPositionedOverlay(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width * rect.height < viewportArea * 0.35) continue;
      const marker = `${element.id} ${element.className}`.toLowerCase();
      const text = (element.innerText || element.textContent || '').trim();
      const zIndex = Number.parseInt(getComputedStyle(element).zIndex, 10);
      const markedAsOverlay = /(?:backdrop|overlay|scrim|modal-mask|modal-layer)/.test(marker);
      const highLayerWithoutContent = Number.isFinite(zIndex) && zIndex >= 100 && text.length < 20;
      if (!markedAsOverlay && !highLayerWithoutContent) continue;
      element.setAttribute('data-nexpage-capture-hidden', 'true');
      element.style.setProperty('display', 'none', 'important');
      hidden.push(element);
    }

    return hidden.length;
  });

  const scrollSteps = await page.evaluate(async ({ delayMs, finalDelayMs, maximumSteps }) => {
    const wait = duration => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, duration)));
    const viewportHeight = Math.max(1, window.innerHeight);
    let height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    let maximumY = Math.max(0, height - viewportHeight);
    if (maximumY <= 0) {
      window.scrollTo(0, 0);
      return 0;
    }

    const naturalSteps = Math.max(2, Math.ceil(maximumY / (viewportHeight * 0.75)));
    const steps = Math.min(maximumSteps, naturalSteps);
    for (let index = 1; index <= steps; index += 1) {
      height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      maximumY = Math.max(0, height - viewportHeight);
      window.scrollTo(0, Math.round(maximumY * index / steps));
      await wait(delayMs);
    }
    window.scrollTo(0, 0);
    await wait(finalDelayMs);
    return steps;
  }, { delayMs: settleMs, finalDelayMs: finalSettleMs, maximumSteps: maxScrollSteps });

  return { hiddenOverlays, scrollSteps };
}

export async function captureScrollReference(page, outputPath, options = {}) {
  if (!page || typeof page.evaluate !== 'function' || typeof page.screenshot !== 'function') {
    throw new TypeError('a Playwright page is required');
  }
  if (typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new TypeError('outputPath is required');
  }

  const settleMs = finiteNonNegative(options.settleMs, 220);
  const maxSlices = Math.max(1, Math.round(finiteNonNegative(options.maxSlices, 24)));
  const overlap = Math.min(200, finiteNonNegative(options.overlap, 80));
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    viewportHeight: window.innerHeight,
    height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
  }));
  const step = Math.max(1, dimensions.viewportHeight - overlap);
  const maximumY = Math.max(0, dimensions.height - dimensions.viewportHeight);
  const positions = [];
  for (let y = 0; y < maximumY && positions.length < maxSlices - 1; y += step) positions.push(y);
  positions.push(maximumY);
  const uniquePositions = [...new Set(positions.map(value => Math.round(value)))];

  if (uniquePositions.length >= maxSlices && uniquePositions.at(-1) - uniquePositions.at(-2) > dimensions.viewportHeight) {
    throw new Error(`page height ${dimensions.height}px exceeds stitched capture limit`);
  }

  const images = [];
  for (const [index, y] of uniquePositions.entries()) {
    await page.evaluate(targetY => window.scrollTo(0, targetY), y);
    await page.evaluate(delay => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, delay))), settleMs);
    if (index > 0) {
      await page.evaluate(() => {
        const candidates = document.querySelectorAll('header, [role="banner"], nav');
        for (const element of candidates) {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if ((style.position === 'fixed' || style.position === 'sticky')
            && rect.top <= 12 && rect.height > 0 && rect.height <= 160) {
            element.setAttribute('data-nexpage-scroll-hidden', element.style.visibility || '');
            element.style.setProperty('visibility', 'hidden', 'important');
          }
        }
      });
    }
    const buffer = await page.screenshot({ type: 'png', fullPage: false, animations: 'disabled' });
    images.push(`data:image/png;base64,${buffer.toString('base64')}`);
    if (index > 0) {
      await page.evaluate(() => {
        for (const element of document.querySelectorAll('[data-nexpage-scroll-hidden]')) {
          const previous = element.getAttribute('data-nexpage-scroll-hidden') || '';
          if (previous) element.style.setProperty('visibility', previous);
          else element.style.removeProperty('visibility');
          element.removeAttribute('data-nexpage-scroll-hidden');
        }
      });
    }
  }

  const browser = page.context().browser();
  if (!browser) throw new Error('browser is unavailable for screenshot composition');
  const compositorContext = await browser.newContext({
    viewport: { width: dimensions.width, height: Math.min(800, dimensions.height) },
  });
  const compositor = await compositorContext.newPage();
  try {
    const slices = images.map((source, index) => {
      const current = uniquePositions[index];
      const next = uniquePositions[index + 1];
      const height = next === undefined ? dimensions.height - current : next - current;
      return `<div class="slice" style="height:${height}px"><img src="${source}" alt=""></div>`;
    }).join('');
    await compositor.setContent(`<!doctype html><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: ${dimensions.width}px; background: white; }
      .slice { width: ${dimensions.width}px; overflow: hidden; }
      img { display: block; width: ${dimensions.width}px; height: ${dimensions.viewportHeight}px; object-fit: cover; object-position: top; }
    </style>${slices}`, { waitUntil: 'load' });
    await compositor.screenshot({ path: outputPath, fullPage: true, type: 'png', animations: 'disabled' });
  } finally {
    await compositorContext.close();
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  }

  return {
    width: dimensions.width,
    height: dimensions.height,
    slices: uniquePositions.length,
  };
}
