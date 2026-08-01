const DEFAULT_LINK_COLORS = new Set(['#0000ee', '#0000ff', '#551a8b']);
const GENERIC_FONT_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math',
  'fangsong', 'inherit', 'initial', 'unset',
]);

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^-?(?:\d+\.?\d*|\.\d+)(?:px)?$/i.test(trimmed)) return null;
  const number = Number.parseFloat(trimmed);
  return Number.isFinite(number) ? number : null;
}

function channelToHex(value) {
  const channel = value.endsWith('%')
    ? Math.round(Number.parseFloat(value) * 255 / 100)
    : Math.round(Number.parseFloat(value));
  if (!Number.isFinite(channel) || channel < 0 || channel > 255) return null;
  return channel.toString(16).padStart(2, '0');
}

function normalizeColor(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim().toLowerCase();
  if (!input || input === 'transparent' || input === '[object object]') return null;

  const rgb = input.match(/^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const alpha = rgb[4] === undefined
      ? 1
      : (rgb[4].endsWith('%') ? Number.parseFloat(rgb[4]) / 100 : Number.parseFloat(rgb[4]));
    if (!Number.isFinite(alpha) || alpha !== 1) return null;
    const channels = rgb.slice(1, 4).map(channelToHex);
    return channels.every(Boolean) ? `#${channels.join('')}` : null;
  }

  if (/^#[\da-f]{3}$/.test(input)) {
    return `#${[...input.slice(1)].map(char => char.repeat(2)).join('')}`;
  }
  if (/^#[\da-f]{4}$/.test(input)) {
    if (input[4] !== 'f') return null;
    return `#${[...input.slice(1, 4)].map(char => char.repeat(2)).join('')}`;
  }
  if (/^#[\da-f]{6}$/.test(input)) return input;
  if (/^#[\da-f]{8}$/.test(input)) return input.endsWith('ff') ? input.slice(0, 7) : null;
  return null;
}

function colorAlpha(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim().toLowerCase();
  if (input === 'transparent') return 0;
  const rgb = input.match(/^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (rgb) {
    if (rgb[4] === undefined) return 1;
    const alpha = rgb[4].endsWith('%') ? Number.parseFloat(rgb[4]) / 100 : Number.parseFloat(rgb[4]);
    return Number.isFinite(alpha) && alpha >= 0 && alpha <= 1 ? alpha : null;
  }
  if (/^#[\da-f]{3}$|^#[\da-f]{6}$/.test(input)) return 1;
  if (/^#[\da-f]{4}$/.test(input)) return Number.parseInt(input[4], 16) / 15;
  if (/^#[\da-f]{8}$/.test(input)) return Number.parseInt(input.slice(7), 16) / 255;
  return null;
}

function usableColor(value) {
  const color = normalizeColor(value);
  return color && !DEFAULT_LINK_COLORS.has(color) ? color : null;
}

function usableOpaqueColor(value) {
  return colorAlpha(value) === 1 ? usableColor(value) : null;
}

function firstFontFamily(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim() === '[object Object]') return null;
  const families = value.split(',')
    .map(part => part.trim().replace(/^(['"])(.*)\1$/, '$2').trim())
    .filter(Boolean);
  return families.find(family => !GENERIC_FONT_FAMILIES.has(family.toLowerCase())) || null;
}

function isVisible(item) {
  if (!item || item.visible === false) return false;
  const width = finiteNumber(item.rect?.width);
  const height = finiteNumber(item.rect?.height);
  return width !== null && height !== null && width > 0 && height > 0;
}

function colorMetrics(hex) {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
  return { chroma, lightness, saturation };
}

function verified(value, confidence, evidence) {
  return { value, confidence, evidence };
}

function cleanStyleTypography(item) {
  const family = firstFontFamily(item?.style?.fontFamily);
  if (!family) return null;
  const value = { family };
  const size = finiteNumber(item.style.fontSize);
  const lineHeight = finiteNumber(item.style.lineHeight);
  const letterSpacing = finiteNumber(item.style.letterSpacing);
  if (size !== null) value.size = size;
  if (lineHeight !== null) value.lineHeight = lineHeight;
  if (letterSpacing !== null) value.letterSpacing = letterSpacing;
  if (typeof item.style.fontWeight === 'string' && item.style.fontWeight.trim()) {
    value.weight = item.style.fontWeight.trim();
  } else if (Number.isFinite(item.style.fontWeight)) {
    value.weight = item.style.fontWeight;
  }
  return value;
}

function evidenceList(evidence, key) {
  return Array.isArray(evidence?.[key]) ? evidence[key] : [];
}

function rawScaleValue(item) {
  if (typeof item === 'number' || typeof item === 'string') return finiteNumber(item);
  return finiteNumber(item?.value ?? item?.px ?? item?.size);
}

function addRejected(rejected, path, value, reason) {
  rejected.push({ path, value: Number.isFinite(value) || typeof value === 'string' ? value : null, reason });
}

function rejectSemiTransparentColor(rejected, path, value) {
  const alpha = colorAlpha(value);
  if (alpha === null || alpha <= 0 || alpha >= 1) return false;
  addRejected(
    rejected,
    path,
    value,
    `semi-transparent color with alpha ${Number(alpha.toFixed(3))} cannot be promoted to an opaque verified semantic`,
  );
  return true;
}

function evidenceOpacity(item) {
  return finiteNumber(
    item?.style?.effectiveOpacity
      ?? item?.effectiveOpacity
      ?? item?.style?.renderedOpacity
      ?? item?.renderedOpacity
      ?? item?.style?.opacity,
  );
}

function rejectNonOpaqueEvidence(rejected, path, item) {
  const opacity = evidenceOpacity(item);
  if (opacity === null || opacity >= 1) return false;
  addRejected(
    rejected,
    `${path}.style.effectiveOpacity`,
    opacity,
    `effective opacity ${Number(opacity.toFixed(3))} is below 1 and cannot support a fully opaque verified semantic`,
  );
  return true;
}

function visibleOpaqueEvidence(evidence, key, rejected) {
  const accepted = [];
  for (const [index, item] of evidenceList(evidence, key).entries()) {
    if (!isVisible(item)) continue;
    if (rejectNonOpaqueEvidence(rejected, `evidence.${key}[${index}]`, item)) continue;
    accepted.push(item);
  }
  return accepted;
}

function selectActions(actions, rejected) {
  const groups = new Map();
  for (const [index, action] of actions.entries()) {
    if (!isVisible(action)) continue;
    rejectSemiTransparentColor(rejected, `evidence.actions[${index}].style.backgroundColor`, action.style?.backgroundColor);
    const background = usableOpaqueColor(action.style?.backgroundColor);
    if (!background) continue;
    const width = finiteNumber(action.rect?.width);
    const height = finiteNumber(action.rect?.height);
    const current = groups.get(background) || {
      background, actions: [], scopes: new Set(), area: 0, maxArea: 0,
    };
    current.actions.push(action);
    if (typeof action.scope === 'string' && action.scope) current.scopes.add(action.scope);
    current.area += width * height;
    current.maxArea = Math.max(current.maxArea, width * height);
    groups.set(background, current);
  }

  for (const group of groups.values()) {
    const { chroma } = colorMetrics(group.background);
    const repetition = Math.log2(group.actions.length + 1);
    const prominence = Math.log10(group.maxArea + 1);
    const aboveFoldMainActions = group.actions.filter(action => action.scope === 'main'
      && action.inViewport === true);
    const firstMainOrder = Math.min(...aboveFoldMainActions
      .map(action => finiteNumber(action.mainOrder))
      .filter(value => value !== null));
    const mainIntent = aboveFoldMainActions.length
      ? 12 + (firstMainOrder === 0 ? 8 : firstMainOrder === 1 ? 2 : 0)
      : 0;
    group.score = (group.scopes.size * 5) + (repetition * 2)
      + (chroma * 12) + (prominence * 2) + mainIntent;
    group.isVerified = group.actions.length > 1
      || group.scopes.size > 1
      || group.actions.some(action => action.scope === 'main');
  }
  return [...groups.values()].sort((a, b) => b.score - a.score);
}

function actionEvidence(group) {
  return {
    source: 'rendered actions',
    instances: group.actions.length,
    scopes: [...group.scopes].sort(),
    selectors: group.actions.map(action => action.selector).filter(value => typeof value === 'string'),
    rationale: group.actions.length === 1 && group.actions[0]?.scope === 'main'
      ? 'single visible primary action in the main scope'
      : 'repeated visible action treatment',
  };
}

function normalizedShape(action) {
  const clipPath = typeof action?.style?.clipPath === 'string' ? action.style.clipPath.trim() : '';
  const radius = finiteNumber(action?.style?.borderRadius);
  const value = {};
  if (clipPath && clipPath !== 'none' && clipPath !== '[object Object]') value.clipPath = clipPath;
  if (radius !== null && radius > 0) value.borderRadius = radius;
  return Object.keys(value).length ? value : null;
}

function groupActionShapes(actions) {
  const groups = new Map();
  for (const action of actions.filter(isVisible)) {
    const value = normalizedShape(action);
    if (!value) continue;
    const key = JSON.stringify(value);
    const current = groups.get(key) || { value, actions: [] };
    current.actions.push(action);
    groups.set(key, current);
  }
  return [...groups.values()];
}

function buildRoleActionShape(actionGroup, role) {
  if (!actionGroup) return null;
  const eligible = groupActionShapes(actionGroup.actions)
    .filter(group => group.actions.length > 1
      || (actionGroup.actions.length === 1 && group.actions[0]?.scope === 'main'))
    .sort((a, b) => b.actions.length - a.actions.length);
  const selected = eligible[0];
  if (!selected) return null;
  return verified(selected.value, selected.actions.length > 1 ? 0.98 : 0.86, {
    source: 'rendered actions',
    role,
    instances: selected.actions.length,
    rationale: selected.actions.length > 1
      ? `shape repeated within the ${role} action role`
      : `explicit shape on the main ${role} action`,
  });
}

function addActionShapeCandidates(actions, verifiedShapes, candidates) {
  const accepted = new Set(Object.values(verifiedShapes).map(entry => JSON.stringify(entry.value)));
  for (const group of groupActionShapes(actions)) {
    const key = JSON.stringify(group.value);
    if (accepted.has(key)) continue;
    const hasMainAction = group.actions.some(action => action.scope === 'main');
    if (group.actions.length < 2 && !hasMainAction) continue;
    candidates.push(verified(group.value, group.actions.length > 1 ? 0.68 : 0.55, {
      source: 'rendered actions without a verified semantic color role',
      instances: group.actions.length,
    }));
  }
}

function usesMonoFamily(item) {
  const family = item?.style?.fontFamily;
  return typeof family === 'string' && /(?:\bmono\b|monospace)/i.test(family);
}

function selectRepresentativeBody(bodyText) {
  const groups = new Map();
  for (const item of bodyText) {
    const typography = cleanStyleTypography(item);
    if (!typography || usesMonoFamily(item)) continue;
    const area = finiteNumber(item.rect?.width) * finiteNumber(item.rect?.height);
    const current = groups.get(typography.family) || { items: [], area: 0 };
    current.items.push(item);
    current.area += Number.isFinite(area) ? area : 0;
    groups.set(typography.family, current);
  }

  for (const group of groups.values()) {
    group.score = (Math.log2(group.items.length + 1) * 4) + (Math.log10(group.area + 1) * 2);
  }
  const familyGroup = [...groups.values()].sort((a, b) => b.score - a.score)[0];
  if (!familyGroup) return null;

  return familyGroup.items.sort((a, b) => {
    const sampleScore = item => {
      const area = finiteNumber(item.rect?.width) * finiteNumber(item.rect?.height);
      const size = finiteNumber(item.style?.fontSize) || 0;
      const semantic = /(?:^|\s|>)main(?:$|[\s.#[:>])/i.test(item.selector || '') ? 2 : 0;
      return semantic + (Math.log10((Number.isFinite(area) ? area : 0) + 1) * 2) + (Math.min(size, 32) / 16);
    };
    return sampleScore(b) - sampleScore(a);
  })[0];
}

function buildTypography(evidence, candidates) {
  const result = {};
  const headings = evidenceList(evidence, 'headings').filter(isVisible);
  const bodyText = evidenceList(evidence, 'bodyText').filter(isVisible);
  const labels = evidenceList(evidence, 'labels').filter(isVisible);
  const displayItem = headings.find(item => /(^|\s|>)h1(?=$|[.#[:\s>])/i.test(item.selector || '')) || headings[0];
  const bodyItem = selectRepresentativeBody(bodyText);
  const monoItem = [...labels, ...bodyText].find(usesMonoFamily);

  for (const [role, item, confidence] of [
    ['display', displayItem, 0.99],
    ['body', bodyItem, 0.98],
    ['mono', monoItem, 0.96],
  ]) {
    const value = cleanStyleTypography(item);
    if (!value) continue;
    result[role] = verified(value, confidence, {
      source: 'rendered semantic text',
      role,
      selector: item.selector || '',
    });
  }

  for (const item of [...headings.slice(1), ...bodyText, ...labels]) {
    const value = cleanStyleTypography(item);
    if (!value || Object.values(result).some(entry => entry.value.family === value.family)) continue;
    if (!candidates.some(entry => entry.value.family === value.family)) {
      candidates.push(verified(value, 0.62, { source: 'rendered text sample', selector: item.selector || '' }));
    }
  }
  return result;
}

function buildSpacing(design, rejected) {
  const scale = Array.isArray(design?.spacing?.scale) ? design.spacing.scale : [];
  const counts = new Map();
  for (const item of scale) {
    const value = rawScaleValue(item);
    if (value !== null) counts.set(value, (counts.get(value) || 0) + 1);
  }

  const accepted = new Map();
  scale.forEach((item, index) => {
    const value = rawScaleValue(item);
    const reportedCount = finiteNumber(item?.count) || 0;
    if (value === null) {
      addRejected(rejected, `spacing.scale[${index}]`, String(item), 'spacing must be a finite numeric value');
      return;
    }
    if (value < 4 || value > 128) {
      addRejected(rejected, `spacing.scale[${index}]`, value, 'one-off measurement outside the 4-128px spacing range');
      return;
    }
    const followsBaseRhythm = Number.isInteger(value)
      && (value <= 32 ? value % 4 === 0 : value % 8 === 0);
    const repeated = (counts.get(value) || 0) > 1 || reportedCount > 1;
    if (!followsBaseRhythm) {
      addRejected(rejected, `spacing.scale[${index}]`, value, 'layout measurement does not follow an implementation-ready 4/8px spacing rhythm');
      return;
    }
    if (!accepted.has(value)) {
      accepted.set(value, verified(value, repeated ? 0.91 : 0.84, {
        source: repeated ? 'repeated extracted spacing' : '4/8px base rhythm',
        occurrences: Math.max(counts.get(value) || 0, reportedCount),
      }));
    }
  });
  return [...accepted.values()].sort((a, b) => a.value - b.value);
}

function buildSurfaces(items, rejected) {
  const surfaces = [];
  for (const [index, item] of items.entries()) {
    rejectSemiTransparentColor(
      rejected,
      `evidence.surfaces[${index}].style.backgroundColor`,
      item?.style?.backgroundColor,
    );
    rejectSemiTransparentColor(
      rejected,
      `evidence.surfaces[${index}].style.color`,
      item?.style?.color,
    );
    const background = usableOpaqueColor(item?.style?.backgroundColor);
    if (!background) continue;
    const foreground = usableOpaqueColor(item?.style?.color);
    const area = (finiteNumber(item?.rect?.width) || 0) * (finiteNumber(item?.rect?.height) || 0);
    surfaces.push({ item, background, foreground, area, ...colorMetrics(background) });
  }
  return surfaces;
}

function buildSurfaceMaterials(surfaces) {
  const colorOccurrences = new Map();
  for (const surface of surfaces) {
    for (const color of [surface.background, surface.foreground].filter(Boolean)) {
      colorOccurrences.set(color, (colorOccurrences.get(color) || 0) + 1);
    }
  }

  const groups = new Map();
  for (const surface of surfaces) {
    const role = surface.lightness >= 0.55 ? 'surfaceLight' : 'surfaceDark';
    const key = JSON.stringify([role, surface.background, surface.foreground || '']);
    const current = groups.get(key) || {
      role,
      background: surface.background,
      foreground: surface.foreground,
      surfaces: [],
      area: 0,
    };
    current.surfaces.push(surface);
    current.area += surface.area;
    groups.set(key, current);
  }

  const selectedByRole = new Map();
  for (const group of groups.values()) {
    const supportOccurrences = colorOccurrences.get(group.background) || 0;
    if (group.surfaces.length < 2 && supportOccurrences < 2) continue;
    const current = selectedByRole.get(group.role);
    const score = (group.surfaces.length * 10) + Math.log10(group.area + 1);
    if (!current || score > current.score) selectedByRole.set(group.role, { ...group, score, supportOccurrences });
  }

  return [...selectedByRole.values()].map(group => {
    const value = { role: group.role, background: group.background };
    if (group.foreground) value.foreground = group.foreground;
    return verified(value, group.surfaces.length > 1 ? 0.97 : 0.92, {
      source: 'rendered surface material supported by repeated color evidence',
      instances: group.surfaces.length,
      supportOccurrences: group.supportOccurrences,
      selectors: group.surfaces.map(surface => surface.item.selector).filter(Boolean),
    });
  });
}

function buildActionComponent(actionGroup, role, shape) {
  if (!actionGroup || actionGroup.actions.length < 2) return null;
  const value = { role, background: actionGroup.background };
  const foregrounds = actionGroup.actions
    .map(action => usableOpaqueColor(action.style?.color))
    .filter(color => color && color !== actionGroup.background);
  const foreground = foregrounds.find(color => foregrounds.filter(item => item === color).length > 1)
    || (actionGroup.actions.length === 1 ? foregrounds[0] : null);
  if (foreground) value.foreground = foreground;
  if (shape) value.shape = shape.value;
  return verified(value, actionGroup.actions.length > 1 ? 0.97 : 0.86, {
    ...actionEvidence(actionGroup),
    role,
  });
}

function buildCardComponents(cards, rejected) {
  const groups = new Map();
  for (const [index, card] of cards.entries()) {
    for (const [property, value] of [
      ['backgroundColor', card.style?.backgroundColor],
      ['color', card.style?.color],
      ['borderColor', card.style?.borderColor],
    ]) {
      rejectSemiTransparentColor(rejected, `evidence.cards[${index}].style.${property}`, value);
    }

    const background = usableOpaqueColor(card.style?.backgroundColor);
    if (!background) continue;
    const value = { background };
    const foreground = usableOpaqueColor(card.style?.color);
    if (foreground) value.foreground = foreground;
    const borderWidth = finiteNumber(card.style?.borderWidth);
    const borderColor = usableOpaqueColor(card.style?.borderColor);
    if (borderWidth !== null && borderWidth > 0 && borderColor) {
      value.border = { width: borderWidth, color: borderColor };
    }
    const shape = normalizedShape(card);
    if (shape) value.shape = shape;

    const key = JSON.stringify(value);
    const current = groups.get(key) || { value, cards: [] };
    current.cards.push(card);
    groups.set(key, current);
  }

  return [...groups.values()]
    .filter(group => group.cards.length > 1)
    .map(group => verified(group.value, 0.96, {
      source: 'repeated rendered cards',
      instances: group.cards.length,
      selectors: group.cards.map(card => card.selector).filter(Boolean),
    }));
}

function buildMotion(design, evidence) {
  const keyframes = Array.isArray(design?.motion?.keyframes) ? design.motion.keyframes : [];
  const names = new Set(keyframes.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean));
  return evidenceList(evidence, 'animations')
    .filter(item => item?.playState === 'running'
      && typeof item.name === 'string'
      && names.has(item.name)
      && finiteNumber(item.duration) > 0)
    .map(item => {
      const value = {
        name: item.name,
        target: typeof item.target === 'string' && item.target !== '[object Object]' ? item.target : '',
        duration: finiteNumber(item.duration),
      };
      if (typeof item.easing === 'string' && item.easing && item.easing !== '[object Object]') value.easing = item.easing;
      if (Number.isFinite(item.iterations)) value.iterations = item.iterations;
      return verified(value, 0.99, {
        source: 'running rendered animation matched to extracted keyframe',
        keyframe: item.name,
      });
    });
}

function buildRhythm(surfaces, actionGroup, cards, fullPageCaptured) {
  if (!fullPageCaptured) return { surfaceSequence: [], principles: [] };
  const surfaceSequence = [];
  for (const surface of surfaces) {
    if (surfaceSequence.at(-1) !== surface.background) surfaceSequence.push(surface.background);
  }
  const principles = [];
  const tones = surfaceSequence.map(color => colorMetrics(color).lightness >= 0.55 ? 'light' : 'dark');
  if (tones.some((tone, index) => index > 0 && tone !== tones[index - 1])) {
    principles.push('Alternate light and dark surfaces to create pacing.');
  }
  if (actionGroup && actionGroup.actions.length <= Math.max(2, surfaces.length)) {
    principles.push('Use the accent color selectively for primary actions.');
  }
  if (cards.length > 1) {
    principles.push('Vary card density while preserving the surface rhythm.');
  }
  return { surfaceSequence, principles };
}

export function buildVerifiedVisualModel(design, evidence = {}, options = {}) {
  const sourceDesign = design && typeof design === 'object' ? design : {};
  const rejected = [];
  const candidates = { colors: [], typography: [], shapes: [], rhythm: [] };
  const actionEvidenceItems = visibleOpaqueEvidence(evidence, 'actions', rejected);
  const actions = selectActions(actionEvidenceItems, rejected);
  const primaryAction = actions.find(group => group.isVerified) || null;
  const surfaces = buildSurfaces(visibleOpaqueEvidence(evidence, 'surfaces', rejected), rejected);
  const cards = visibleOpaqueEvidence(evidence, 'cards', rejected);
  const headings = visibleOpaqueEvidence(evidence, 'headings', rejected);
  const bodyText = visibleOpaqueEvidence(evidence, 'bodyText', rejected);
  const labels = visibleOpaqueEvidence(evidence, 'labels', rejected);

  const model = {
    kind: 'nexpage-verified-visual-model',
    meta: {
      title: sourceDesign.meta?.title || options.hostname || 'Extracted Website',
      source: sourceDesign.meta?.url || '',
      hostname: options.hostname || '',
      elementCount: Number.isFinite(sourceDesign.meta?.elementCount) ? sourceDesign.meta.elementCount : 0,
    },
    coverage: {
      viewport: true,
      fullPage: options.fullPageCaptured === true,
      fullPageError: options.fullPageError || null,
    },
    verified: {
      colors: {}, typography: {}, spacing: [], shapes: {},
      materials: [], components: { actions: [], cards: [] }, motion: [],
    },
    candidates,
    rejected,
    rhythm: { surfaceSequence: [], principles: [] },
  };

  if (primaryAction) {
    model.verified.colors.actionPrimary = verified(
      primaryAction.background,
      primaryAction.actions.length > 1 ? 0.98 : 0.88,
      actionEvidence(primaryAction),
    );
  }
  for (const group of actions.filter(group => group !== primaryAction)) {
    candidates.colors.push(verified(group.background, group.isVerified ? 0.76 : 0.58, actionEvidence(group)));
  }

  headings.forEach((item, index) => rejectSemiTransparentColor(
    rejected,
    `evidence.headings[${index}].style.color`,
    item.style?.color,
  ));
  bodyText.forEach((item, index) => rejectSemiTransparentColor(
    rejected,
    `evidence.bodyText[${index}].style.color`,
    item.style?.color,
  ));
  const headingColors = new Set(headings.map(item => usableOpaqueColor(item.style?.color)).filter(Boolean));
  const sharedInk = bodyText.map(item => usableOpaqueColor(item.style?.color)).find(color => color && headingColors.has(color));
  if (sharedInk) {
    model.verified.colors.ink = verified(sharedInk, 0.99, {
      source: 'rendered semantic text',
      roles: ['heading', 'body'],
    });
  }

  const lightSurfaces = surfaces.filter(surface => surface.lightness >= 0.55)
    .sort((a, b) => ((a.item.selector === 'body' ? 1 : 0) - (b.item.selector === 'body' ? 1 : 0)) * -1 || b.area - a.area);
  if (lightSurfaces[0]) {
    model.verified.colors.surface = verified(lightSurfaces[0].background, 0.97, {
      source: 'rendered body or large light surface',
      selector: lightSurfaces[0].item.selector || '',
    });
  }

  const darkSurfaces = surfaces.filter(surface => surface.lightness < 0.55);
  model.verified.materials = buildSurfaceMaterials(surfaces);

  const secondaryAction = actions.find(group => group !== primaryAction
    && group.isVerified
    && darkSurfaces.some(surface => surface.background === group.background));
  if (secondaryAction) {
    model.verified.colors.actionSecondary = verified(
      secondaryAction.background,
      0.9,
      actionEvidence(secondaryAction),
    );
    model.candidates.colors = model.candidates.colors.filter(item => item.value !== secondaryAction.background);
  }

  model.verified.typography = buildTypography({ headings, bodyText, labels }, candidates.typography);
  model.verified.spacing = buildSpacing(sourceDesign, rejected);

  const primaryShape = buildRoleActionShape(primaryAction, 'primary');
  if (primaryShape) model.verified.shapes.actionPrimary = primaryShape;
  const secondaryShape = buildRoleActionShape(secondaryAction, 'secondary');
  if (secondaryShape) model.verified.shapes.actionSecondary = secondaryShape;
  addActionShapeCandidates(actionEvidenceItems, model.verified.shapes, candidates.shapes);

  const primaryComponent = buildActionComponent(primaryAction, 'primary', primaryShape);
  if (primaryComponent) model.verified.components.actions.push(primaryComponent);
  const secondaryComponent = buildActionComponent(secondaryAction, 'secondary', secondaryShape);
  if (secondaryComponent) model.verified.components.actions.push(secondaryComponent);
  model.verified.components.cards = buildCardComponents(cards, rejected);

  model.verified.motion = buildMotion(sourceDesign, evidence);

  const rawColors = Array.isArray(sourceDesign.colors?.all) ? sourceDesign.colors.all : [];
  rawColors.forEach((item, index) => {
    const raw = typeof item === 'string' ? item : item?.hex ?? item?.value;
    const normalized = normalizeColor(raw);
    if (!normalized) {
      const alpha = colorAlpha(raw);
      addRejected(
        rejected,
        `colors.all[${index}]`,
        String(raw),
        alpha !== null && alpha > 0 && alpha < 1
          ? `semi-transparent color with alpha ${Number(alpha.toFixed(3))} cannot be promoted to an opaque verified semantic`
          : 'empty, transparent, or invalid color',
      );
    } else if (DEFAULT_LINK_COLORS.has(normalized)) {
      addRejected(rejected, `colors.all[${index}]`, normalized, 'browser default link color is not semantic evidence');
    } else if (!Object.values(model.verified.colors).some(entry => entry.value === normalized)
      && !candidates.colors.some(entry => entry.value === normalized)) {
      candidates.colors.push(verified(normalized, 0.35, { source: 'raw frequency only' }));
    }
  });

  model.rhythm = buildRhythm(surfaces, primaryAction, cards, model.coverage.fullPage);
  return model;
}
