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

    const genericClasses = new Set([
      'absolute', 'relative', 'fixed', 'sticky', 'block', 'inline', 'inline-block',
      'flex', 'grid', 'hidden', 'visible', 'isolate', 'container', 'group',
      'overflow-hidden', 'overflow-visible', 'pointer-events-none', 'inset-0',
    ]);
    const isStableClass = name => name
      && !name.includes(':')
      && !genericClasses.has(name)
      && !/^(?:[mp][trblxy]?|[wh]|min-[wh]|max-[wh]|top|right|bottom|left|z|gap|space-[xy]|col|row|order|opacity|scale|translate-[xy]|rotate|skew-[xy])-(?:\[.*\]|\d|px|full|auto)/.test(name);
    const pathSegment = element => {
      const tag = element.tagName.toLowerCase();
      const siblings = element.parentElement?.children
        ? [...element.parentElement.children].filter(child => child.tagName === element.tagName)
        : [];
      const index = Math.max(0, siblings.indexOf(element)) + 1;
      return `${tag}:nth-of-type(${index})`;
    };
    const selectorFor = element => {
      const identifiesElement = selector => {
        try {
          const matches = document.querySelectorAll(selector);
          return matches.length === 1 && matches[0] === element;
        } catch {
          return false;
        }
      };

      if (element.id) {
        const idSelector = `#${CSS.escape(element.id)}`;
        if (identifiesElement(idSelector)) return idSelector;
      }

      if (typeof element.getAttribute === 'function') {
        for (const attribute of ['data-testid', 'data-test', 'data-qa', 'data-component', 'data-motion', 'data-animation', 'data-role']) {
          const value = element.getAttribute(attribute);
          if (value && value.length <= 96) {
            const selector = `[${attribute}="${value.replace(/["\\]/g, '\\$&')}"]`;
            if (identifiesElement(selector)) return selector;
          }
        }
      }

      const classes = [...element.classList].filter(isStableClass).slice(0, 3);
      let classSelector = '';
      for (const name of classes) {
        classSelector += `.${CSS.escape(name)}`;
        if (identifiesElement(classSelector)) return classSelector;
      }

      const path = [];
      for (let current = element; current; current = current.parentElement) {
        path.unshift(pathSegment(current));
        const selector = path.join(' > ');
        if (identifiesElement(selector)) return selector;
      }
      return null;
    };

    const effectiveOpacity = element => {
      let opacity = 1;
      for (let current = element; current; current = current.parentElement) {
        const value = Number.parseFloat(getComputedStyle(current).opacity || '1');
        if (Number.isFinite(value)) opacity *= value;
      }
      return opacity;
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
        opacity: style.opacity,
        effectiveOpacity: effectiveOpacity(element),
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

    const hasOpaqueBackground = value => {
      const normalized = (value || '').trim().toLowerCase();
      if (!normalized || normalized === 'transparent') return false;
      const slashAlpha = normalized.match(/\/\s*([\d.]+)(%)?\s*\)$/);
      if (slashAlpha) {
        const alpha = Number.parseFloat(slashAlpha[1]) / (slashAlpha[2] ? 100 : 1);
        return alpha === 1;
      }
      if (normalized.startsWith('rgba(')) {
        const channels = normalized.slice(5, -1).split(',');
        if (channels.length === 4) return Number.parseFloat(channels[3]) === 1;
      }
      return true;
    };

    let mainActionOrder = 0;
    const evidence = {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      headings: collect('h1, h2, h3', limits.headings),
      bodyText: collect('p, li, blockquote', limits.bodyText),
      labels: collect('nav a, nav button, [role="navigation"] a, [data-label], [class*="label"], [class*="eyebrow"], [class*="tag"], [class*="badge"], code, kbd', limits.labels),
      actions: collect('button, a, [role="button"]', limits.actions, element => {
        const snapshot = snapshotElement(element);
        const scope = actionScope(element);
        const inViewport = snapshot.rect.y < window.innerHeight
          && snapshot.rect.y + snapshot.rect.height > 0
          && snapshot.rect.x < window.innerWidth
          && snapshot.rect.x + snapshot.rect.width > 0;
        return {
          ...snapshot,
          scope,
          inViewport,
          mainOrder: scope === 'main' ? mainActionOrder++ : null,
        };
      }),
      cards: collect('[class*="card"], [class*="tile"], [class*="panel"], [data-card]', limits.cards),
      surfaces: [],
      animations: [],
    };

    const surfaceSelector = 'body, main, section, article, footer, [role="main"], [class*="bg-"], [class*="surface"], [class*="background"]';
    const minimumSurfaceWidth = Math.max(240, window.innerWidth * 0.5);
    const minimumSurfaceHeight = Math.max(120, window.innerHeight * 0.15);
    const seenSurfaces = new Set();
    evidence.surfaces = Array.from(document.querySelectorAll(surfaceSelector))
      .filter(element => {
        if (seenSurfaces.has(element)) return false;
        seenSurfaces.add(element);
        if (!isVisible(element)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width >= minimumSurfaceWidth
          && rect.height >= minimumSurfaceHeight
          && hasOpaqueBackground(style.backgroundColor);
      })
      .sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y)
      .slice(0, limits.surfaces)
      .map((element, order) => {
        const rect = element.getBoundingClientRect();
        const style = snapshotStyle(element);
        return {
          selector: selectorFor(element),
          order,
          rect: { width: rect.width, height: rect.height },
          style: {
            backgroundColor: style.backgroundColor,
            color: style.color,
            opacity: style.opacity,
            effectiveOpacity: style.effectiveOpacity,
          },
        };
      });

    evidence.animations = document.getAnimations()
      .flatMap(animation => {
        if (!animation.effect || !(animation.effect.target instanceof Element)) return [];
        const target = selectorFor(animation.effect.target);
        if (!target) return [];
        const timing = animation.effect.getTiming();
        return [{
          name: animation.animationName || animation.id || 'unnamed',
          target,
          duration: timing.duration,
          easing: timing.easing,
          iterations: timing.iterations,
          playState: animation.playState,
        }];
      })
      .slice(0, limits.animations);

    return evidence;
  });
}
