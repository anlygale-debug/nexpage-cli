// Framework + CSS layer + analytics fingerprint.
// Pure function over signals collected by the crawler.

const FRAMEWORK_BY_GLOBAL = {
  '__NEXT_DATA__': 'next',
  '__NUXT__': 'nuxt',
  '___gatsby': 'gatsby',
  '_remixContext': 'remix',
  'React': 'react',
  'Vue': 'vue',
  'Shopify': 'shopify',
  'wp': 'wordpress',
};

const SCRIPT_PATTERNS = [
  [/_next\/static/, 'next'],
  [/\/nuxt\//, 'nuxt'],
  [/\/astro\//, 'astro'],
  [/\/sveltekit\//, 'sveltekit'],
  [/shopify\./, 'shopify'],
  [/wp-(content|includes)/, 'wordpress'],
  [/webflow\.com/, 'webflow'],
  [/framerusercontent/, 'framer'],
];

const ANALYTICS = {
  gtag: /googletagmanager\.com|google-analytics/,
  plausible: /plausible\.io/,
  posthog: /posthog\.com/,
  segment: /segment\.(io|com)/,
  mixpanel: /mixpanel/,
  amplitude: /amplitude/,
  hotjar: /hotjar/,
  vercelInsights: /\/_vercel\/insights/,
};

const TAILWIND_UTIL = /(^|\s)(flex|grid|block|inline|hidden|text-(xs|sm|base|lg|xl|\d+xl)|text-(gray|slate|zinc|red|blue|green|amber|neutral|stone)-\d+|bg-(gray|slate|zinc|red|blue|green|amber|neutral|stone)-\d+|p[xy]?-\d+|m[xy]?-\d+|gap-\d+|rounded(-\w+)?|shadow(-\w+)?|items-(start|center|end|baseline|stretch)|justify-(start|center|end|between|around|evenly)|grid-cols-\d+|col-span-\d+)(\s|$)/;

function detectFramework(signals) {
  for (const g of signals.windowGlobals || []) {
    if (FRAMEWORK_BY_GLOBAL[g]) return FRAMEWORK_BY_GLOBAL[g];
  }
  for (const s of signals.scripts || []) {
    for (const [re, name] of SCRIPT_PATTERNS) if (re.test(s)) return name;
  }
  return 'unknown';
}

function detectTailwind(signals) {
  const classes = (signals.classNameSample || []).filter(c => typeof c === 'string');
  const hits = classes.filter(c => TAILWIND_UTIL.test(c));
  if (hits.length < Math.max(5, classes.length * 0.1)) return null;
  const utilFreq = new Map();
  for (const c of hits) {
    for (const u of c.split(/\s+/).filter(Boolean)) {
      utilFreq.set(u, (utilFreq.get(u) || 0) + 1);
    }
  }
  const topUtilities = [...utilFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([u, n]) => ({ utility: u, count: n }));
  return { detected: true, utilities: topUtilities };
}

function detectAnalytics(signals) {
  const found = [];
  for (const [name, re] of Object.entries(ANALYTICS)) {
    if ((signals.scripts || []).some(s => re.test(s))) found.push(name);
  }
  return found;
}

export function extractStackFingerprint(signals = {}) {
  const framework = detectFramework(signals);
  const tailwind = detectTailwind(signals);
  const css = { layer: tailwind ? 'tailwind' : 'unknown', tailwind: tailwind || null };
  return {
    framework,
    css,
    analytics: detectAnalytics(signals),
    detectedFrom: {
      globalCount: (signals.windowGlobals || []).length,
      scriptCount: (signals.scripts || []).length,
      classSampleSize: (signals.classNameSample || []).length,
    },
  };
}
