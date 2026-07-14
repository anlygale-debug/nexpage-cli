// nexpage pair — editorial preview HTML for a fused design.
//
// Shows both source sites + the fused result side-by-side, with a clear
// matrix of which axis came from which source. Companion to the brand
// book, which the same fused design also feeds into.

const FONT_DISPLAY = 'Instrument Serif';
const FONT_BODY = 'Inter';
const FONT_MONO = 'JetBrains Mono';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function host(url) {
  try { return new URL(url).hostname; } catch { return String(url || ''); }
}

function familyName(f) {
  if (!f) return '';
  if (typeof f === 'string') return f;
  return f.name || f.family || '';
}

function paletteStrip(design, n = 10) {
  const all = (design?.colors?.all || []).slice(0, n);
  if (!all.length) return '<span class="muted">—</span>';
  return all.map(c => `<span class="chip" style="background:${esc(c?.hex || c)}" title="${esc(c?.hex || c)}"></span>`).join('');
}

function primaryHex(design) {
  return design?.colors?.primary?.hex
    || (design?.colors?.all || []).find(c => c?.hex)?.hex
    || '#141414';
}

function topFamily(design) {
  const f = (design?.typography?.families || [])[0];
  return familyName(f) || 'system-ui';
}

function topHeading(design) {
  const headings = (design?.voice?.sampleHeadings || []).filter(h => typeof h === 'string' && h.length > 4 && h.length < 120);
  return headings[0] || 'Quick brown fox jumps over the lazy dog.';
}

export function formatPair(designA, designB, fused, summary, opts = {}) {
  if (!designA || !designB || !fused) throw new Error('formatPair: all three designs are required');

  const hostA = host(designA.meta?.url);
  const hostB = host(designB.meta?.url);
  const axes = summary?.axes || fused.fusedAxes || {};
  const accent = primaryHex(fused);

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const ogTitle = `${hostA} × ${hostB} · nexpage pair`;
  const ogDesc = `Fused design system — ${hostA} crossed with ${hostB} along ${Object.keys(axes).length} axes.`;

  // Six axes drive the matrix. We render a 6-row table so the viewer
  // can see at a glance which dimension came from which source.
  const axisLabels = [
    ['colors',     'Colour'],
    ['typography', 'Typography'],
    ['spacing',    'Spacing'],
    ['shape',      'Shape'],
    ['motion',     'Motion'],
    ['voice',      'Voice'],
    ['components', 'Components'],
  ];

  const sampleHead = topHeading(fused);

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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(FONT_DISPLAY)}&family=${encodeURIComponent(FONT_BODY)}:wght@400;500;600&family=${encodeURIComponent(FONT_MONO)}:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --paper: #f6f3ec;
    --paper-2: #efebe1;
    --ink: #131313;
    --ink-soft: #555048;
    --ink-faint: #8a8579;
    --rule: #e0dccf;
    --accent: ${esc(accent)};
    --display: '${FONT_DISPLAY}', 'Times New Roman', serif;
    --body: '${FONT_BODY}', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    --mono: '${FONT_MONO}', ui-monospace, 'SF Mono', monospace;
  }
  [data-theme="dark"] {
    --paper: #0d0c0a;
    --paper-2: #15140f;
    --ink: #ece8de;
    --ink-soft: #9d978a;
    --ink-faint: #5b574e;
    --rule: #292621;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: var(--paper); color: var(--ink); font-family: var(--body); font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; transition: background .25s, color .25s; }
  a { color: var(--ink); border-bottom: 1px solid var(--rule); padding-bottom: 1px; text-decoration: none; }
  a:hover { border-color: var(--ink); }
  code { font-family: var(--mono); font-size: .92em; }
  .muted { color: var(--ink-soft); }

  .wrap { max-width: 980px; margin: 0 auto; padding: 56px 40px 96px; }
  @media (max-width: 640px) { .wrap { padding: 32px 22px 64px; } }

  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 56px; font-size: 13px; }
  .brand { font-family: var(--display); font-size: 22px; }
  .brand a { border-bottom: 1px solid var(--rule); }
  .topbar nav { display: flex; gap: 18px; align-items: center; color: var(--ink-soft); }
  .theme-btn { background: transparent; border: 1px solid var(--rule); color: var(--ink-soft); font-size: 11px; padding: 6px 12px; border-radius: 999px; cursor: pointer; letter-spacing: .12em; text-transform: uppercase; font-family: var(--body); }
  .theme-btn:hover { color: var(--ink); border-color: var(--ink); }

  .kicker { text-transform: uppercase; letter-spacing: .18em; font-size: 11px; color: var(--ink-soft); font-family: var(--mono); margin: 0 0 14px; }
  h1.title { font-family: var(--display); font-weight: 400; font-size: clamp(40px, 6vw, 76px); line-height: 1.02; margin: 0 0 36px; letter-spacing: -.01em; }
  h1.title em { font-style: italic; color: var(--ink-soft); padding: 0 .12em; }

  /* — Hero crossover — */
  .crossover { display: grid; grid-template-columns: 1fr auto 1fr 1fr; gap: 18px; align-items: stretch; padding: 12px 0 56px; border-bottom: 1px solid var(--rule); }
  @media (max-width: 760px) { .crossover { grid-template-columns: 1fr; } .crossover .arrow { display: none; } }
  .source-card, .fused-card { padding: 22px 22px 18px; border-radius: 8px; background: var(--paper-2); box-shadow: inset 0 0 0 1px var(--rule); display: flex; flex-direction: column; gap: 14px; min-height: 220px; }
  .fused-card { background: var(--accent); color: ${/* readable on accent */''}; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); position: relative; overflow: hidden; }
  .source-card .lbl, .fused-card .lbl { font-family: var(--mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; opacity: .82; }
  .source-card .host, .fused-card .host { font-family: var(--display); font-size: 24px; line-height: 1.1; word-break: break-all; }
  .source-card .chips, .fused-card .chips { display: flex; gap: 4px; flex-wrap: wrap; }
  .chip { width: 18px; height: 18px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); flex: 0 0 auto; }
  .source-card .fam, .fused-card .fam { font-family: var(--mono); font-size: 11px; opacity: .82; }
  .arrow { font-family: var(--display); font-style: italic; font-size: clamp(22px, 3vw, 36px); color: var(--ink-soft); align-self: center; padding: 0 8px; }
  .fused-card .lbl, .fused-card .fam, .fused-card .chip { color: white; }
  .fused-card .host { color: white; }

  /* — Axis matrix — */
  section { padding: 56px 0; border-bottom: 1px solid var(--rule); }
  section:last-of-type { border-bottom: 0; }
  section > h2 { font-family: var(--display); font-weight: 400; font-size: clamp(28px, 3.5vw, 40px); line-height: 1.04; margin: 0 0 8px; letter-spacing: -.005em; }
  section > h2 + .lead { color: var(--ink-soft); margin: 0 0 28px; max-width: 60ch; }

  .matrix { width: 100%; border-collapse: collapse; font-size: 14px; }
  .matrix th, .matrix td { padding: 14px 12px; text-align: left; border-bottom: 1px solid var(--rule); vertical-align: middle; }
  .matrix th { font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-faint); border-bottom: 1px solid var(--ink); }
  .matrix .axis-name { font-family: var(--display); font-size: 18px; }
  .matrix .src { font-family: var(--mono); font-size: 11px; letter-spacing: .04em; color: var(--ink-soft); }
  .matrix .src.from-a { color: var(--ink); }
  .matrix .src.from-b { color: var(--ink); }
  .matrix .pill { display: inline-block; padding: 3px 8px; border-radius: 999px; font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; border: 1px solid var(--rule); background: var(--paper-2); }
  .matrix .pill.from-a { border-color: var(--ink-soft); }
  .matrix .pill.from-b { border-color: var(--accent); color: var(--ink); background: color-mix(in srgb, var(--accent) 14%, var(--paper-2)); }

  /* — Specimen of the fused design — */
  .specimen { padding: 32px; background: var(--paper-2); border-radius: 8px; box-shadow: inset 0 0 0 1px var(--rule); }
  .spec-quote { font-family: var(--display); font-weight: 400; font-size: clamp(28px, 4vw, 48px); line-height: 1.05; margin: 0 0 16px; }
  .spec-meta { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-soft); display: flex; gap: 24px; flex-wrap: wrap; }

  /* — Try the fused button — */
  .mock-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; padding: 18px 0; }
  .mock-card { padding: 24px; border-radius: 10px; background: var(--paper-2); box-shadow: inset 0 0 0 1px var(--rule); display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
  .mock-eyebrow { font-family: var(--mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); }
  .mock-title { font-family: var(--display); font-size: 24px; line-height: 1.1; margin: 0; }
  .mock-cta { font-family: var(--body); font-weight: 500; font-size: 14px; padding: 10px 18px; border-radius: 6px; background: var(--accent); color: white; border: 0; cursor: pointer; }

  /* — Footer — */
  footer { padding: 48px 0 0; font-size: 13px; color: var(--ink-soft); display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 16px; }
  footer .sig { font-family: var(--display); font-size: 22px; color: var(--ink); }
  footer .stamp { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; }

  @media print {
    body { background: white; color: black; }
    .topbar nav, .theme-btn { display: none; }
    section, .crossover { page-break-inside: avoid; border-color: #ddd; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <div class="brand"><a href="https://nexpage.app">nexpage</a></div>
      <nav>
        <span>Pair</span>
        <button class="theme-btn" id="themeBtn" type="button">Theme</button>
      </nav>
    </header>

    <p class="kicker">Design Pair · ${esc(date)}</p>
    <h1 class="title">${esc(hostA)} <em>×</em> ${esc(hostB)}</h1>

    <div class="crossover">
      <div class="source-card">
        <span class="lbl">A</span>
        <div class="host">${esc(hostA)}</div>
        <div class="chips">${paletteStrip(designA)}</div>
        <div class="fam">${esc(topFamily(designA))}</div>
      </div>
      <div class="arrow">×</div>
      <div class="source-card">
        <span class="lbl">B</span>
        <div class="host">${esc(hostB)}</div>
        <div class="chips">${paletteStrip(designB)}</div>
        <div class="fam">${esc(topFamily(designB))}</div>
      </div>
      <div class="fused-card">
        <span class="lbl">Fused</span>
        <div class="host">${esc(hostA)} × ${esc(hostB)}</div>
        <div class="chips">${paletteStrip(fused)}</div>
        <div class="fam">${esc(topFamily(fused))}</div>
      </div>
    </div>

    <section>
      <h2>Which axis came from where</h2>
      <p class="lead">Each row is one dimension of the design system. The pill shows whether the fused design inherited it from <strong>A</strong> (${esc(hostA)}) or <strong>B</strong> (${esc(hostB)}).</p>
      <table class="matrix">
        <thead>
          <tr>
            <th>Axis</th>
            <th>Source</th>
            <th>Inherited</th>
          </tr>
        </thead>
        <tbody>
          ${axisLabels.map(([key, label]) => {
            const src = axes[key] || 'a';
            const sourceHost = src === 'a' ? hostA : hostB;
            return `
              <tr>
                <td class="axis-name">${esc(label)}</td>
                <td class="src">${esc(sourceHost)}</td>
                <td><span class="pill from-${src}">From ${src.toUpperCase()}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </section>

    <section>
      <h2>The fused identity</h2>
      <p class="lead">Specimen of the merged design — palette + radii from one source, type + voice from the other.</p>
      <div class="specimen" style="font-family: ${esc(topFamily(fused))}, '${FONT_DISPLAY}', serif;">
        <p class="spec-quote">${esc(sampleHead)}</p>
        <div class="spec-meta">
          <span>Primary · <code>${esc(primaryHex(fused).toUpperCase())}</code></span>
          <span>Display · <code>${esc(topFamily(fused))}</code></span>
          <span>Tone · <code>${esc(fused.voice?.tone || 'neutral')}</code></span>
        </div>
      </div>

      <div class="mock-row">
        <div class="mock-card">
          <span class="mock-eyebrow">Primary action</span>
          <h4 class="mock-title">Built from the fused tokens</h4>
          <button type="button" class="mock-cta">Try this style</button>
        </div>
        <div class="mock-card">
          <span class="mock-eyebrow">Run again</span>
          <h4 class="mock-title">Different axes, different fusion</h4>
          <code>npx nexpage pair ${esc(hostA)} ${esc(hostB)} --type-from a</code>
        </div>
      </div>
    </section>

    <footer>
      <div>
        <div class="sig">nexpage</div>
        <div>Re-run: <code>npx nexpage pair ${esc(hostA)} ${esc(hostB)}</code></div>
      </div>
      <div class="stamp">${esc(date)} · v${esc(opts.version || '')}</div>
    </footer>
  </div>

  <script>
    (function () {
      var btn = document.getElementById('themeBtn');
      var saved = null;
      try { saved = localStorage.getItem('dl-theme'); } catch (e) {}
      if (saved) document.documentElement.setAttribute('data-theme', saved);
      btn && btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? '' : 'dark';
        if (cur) document.documentElement.setAttribute('data-theme', cur);
        else document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem('dl-theme', cur); } catch (e) {}
      });
    })();
  </script>
</body>
</html>`;
}

export function formatPairMarkdown(designA, designB, fused, summary) {
  const hostA = host(designA.meta?.url);
  const hostB = host(designB.meta?.url);
  const axes = summary?.axes || fused.fusedAxes || {};
  const lines = [
    `# ${hostA} × ${hostB}`,
    ``,
    `_Design pair fused by nexpage on ${new Date().toISOString().slice(0, 10)}._`,
    ``,
    `## Axes`,
    ``,
    `| Axis | Source |`,
    `|---|---|`,
    `| Colour | ${axes.colors === 'b' ? hostB : hostA} |`,
    `| Typography | ${axes.typography === 'a' ? hostA : hostB} |`,
    `| Spacing | ${axes.spacing === 'b' ? hostB : hostA} |`,
    `| Shape | ${axes.shape === 'b' ? hostB : hostA} |`,
    `| Motion | ${axes.motion === 'b' ? hostB : hostA} |`,
    `| Voice | ${axes.voice === 'a' ? hostA : hostB} |`,
    `| Components | ${axes.components === 'a' ? hostA : hostB} |`,
    ``,
    `## Fused identity`,
    ``,
    `- Primary: \`${primaryHex(fused)}\``,
    `- Display: ${topFamily(fused)}`,
    `- Tone: ${fused.voice?.tone || 'neutral'}`,
    ``,
    `---`,
    `_Re-run: \`npx nexpage pair ${hostA} ${hostB}\`_`,
  ];
  return lines.join('\n');
}
