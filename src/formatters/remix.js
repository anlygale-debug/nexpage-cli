// nexpage remix — render an extracted page-shape in a different design vocabulary.
//
// Inputs: the design object from extractDesignLanguage() (we read meta, voice,
// pageIntent, sectionRoles) + a vocabulary from src/vocabularies/.
// Output: a self-contained single HTML file. Same content, different language.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function host(url) {
  try { return new URL(url).hostname; } catch { return String(url || ''); }
}

function pickHeadings(design, count = 6) {
  const fromVoice = (design.voice?.sampleHeadings || []).filter(Boolean);
  const fromSections = (design.sectionRoles?.sections || [])
    .map(s => s.heading || s.slots?.heading)
    .filter(Boolean);
  const merged = [...new Set([...fromVoice, ...fromSections])];
  return merged.slice(0, count);
}

function pickCtas(design, count = 4) {
  const verbs = (design.voice?.ctaVerbs || []).filter(Boolean);
  const phrases = verbs.map(v => {
    if (typeof v === 'string') return v;
    return v.verb || v.text || v.phrase || '';
  }).filter(Boolean);
  if (phrases.length >= count) return phrases.slice(0, count);
  // Pad with generic verbs informed by tone.
  const tone = design.voice?.tone || 'neutral';
  const fallback = tone === 'playful' ? ['Try it', 'Get started', 'See it', 'Play']
    : tone === 'technical' ? ['Read docs', 'Get started', 'View API', 'Install']
    : tone === 'formal' ? ['Begin', 'Continue', 'Learn more', 'Contact']
    : ['Get started', 'Learn more', 'Sign up', 'See more'];
  return [...phrases, ...fallback].slice(0, count);
}

// Map each section role to a vocabulary-styled markup block.
function renderSection(section, ctx) {
  const { vocab, headings, ctas, design } = ctx;
  const sectionHeading = section.heading || section.slots?.heading || headings.shift() || vocab.name;
  const lede = section.slots?.lede || '';
  const role = section.role;
  const buttonCount = Math.max(1, section.buttonCount || 1);

  switch (role) {
    case 'nav':
    case 'footer':
      return ''; // rendered globally outside sections

    case 'hero': {
      const ctaSet = ctas.slice(0, Math.max(1, Math.min(2, buttonCount)));
      return `
        <section class="v-hero">
          <p class="v-pill">${esc((design.pageIntent?.type || 'landing').toUpperCase())}</p>
          <h1 class="v-display v-h1">${esc(sectionHeading)}</h1>
          ${lede ? `<p class="v-lede">${esc(lede)}</p>` : ''}
          <div class="v-cta-row">
            ${ctaSet.map((c, i) => `<a href="#" class="v-cta${i > 0 ? ' v-cta-ghost' : ''}">${esc(c)}</a>`).join('')}
          </div>
        </section>`;
    }

    case 'feature-grid':
    case 'bento': {
      const items = headings.splice(0, 3);
      while (items.length < 3) items.push('Feature');
      return `
        <section class="v-section">
          <h2 class="v-display v-h2">${esc(sectionHeading)}</h2>
          ${lede ? `<p class="v-lede">${esc(lede)}</p>` : ''}
          <div class="v-grid v-grid-3">
            ${items.map(t => `
              <div class="v-card">
                <div class="v-card-num">·</div>
                <h3 class="v-display v-h3">${esc(t)}</h3>
                <p class="v-body">${esc(squeeze(lede || sectionHeading, 90))}</p>
              </div>`).join('')}
          </div>
        </section>`;
    }

    case 'stats': {
      const numbers = ['10×', '99.9%', '< 50ms', '500K+'];
      return `
        <section class="v-section v-section-rule">
          <h2 class="v-display v-h2">${esc(sectionHeading)}</h2>
          <div class="v-grid v-grid-4">
            ${numbers.map((n, i) => `
              <div class="v-stat">
                <div class="v-display v-stat-num">${esc(n)}</div>
                <div class="v-pill">${esc((headings[i] || ['speed','uptime','latency','users'][i]).toUpperCase())}</div>
              </div>`).join('')}
          </div>
        </section>`;
    }

    case 'testimonial': {
      return `
        <section class="v-section v-section-quiet">
          <blockquote class="v-quote">
            <p class="v-display v-quote-text">"${esc(lede || sectionHeading)}"</p>
            <footer class="v-quote-attrib">— ${esc(headings.shift() || 'A satisfied user')}</footer>
          </blockquote>
        </section>`;
    }

    case 'pricing-table': {
      const tiers = headings.splice(0, 3);
      while (tiers.length < 3) tiers.push('Plan');
      const prices = ['$0', '$29', '$99'];
      return `
        <section class="v-section">
          <h2 class="v-display v-h2">${esc(sectionHeading)}</h2>
          <div class="v-grid v-grid-3">
            ${tiers.map((t, i) => `
              <div class="v-card${i === 1 ? ' v-card-emphasis' : ''}">
                <p class="v-pill">${esc(t.toUpperCase())}</p>
                <div class="v-display v-price">${esc(prices[i])}</div>
                <a href="#" class="v-cta">${esc(ctas[i] || 'Choose')}</a>
              </div>`).join('')}
          </div>
        </section>`;
    }

    case 'faq': {
      const qs = headings.splice(0, 4);
      while (qs.length < 3) qs.push('A common question');
      return `
        <section class="v-section">
          <h2 class="v-display v-h2">${esc(sectionHeading)}</h2>
          <div class="v-faq">
            ${qs.map(q => `
              <details class="v-faq-item">
                <summary class="v-faq-q">${esc(q)}</summary>
                <p class="v-body">${esc(squeeze(lede || 'A short, useful answer in the voice of the original site.', 240))}</p>
              </details>`).join('')}
          </div>
        </section>`;
    }

    case 'logo-wall': {
      return `
        <section class="v-section v-section-quiet">
          <p class="v-pill v-pill-center">${esc(sectionHeading || 'Trusted by')}</p>
          <div class="v-logos">
            ${Array.from({ length: 6 }).map((_, i) => `<div class="v-logo">${esc((headings[i] || `BRAND ${i + 1}`).toUpperCase())}</div>`).join('')}
          </div>
        </section>`;
    }

    case 'steps': {
      const steps = headings.splice(0, 3);
      while (steps.length < 3) steps.push('Step');
      return `
        <section class="v-section">
          <h2 class="v-display v-h2">${esc(sectionHeading)}</h2>
          <ol class="v-steps">
            ${steps.map((s, i) => `
              <li class="v-step">
                <span class="v-display v-step-num">${String(i + 1).padStart(2, '0')}</span>
                <h3 class="v-display v-h3">${esc(s)}</h3>
                <p class="v-body">${esc(squeeze(lede || s, 120))}</p>
              </li>`).join('')}
          </ol>
        </section>`;
    }

    case 'cta': {
      const ctaSet = ctas.slice(0, 2);
      return `
        <section class="v-section v-section-cta">
          <h2 class="v-display v-h2">${esc(sectionHeading)}</h2>
          ${lede ? `<p class="v-lede">${esc(lede)}</p>` : ''}
          <div class="v-cta-row">
            ${ctaSet.map((c, i) => `<a href="#" class="v-cta${i > 0 ? ' v-cta-ghost' : ''}">${esc(c)}</a>`).join('')}
          </div>
        </section>`;
    }

    default: {
      return `
        <section class="v-section">
          <h2 class="v-display v-h2">${esc(sectionHeading)}</h2>
          ${lede ? `<p class="v-body">${esc(lede)}</p>` : ''}
        </section>`;
    }
  }
}

function squeeze(s, max) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut) + '…';
}

export function formatRemix(design, vocab, opts = {}) {
  if (!design) throw new Error('remix: design is required');
  if (!vocab || !vocab.tokens) throw new Error('remix: vocabulary is required');

  const url = design.meta?.url || '';
  const hostName = host(url);
  const title = design.meta?.title || hostName;
  const ctas = pickCtas(design, 6);

  // Dedup adjacent sections that share the same heading. Real-world section
  // walkers (especially on SPA-rendered marketing pages) often emit a hero
  // wrapper + an inner hero with identical h1 — visually one block, but two
  // entries in sectionRoles.sections.
  const seenHeadings = new Set();
  const sections = (design.sectionRoles?.sections || [])
    .filter(s => s.role !== 'nav' && s.role !== 'footer')
    .filter(s => {
      const h = (s.heading || s.slots?.heading || '').trim().toLowerCase().slice(0, 80);
      if (!h) return true; // keep heading-less sections (logo-walls, footers)
      if (seenHeadings.has(h)) return false;
      seenHeadings.add(h);
      return true;
    })
    .slice(0, 8);

  // Headings pool for sections that don't carry their own. Exclude any heading
  // already claimed by a kept section so heading-less sections (cta bands,
  // logo-walls) don't shift a heading that another section will also render.
  const claimed = new Set(
    sections
      .map(s => (s.heading || s.slots?.heading || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const headings = pickHeadings(design, 16).filter(
    h => !claimed.has(h.trim().toLowerCase()),
  );

  // If extraction surfaced no sections (rare, but happens for SPA-rendered
  // pages), synthesize a hero + features + cta from voice + intent so the
  // remix still produces a believable artifact.
  if (sections.length === 0) {
    sections.push(
      { role: 'hero', heading: headings[0] || hostName, slots: { lede: design.pageIntent?.signals?.[0] }, buttonCount: 2 },
      { role: 'feature-grid', heading: headings[1] || 'What it does', slots: {} },
      { role: 'cta', heading: headings[2] || 'Get started', slots: {} },
    );
  }

  const ctx = { vocab, headings: [...headings], ctas, design };
  const sectionsHtml = sections.map(s => renderSection(s, ctx)).join('');

  const t = vocab.tokens;
  const fontImports = [vocab.fonts?.display?.import, vocab.fonts?.body?.import]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  const ogTitle = `${hostName} · remixed as ${vocab.name.toLowerCase()}`;
  const ogDesc = `${title} reimagined in the ${vocab.name} vocabulary by nexpage.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ogTitle)}</title>
<meta name="description" content="${esc(ogDesc)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
${fontImports.map(href => `<link href="${esc(href)}" rel="stylesheet">`).join('')}
<style>
  :root {
    --paper: ${t.paper};
    --ink: ${t.ink};
    --ink-soft: ${t.inkSoft};
    --accent: ${t.accent};
    --rule: ${t.rule};
    --radius: ${t.radius};
    --radius-lg: ${t.radiusLg};
    --shadow: ${t.shadow};
    --shadow-sm: ${t.shadowSm};
    --container: ${t.container};
    --rhythm: ${t.rhythm};
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  ${vocab.css || ''}
  .v-wrap { max-width: var(--container); margin: 0 auto; padding: 40px 32px 80px; }
  @media (max-width: 640px) { .v-wrap { padding: 28px 20px 56px; } }
  .v-topbar { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 18px; border-bottom: 1px solid var(--rule); margin-bottom: 64px; }
  .v-topbar .v-brand { font-family: var(--vocab-display); font-size: 22px; }
  .v-topbar .v-meta { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); }

  /* — Hero — */
  .v-hero { padding: 32px 0 80px; }
  .v-h1 { font-size: clamp(40px, 7vw, 88px); margin: 18px 0 22px; }
  .v-h2 { font-size: clamp(28px, 4vw, 48px); margin: 0 0 18px; }
  .v-h3 { font-size: 20px; margin: 12px 0 8px; }
  .v-lede { font-size: clamp(17px, 1.6vw, 22px); line-height: 1.5; max-width: 56ch; margin: 0 0 28px; color: var(--ink-soft); }
  .v-body { font-size: 14px; line-height: var(--rhythm); margin: 0; color: var(--ink-soft); }
  .v-cta-row { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
  .v-cta-ghost { background: transparent !important; color: var(--ink) !important; border-color: var(--ink) !important; box-shadow: none !important; }

  /* — Sections — */
  section.v-section { padding: 64px 0; border-top: 1px solid var(--rule); }
  section.v-section-quiet { background: rgba(0,0,0,0.015); border-radius: var(--radius-lg); padding: 56px 48px; margin: 32px 0; }
  section.v-section-cta { text-align: center; padding: 96px 0; border-top: 1px solid var(--rule); }
  section.v-section-cta .v-cta-row { justify-content: center; }
  section.v-section-rule .v-grid { padding-top: 28px; border-top: 1px solid var(--rule); }

  /* — Grids — */
  .v-grid { display: grid; gap: 28px; margin-top: 28px; }
  .v-grid-3 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .v-grid-4 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
  .v-card { padding: 24px; }
  .v-card-num { font-family: var(--vocab-display); font-size: 32px; opacity: .35; margin-bottom: 8px; }
  .v-card-emphasis { transform: translateY(-8px); }

  /* — Stats — */
  .v-stat { padding: 12px 0; }
  .v-stat-num { font-size: clamp(36px, 4vw, 56px); line-height: 1; margin-bottom: 8px; }

  /* — Quote — */
  .v-quote { margin: 0; padding: 0; }
  .v-quote-text { font-size: clamp(22px, 3vw, 38px); line-height: 1.25; margin: 0 0 24px; }
  .v-quote-attrib { font-size: 14px; color: var(--ink-soft); }

  /* — Pricing — */
  .v-price { font-size: clamp(40px, 5vw, 72px); line-height: 1; margin: 14px 0 22px; }

  /* — FAQ — */
  .v-faq { margin-top: 28px; }
  .v-faq-item { padding: 20px 0; border-top: 1px solid var(--rule); }
  .v-faq-item[open] { padding-bottom: 24px; }
  .v-faq-q { font-family: var(--vocab-display); font-size: 20px; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; }
  .v-faq-q::after { content: '+'; font-size: 24px; color: var(--ink-soft); transition: transform .2s; }
  .v-faq-item[open] .v-faq-q::after { transform: rotate(45deg); }
  .v-faq-q::-webkit-details-marker { display: none; }

  /* — Logos — */
  .v-pill-center { display: inline-block; }
  .v-logos { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 24px; margin-top: 28px; }
  .v-logo { font-family: var(--vocab-display); font-weight: 700; opacity: .55; padding: 12px 0; text-align: center; letter-spacing: .04em; }

  /* — Steps — */
  .v-steps { list-style: none; padding: 0; margin: 32px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 32px; counter-reset: step; }
  .v-step { padding-top: 12px; border-top: 2px solid var(--ink); }
  .v-step-num { font-size: 32px; opacity: .25; margin-bottom: 10px; display: block; }

  /* — Footer — */
  footer.v-footer { margin-top: 96px; padding-top: 32px; border-top: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 16px; font-size: 12px; }
  footer.v-footer .v-sig { font-family: var(--vocab-display); font-size: 22px; }
  footer.v-footer code { font-family: ${vocab.fonts?.body?.family ? `'${vocab.fonts.body.family}'` : 'ui-monospace'}, monospace; font-size: 11px; }
</style>
</head>
<body>
  <main class="v-wrap">
    <header class="v-topbar">
      <div class="v-brand">${esc(hostName)}</div>
      <div class="v-meta">remixed · ${esc(vocab.name)}</div>
    </header>

    ${sectionsHtml}

    <footer class="v-footer">
      <div>
        <div class="v-sig">${esc(hostName)} <span class="v-mark">×</span> ${esc(vocab.name)}</div>
        <div class="v-meta" style="margin-top:6px">${esc(title)}</div>
      </div>
      <div>
        <code>npx nexpage remix ${esc(hostName)} --as ${esc(opts.vocabId || '')}</code>
      </div>
    </footer>
  </main>
</body>
</html>`;
}
