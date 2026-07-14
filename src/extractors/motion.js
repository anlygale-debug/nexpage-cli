// Motion v2 — rich motion language extraction.
// Classifies easings into semantic families, detects springs/bounces,
// catches scroll/view-timeline usage, and emits motion tokens (duration, easing, spring).

const MS = v => {
  if (!v) return 0;
  const m = String(v).match(/(-?\d+\.?\d*)(m?s)?/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2] === 's' ? n * 1000 : n;
};

const DURATION_NAMES = [
  { max: 80, name: 'instant' },
  { max: 150, name: 'xs' },
  { max: 250, name: 'sm' },
  { max: 400, name: 'md' },
  { max: 700, name: 'lg' },
  { max: 1200, name: 'xl' },
  { max: Infinity, name: 'xxl' },
];

function nameDuration(ms) {
  return DURATION_NAMES.find(d => ms <= d.max).name;
}

function classifyCubicBezier(raw) {
  const m = raw.match(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  if (!m) return { family: 'custom', raw };
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  if (y1 < 0 || y2 > 1 || y2 < 0 || y1 > 1) return { family: 'spring', raw, overshoot: true };
  if (x1 < 0.2 && x2 > 0.8) return { family: 'ease-in-out', raw };
  if (x1 < 0.2 && y1 < 0.2) return { family: 'ease-out', raw };
  if (x2 > 0.8 && y2 > 0.8) return { family: 'ease-in', raw };
  if (y1 < x1 && y2 < x2) return { family: 'ease-in', raw };
  if (y1 > x1 && y2 > x2) return { family: 'ease-out', raw };
  return { family: 'custom', raw };
}

function classifyEasing(raw) {
  if (!raw) return { family: 'linear', raw };
  if (raw === 'linear') return { family: 'linear', raw };
  if (raw === 'ease' || raw === 'ease-in-out') return { family: 'ease-in-out', raw };
  if (raw === 'ease-in') return { family: 'ease-in', raw };
  if (raw === 'ease-out') return { family: 'ease-out', raw };
  if (/cubic-bezier/.test(raw)) return classifyCubicBezier(raw);
  if (/steps/.test(raw)) return { family: 'steps', raw };
  return { family: 'custom', raw };
}

function isBounceKeyframe(kf) {
  if (!kf.steps || kf.steps.length < 3) return false;
  const first = kf.steps.find(s => s.offset === '0%' || s.offset === 'from');
  const last = kf.steps.find(s => s.offset === '100%' || s.offset === 'to');
  if (!first || !last) return false;
  return first.style.replace(/\s+/g, '') === last.style.replace(/\s+/g, '');
}

function keyframeKind(kf) {
  const props = new Set();
  const values = [];
  for (const step of kf.steps || []) {
    for (const part of (step.style || '').split(';')) {
      const [p, v] = part.split(':').map(s => (s || '').trim());
      if (p) props.add(p);
      if (v) values.push(v);
    }
  }
  const has = p => props.has(p);
  const anyValue = re => values.some(v => re.test(v));
  if (has('transform') && anyValue(/translate/i)) {
    if (anyValue(/translateY\(-?\d/)) return 'slide-y';
    if (anyValue(/translateX\(-?\d/)) return 'slide-x';
    return 'slide';
  }
  if (has('opacity') && !has('transform')) return 'fade';
  if (has('opacity') && has('transform')) return 'reveal';
  if (anyValue(/rotate/)) return 'rotate';
  if (anyValue(/scale/)) return 'scale';
  if (isBounceKeyframe(kf)) return 'pulse';
  return 'custom';
}

export function extractMotion(computedStyles, keyframes = []) {
  const transitions = new Set();
  const easingRaw = new Set();
  const durations = [];
  const animationRefs = new Map();
  const transitionedProps = {};
  const scrollSignals = new Set();
  let animatingElements = 0;

  for (const el of computedStyles) {
    let isAnimating = false;
    // Cap inputs to defang any pathological CSS that could trigger
    // polynomial-time regex backtracking. Real values are <200 chars.
    const transition = (el.transition || '').slice(0, 2000);
    if (transition && transition !== 'all 0s ease 0s' && transition !== 'none') {
      transitions.add(transition);
      isAnimating = true;
      // Tightened: bounded \d{1,8} and bounded fractional part — no nested quantifiers.
      for (const m of transition.matchAll(/(?<![(\d])(\d{1,8}(?:\.\d{1,4})?m?s)(?![)\w])/g)) durations.push(MS(m[1]));
      // Tightened: limit cubic-bezier/steps inner content to 64 chars.
      for (const m of transition.matchAll(/(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\([^)]{1,64}\)|steps\([^)]{1,64}\))/g)) easingRaw.add(m[1]);
      for (const part of transition.split(',')) {
        const prop = part.trim().split(/\s+/)[0];
        if (prop && prop !== 'all') transitionedProps[prop] = (transitionedProps[prop] || 0) + 1;
      }
    }
    const animation = (el.animation || '').slice(0, 2000);
    if (animation && animation !== 'none 0s ease 0s 1 normal none running' && animation !== 'none') {
      // Tightened: bound the identifier length so backtracking is linear.
      const nameMatch = animation.match(/([a-zA-Z_][\w-]{0,127})$/) || animation.match(/^([a-zA-Z_][\w-]{0,127})/);
      if (nameMatch) {
        const name = nameMatch[1];
        if (name !== 'none' && name !== 'running' && name !== 'paused') {
          animationRefs.set(name, (animationRefs.get(name) || 0) + 1);
        }
      }
      isAnimating = true;
    }
    if (el.animationTimeline && el.animationTimeline !== 'auto' && el.animationTimeline !== 'none' && el.animationTimeline !== '') {
      scrollSignals.add(el.animationTimeline);
    }
    if (el.viewTimelineName) scrollSignals.add(`view:${el.viewTimelineName}`);
    if (el.scrollTimelineName) scrollSignals.add(`scroll:${el.scrollTimelineName}`);
    if (isAnimating) animatingElements++;
  }

  const uniqueDurations = [...new Set(durations.filter(d => d > 0))].sort((a, b) => a - b);
  const durationTokens = uniqueDurations.map(ms => ({
    name: nameDuration(ms),
    ms,
    css: ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`,
  }));
  // dedupe by name — keep first (smallest) per bucket
  const seenName = new Set();
  const namedDurations = [];
  for (const t of durationTokens) {
    if (seenName.has(t.name)) continue;
    seenName.add(t.name);
    namedDurations.push(t);
  }

  const easings = [...easingRaw].map(e => ({ ...classifyEasing(e), count: computedStyles.filter(c => (c.transition || '').includes(e)).length }));
  const springs = easings.filter(e => e.family === 'spring');

  const enrichedKeyframes = (keyframes || []).map(kf => ({
    name: kf.name,
    steps: kf.steps,
    kind: keyframeKind(kf),
    isBounce: isBounceKeyframe(kf),
    used: animationRefs.has(kf.name),
    usageCount: animationRefs.get(kf.name) || 0,
    propertiesAnimated: [...new Set((kf.steps || []).flatMap(s => (s.style || '').split(';').map(d => d.split(':')[0].trim()).filter(Boolean)))],
  }));

  const transitionTop = Object.entries(transitionedProps).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([property, count]) => ({ property, count }));

  // Motion language fingerprint — what does this site's motion *feel* like?
  const totalUses = easings.reduce((s, e) => s + e.count, 0);
  const share = family => easings.filter(e => e.family === family).reduce((s, e) => s + e.count, 0) / (totalUses || 1);
  const feel = springs.length > 0
    ? 'springy'
    : share('ease-out') > 0.5
      ? 'responsive'
      : share('ease-in-out') > 0.5
        ? 'smooth'
        : share('linear') > 0.5
          ? 'mechanical'
          : 'mixed';

  return {
    durations: namedDurations,
    easings,
    springs,
    keyframes: enrichedKeyframes,
    transitionedProperties: transitionTop,
    scrollLinked: {
      present: scrollSignals.size > 0,
      signals: [...scrollSignals],
    },
    stats: {
      animatingElements,
      transitionCount: transitions.size,
      keyframeCount: enrichedKeyframes.length,
      keyframeUnused: enrichedKeyframes.filter(k => !k.used).length,
    },
    feel,
  };
}
