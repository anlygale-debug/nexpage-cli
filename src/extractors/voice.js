// Brand voice extraction — microcopy patterns from CTA verbs, headings, and section copy.
// Feeds LLMs the *tone*, not just the paint.

const IMPERATIVE_VERBS = new Set([
  'get', 'start', 'try', 'build', 'create', 'ship', 'deploy', 'launch', 'learn', 'read',
  'buy', 'shop', 'explore', 'discover', 'join', 'sign', 'subscribe', 'book', 'download',
  'install', 'contact', 'talk', 'request', 'view', 'see', 'watch', 'read', 'meet',
]);

const FRIENDLY_MARKERS = /\b(we|our|us|you|your|let's|hey|welcome|thanks|love|yay|awesome)\b/i;
const FORMAL_MARKERS = /\b(enterprise|platform|solution|infrastructure|comprehensive|leverage|empower|facilitate|utilize)\b/i;
const TECHNICAL_MARKERS = /\b(api|sdk|webhook|latency|throughput|cli|runtime|schema|endpoint|token|typescript|kubernetes)\b/i;
const PLAYFUL_MARKERS = /[!?]{1,2}$|\b(magic|wow|boom|zap|rocket|sparkle|fire)\b|[✨🚀🔥⚡💫]/i;

function words(str) {
  return (str || '').toLowerCase().match(/[a-z']+/g) || [];
}

function firstVerb(text) {
  const w = words(text);
  for (const word of w) {
    if (IMPERATIVE_VERBS.has(word)) return word;
  }
  return w[0] || '';
}

function scoreTone(texts) {
  const joined = texts.join(' ');
  return {
    friendly: (joined.match(FRIENDLY_MARKERS) || []).length,
    formal: (joined.match(FORMAL_MARKERS) || []).length,
    technical: (joined.match(TECHNICAL_MARKERS) || []).length,
    playful: (joined.match(PLAYFUL_MARKERS) || []).length,
  };
}

function pickTone(scores) {
  const entries = Object.entries(scores);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (total === 0) return 'neutral';
  const [top] = entries.sort((a, b) => b[1] - a[1]);
  return top[1] / total > 0.4 ? top[0] : 'neutral';
}

function topN(arr, n = 10) {
  const counts = {};
  for (const v of arr) if (v) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
}

function avgLen(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, v) => s + v.length, 0) / arr.length);
}

export function extractVoice({ componentCandidates = [], sections = [] } = {}) {
  const buttons = componentCandidates.filter(c => c.kind === 'button' || c.kind === 'link').map(c => c.text).filter(Boolean);
  const headings = sections.flatMap(s => s.headings || []).filter(Boolean);
  const sectionTexts = sections.map(s => s.text || '').filter(Boolean);

  const ctaVerbs = buttons.map(firstVerb).filter(Boolean);
  const buttonPatterns = topN(buttons.map(b => b.toLowerCase().trim()), 15);
  const ctaTopVerbs = topN(ctaVerbs, 10);

  const tone = pickTone(scoreTone([...buttons, ...headings, ...sectionTexts]));
  const personPronoun = /\byou\b/i.test(headings.join(' ') + sectionTexts.join(' '))
    ? (/\bwe\b/i.test(headings.join(' ')) ? 'we→you' : 'you-only')
    : (/\bwe\b/i.test(headings.join(' ')) ? 'we-only' : 'third-person');

  const headingStyle = (() => {
    if (!headings.length) return 'unknown';
    const titleCase = headings.filter(h => /^[A-Z]/.test(h) && /\s[A-Z]/.test(h)).length;
    const sentenceCase = headings.filter(h => /^[A-Z]/.test(h) && !/\s[A-Z]/.test(h)).length;
    const allLower = headings.filter(h => h === h.toLowerCase()).length;
    if (allLower > headings.length / 2) return 'all-lowercase';
    if (titleCase > sentenceCase) return 'Title Case';
    return 'Sentence case';
  })();

  const avgHeadingWords = avgLen(headings.map(h => words(h))) / Math.max(avgLen(headings) || 1, 1) * (avgLen(headings) || 1);
  const headingLengthClass = avgHeadingWords <= 4 ? 'tight' : avgHeadingWords <= 8 ? 'balanced' : 'verbose';

  return {
    tone,
    pronoun: personPronoun,
    headingStyle,
    headingLengthClass,
    ctaVerbs: ctaTopVerbs,
    buttonPatterns,
    sampleHeadings: headings.slice(0, 10),
    stats: {
      buttons: buttons.length,
      headings: headings.length,
    },
  };
}
