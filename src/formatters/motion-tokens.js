// Emits a DTCG-flavored motion tokens JSON.
export function formatMotionTokens(motion) {
  if (!motion) return '{}';
  const out = {
    $description: 'Motion tokens extracted by nexpage',
    duration: {},
    easing: {},
    spring: {},
  };
  for (const d of motion.durations || []) {
    out.duration[d.name] = { $value: d.css, $type: 'duration', ms: d.ms };
  }
  for (const e of motion.easings || []) {
    const slug = e.family + (e.raw.includes('cubic-bezier') ? `-${Math.abs(e.raw.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 1000}` : '');
    out.easing[slug] = { $value: e.raw, $type: 'cubicBezier', family: e.family };
  }
  (motion.springs || []).forEach((s, i) => {
    out.spring[`spring-${i + 1}`] = { $value: s.raw, $type: 'cubicBezier', overshoot: true };
  });
  out.$meta = { feel: motion.feel, scrollLinked: !!motion.scrollLinked?.present };
  return JSON.stringify(out, null, 2);
}
