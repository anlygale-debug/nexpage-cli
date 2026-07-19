export async function collectCodexEvidence(page) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new TypeError('page.evaluate is required');
  }

  return page.evaluate(() => {
    const limits = {
      headings: 16,
      bodyText: 32,
      labels: 24,
      actions: 32,
      cards: 24,
      surfaces: 16,
      animations: 32,
    };

    const isVisible = element => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === 'none'
          || style.visibility === 'hidden'
          || style.visibility === 'collapse'
          || Number.parseFloat(style.opacity || '1') <= 0) {
          return false;
        }
      }

      return true;
    };

    const selectorFor = element => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const className = [...element.classList].find(name => name && !name.includes(':'));
      if (className) return `.${CSS.escape(className)}`;
      return element.tagName.toLowerCase();
    };

    const snapshotStyle = element => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        borderRadius: style.borderRadius,
        borderWidth: style.borderWidth,
        borderColor: style.borderColor,
        clipPath: style.clipPath,
      };
    };

    const snapshotElement = element => {
      const rect = element.getBoundingClientRect();
      return {
        selector: selectorFor(element),
        text: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 280),
        visible: true,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        style: snapshotStyle(element),
      };
    };

    const collect = (selector, limit, map = snapshotElement) => Array.from(document.querySelectorAll(selector))
      .filter(isVisible)
      .slice(0, limit)
      .map(map);

    const actionScope = element => {
      if (element.closest('nav, [role="navigation"]')) return 'nav';
      if (element.closest('main, [role="main"]')) return 'main';
      if (element.closest('footer, [role="contentinfo"]')) return 'footer';
      return 'other';
    };

    const evidence = {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      headings: collect('h1, h2, h3', limits.headings),
      bodyText: collect('p, li, blockquote', limits.bodyText),
      labels: collect('nav a, nav button, [role="navigation"] a, [data-label], [class*="label"], [class*="eyebrow"], [class*="tag"], [class*="badge"], code, kbd', limits.labels),
      actions: collect('button, a, [role="button"]', limits.actions, element => ({
        ...snapshotElement(element),
        scope: actionScope(element),
      })),
      cards: collect('[class*="card"], [class*="tile"], [class*="panel"], [data-card]', limits.cards),
      surfaces: [],
      animations: [],
    };

    evidence.surfaces = collect('body, main, section, article, footer, [role="main"]', limits.surfaces, (element, order) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        selector: selectorFor(element),
        order,
        rect: { width: rect.width, height: rect.height },
        style: { backgroundColor: style.backgroundColor, color: style.color },
      };
    });

    evidence.animations = document.getAnimations()
      .filter(animation => animation.effect && animation.effect.target instanceof Element)
      .slice(0, limits.animations)
      .map(animation => {
        const timing = animation.effect.getTiming();
        return {
          name: animation.animationName || animation.id || 'unnamed',
          target: selectorFor(animation.effect.target),
          duration: timing.duration,
          easing: timing.easing,
          iterations: timing.iterations,
          playState: animation.playState,
        };
      });

    return evidence;
  });
}
