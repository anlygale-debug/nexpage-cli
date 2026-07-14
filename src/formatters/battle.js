// nexpage battle — head-to-head graded comparison of two sites.
// Renders both audited designs against each other, dimension by dimension,
// and emits a single shareable HTML page with a verdict. Builds on the
// scoring already done in src/extractors/scoring.js — no new analysis here.

const FONT_DISPLAY = 'Instrument Serif';
const FONT_BODY = 'Inter';
const FONT_MONO = 'JetBrains Mono';

const DIMENSIONS = [
  ['colorDiscipline',       'Color'],
  ['typographyConsistency', 'Typography'],
  ['spacingSystem',         'Spacing'],
  ['shadowConsistency',     'Elevation'],
  ['radiusConsistency',     'Radii'],
  ['accessibility',         'A11y'],
  ['tokenization',          'Tokenization'],
  ['cssHealth',             'CSS Health'],
];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function host(url) {
  try { return new URL(url).hostname; } catch { return String(url); }
}

function gradeAccent(grade) {
  return ({ A: '#0a8a52', B: '#1f6feb', C: '#b08400', D: '#d2691e', F: '#c43d3d' })[grade] || '#1f1f1f';
}

function familyName(f) {
  if (!f) return '';
  if (typeof f === 'string') return f;
  return f.name || f.family || '';
}

export function compareScores(a, b) {
  // Build dimension-by-dimension comparison from two design.score objects.
  const rows = [];
  let aWins = 0, bWins = 0, ties = 0;
  for (const [key, label] of DIMENSIONS) {
    const va = a?.scores?.[key];
    const vb = b?.scores?.[key];
    if (va === undefined || vb === undefined) continue;
    const gap = Math.round(va - vb);
    let winner = 'tie';
    if (gap >= 3) { winner = 'a'; aWins++; }
    else if (gap <= -3) { winner = 'b'; bWins++; }
    else ties++;
    rows.push({ key, label, a: Math.round(va), b: Math.round(vb), gap, winner });
  }
  let verdict = 'tie';
  if (a?.overall - b?.overall >= 3) verdict = 'a';
  else if (b?.overall - a?.overall >= 3) verdict = 'b';
  return { rows, aWins, bWins, ties, verdict };
}

function paletteStrip(design) {
  const all = (design?.colors?.all || []).slice(0, 10);
  if (!all.length) return '';
  return all.map(c => `<span class="chip" style="--c:${esc(c.hex || c)}" title="${esc(c.hex || c)}"></span>`).join('');
}

export function formatBattle(designA, designB, opts = {}) {
  if (!designA?.score || !designB?.score) {
    throw new Error('battle: both designs must include a score (run extractDesignLanguage first)');
  }

  const a = {
    url: designA.meta?.url || '',
    host: host(designA.meta?.url),
    title: designA.meta?.title || '',
    score: designA.score,
    family: familyName((designA.typography?.families || [])[0]),
  };
  const b = {
    url: designB.meta?.url || '',
    host: host(designB.meta?.url),
    title: designB.meta?.title || '',
    score: designB.score,
    family: familyName((designB.typography?.families || [])[0]),
  };

  const cmp = compareScores(a.score, b.score);
  const aAccent = gradeAccent(a.score.grade);
  const bAccent = gradeAccent(b.score.grade);
  const verdictText =
    cmp.verdict === 'a' ? `${a.host} wins`
    : cmp.verdict === 'b' ? `${b.host} wins`
    : `Too close to call`;
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const ogTitle = `${a.host} vs ${b.host} · nexpage`;
  const ogDesc = `${verdictText}. ${a.score.overall} (${a.score.grade}) vs ${b.score.overall} (${b.score.grade}) across 8 design dimensions.`;

  const dimRows = cmp.rows.map(r => {
    const aPct = r.a;
    const bPct = r.b;
    const winnerClass = r.winner === 'a' ? 'win-a' : r.winner === 'b' ? 'win-b' : 'tie';
    return `
      <tr class="${winnerClass}">
        <td class="d-label">${esc(r.label)}</td>
        <td class="d-num d-num-a">${r.a}</td>
        <td class="d-bar">
          <div class="bar bar-a" style="width:${aPct}%; background:${aAccent}"></div>
          <div class="bar bar-b" style="width:${bPct}%; background:${bAccent}"></div>
        </td>
        <td class="d-num d-num-b">${r.b}</td>
        <td class="d-gap">${r.gap > 0 ? '+' : ''}${r.gap}</td>
      </tr>`;
  }).join('');

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
    --paper: #f7f5ef;
    --ink: #141414;
    --ink-soft: #555049;
    --rule: #e5e1d6;
    --a-accent: ${aAccent};
    --b-accent: ${bAccent};
    --display: '${FONT_DISPLAY}', 'Times New Roman', serif;
    --body: '${FONT_BODY}', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    --mono: '${FONT_MONO}', ui-monospace, 'SF Mono', monospace;
  }
  [data-theme="dark"] {
    --paper: #0e0d0b;
    --ink: #f0ece2;
    --ink-soft: #9b9589;
    --rule: #2a2823;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: var(--paper); color: var(--ink); font-family: var(--body); font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; transition: background .25s, color .25s; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 56px 40px 96px; }
  @media (max-width: 640px) { .wrap { padding: 32px 22px 64px; } }

  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 56px; font-size: 13px; }
  .brand { font-family: var(--display); font-size: 22px; }
  .brand a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--rule); padding-bottom: 1px; }
  .topbar nav { display: flex; gap: 18px; align-items: center; color: var(--ink-soft); }
  .theme-btn { background: transparent; border: 1px solid var(--rule); color: var(--ink-soft); font-size: 12px; padding: 6px 12px; border-radius: 999px; cursor: pointer; letter-spacing: .04em; text-transform: uppercase; font-family: var(--body); }
  .theme-btn:hover { color: var(--ink); border-color: var(--ink); }

  .kicker { text-transform: uppercase; letter-spacing: .18em; font-size: 11px; color: var(--ink-soft); margin-bottom: 14px; }
  h1.title { font-family: var(--display); font-weight: 400; font-size: clamp(40px, 6vw, 72px); line-height: 1.02; margin: 0 0 36px; letter-spacing: -.01em; }
  h1.title em { font-style: italic; color: var(--ink-soft); padding: 0 .12em; }

  /* — Versus hero — */
  .versus { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: center; padding: 8px 0 56px; border-bottom: 1px solid var(--rule); }
  .side { text-align: center; }
  .side .host-name { font-family: var(--display); font-size: clamp(24px, 3vw, 32px); margin: 0 0 6px; line-height: 1.1; }
  .side .host-name a { color: var(--ink); text-decoration: none; border-bottom: 2px solid currentColor; padding-bottom: 2px; }
  .side .grade { font-family: var(--display); font-size: clamp(120px, 18vw, 200px); line-height: .85; font-weight: 400; letter-spacing: -.04em; margin: 8px 0; }
  .side.a .grade { color: var(--a-accent); }
  .side.b .grade { color: var(--b-accent); }
  .side .score-num { font-family: var(--mono); font-size: 13px; color: var(--ink-soft); letter-spacing: .04em; }
  .versus .vs { font-family: var(--display); font-size: clamp(28px, 4vw, 44px); color: var(--ink-soft); font-style: italic; }
  @media (max-width: 640px) { .versus { grid-template-columns: 1fr; gap: 8px; } .versus .vs { padding: 8px 0; } }

  /* — Verdict — */
  .verdict { padding: 40px 0; border-bottom: 1px solid var(--rule); text-align: center; }
  .verdict .v-label { font-family: var(--mono); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 16px; }
  .verdict .v-text { font-family: var(--display); font-size: clamp(32px, 5vw, 56px); margin: 0; line-height: 1.05; letter-spacing: -.005em; }
  .verdict .v-text em { font-style: italic; color: var(--a-accent); }
  .verdict .v-text.b em { color: var(--b-accent); }
  .verdict .v-tally { display: flex; justify-content: center; gap: 28px; margin-top: 18px; font-family: var(--mono); font-size: 12px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: .08em; }
  .verdict .v-tally .a-wins { color: var(--a-accent); }
  .verdict .v-tally .b-wins { color: var(--b-accent); }

  /* — Dimension table — */
  section { padding: 56px 0; border-bottom: 1px solid var(--rule); }
  section:last-of-type { border-bottom: 0; }
  section > h2 { font-family: var(--display); font-weight: 400; font-size: 32px; margin: 0 0 8px; letter-spacing: -.005em; }
  section > h2 + .lead { color: var(--ink-soft); margin: 0 0 32px; max-width: 60ch; }

  table.dims { width: 100%; border-collapse: collapse; font-size: 14px; }
  table.dims tr { border-bottom: 1px solid var(--rule); }
  table.dims tr:last-child { border-bottom: 0; }
  table.dims td { padding: 18px 8px; vertical-align: middle; }
  table.dims .d-label { font-family: var(--display); font-size: 18px; width: 22%; }
  table.dims .d-num { font-family: var(--mono); font-size: 16px; width: 12%; text-align: center; color: var(--ink-soft); }
  table.dims .d-num-a { text-align: right; }
  table.dims .d-num-b { text-align: left; }
  table.dims .win-a .d-num-a { color: var(--a-accent); font-weight: 500; }
  table.dims .win-b .d-num-b { color: var(--b-accent); font-weight: 500; }
  table.dims .d-bar { padding: 18px 12px; }
  table.dims .bar { height: 6px; border-radius: 3px; transition: opacity .15s; }
  table.dims .bar-a { margin-bottom: 4px; }
  table.dims .d-gap { font-family: var(--mono); font-size: 12px; text-align: right; width: 8%; color: var(--ink-soft); letter-spacing: .04em; }
  table.dims .win-a .d-gap { color: var(--a-accent); }
  table.dims .win-b .d-gap { color: var(--b-accent); }

  /* — Palette strip — */
  .palettes { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 24px; }
  @media (max-width: 640px) { .palettes { grid-template-columns: 1fr; } }
  .pal h3 { font-family: var(--display); font-weight: 400; font-size: 18px; margin: 0 0 12px; color: var(--ink-soft); }
  .pal .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { width: 26px; height: 26px; border-radius: 4px; background: var(--c); box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }

  /* — Footer — */
  footer { padding: 48px 0 0; font-size: 13px; color: var(--ink-soft); display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 16px; }
  footer .sig { font-family: var(--display); font-size: 22px; color: var(--ink); }
  footer code { font-family: var(--mono); }
  footer .stamp { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }

  @media print {
    body { background: white; color: black; }
    .topbar nav, .theme-btn { display: none; }
    section, .versus, .verdict { page-break-inside: avoid; border-color: #ddd; }
    .side .grade { color: black; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <div class="brand"><a href="https://nexpage.dev">nexpage</a></div>
      <nav>
        <span>Battle Card</span>
        <button class="theme-btn" id="themeBtn" type="button">Theme</button>
      </nav>
    </header>

    <p class="kicker">Design Battle · ${esc(date)}</p>
    <h1 class="title">${esc(a.host)} <em>versus</em> ${esc(b.host)}</h1>

    <div class="versus">
      <div class="side a">
        <p class="host-name"><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.host)}</a></p>
        <div class="grade">${esc(a.score.grade)}</div>
        <p class="score-num">${a.score.overall} / 100</p>
      </div>
      <div class="vs">vs.</div>
      <div class="side b">
        <p class="host-name"><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.host)}</a></p>
        <div class="grade">${esc(b.score.grade)}</div>
        <p class="score-num">${b.score.overall} / 100</p>
      </div>
    </div>

    <div class="verdict">
      <p class="v-label">Verdict</p>
      <p class="v-text ${cmp.verdict === 'b' ? 'b' : ''}">${
        cmp.verdict === 'a' ? `<em>${esc(a.host)}</em> takes it.`
        : cmp.verdict === 'b' ? `<em>${esc(b.host)}</em> takes it.`
        : 'Too <em>close</em> to call.'
      }</p>
      <div class="v-tally">
        <span class="a-wins">${cmp.aWins} ${cmp.aWins === 1 ? 'win' : 'wins'} · ${esc(a.host)}</span>
        <span>${cmp.ties} ${cmp.ties === 1 ? 'tie' : 'ties'}</span>
        <span class="b-wins">${cmp.bWins} ${cmp.bWins === 1 ? 'win' : 'wins'} · ${esc(b.host)}</span>
      </div>
    </div>

    <section>
      <h2>Round by round.</h2>
      <p class="lead">Eight scored dimensions. Bigger bar wins. A gap under three points is called a tie.</p>
      <table class="dims">
        <tbody>${dimRows}</tbody>
      </table>
    </section>

    <section>
      <h2>The evidence.</h2>
      <p class="lead">Palettes pulled straight from each site's live styles.</p>
      <div class="palettes">
        <div class="pal">
          <h3>${esc(a.host)} · ${esc(a.family || '—')}</h3>
          <div class="chips">${paletteStrip(designA)}</div>
        </div>
        <div class="pal">
          <h3>${esc(b.host)} · ${esc(b.family || '—')}</h3>
          <div class="chips">${paletteStrip(designB)}</div>
        </div>
      </div>
    </section>

    <footer>
      <div>
        <div class="sig">nexpage</div>
        <div>Run your own: <code>npx nexpage battle ${esc(a.host)} ${esc(b.host)}</code></div>
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

export function formatBattleMarkdown(designA, designB) {
  if (!designA?.score || !designB?.score) throw new Error('battle: both designs need scores');
  const a = { host: host(designA.meta?.url), score: designA.score };
  const b = { host: host(designB.meta?.url), score: designB.score };
  const cmp = compareScores(a.score, b.score);
  const lines = [
    `# ${a.host} vs ${b.host}`,
    ``,
    `**Verdict:** ${cmp.verdict === 'a' ? `${a.host} wins` : cmp.verdict === 'b' ? `${b.host} wins` : 'Tie'} — ${cmp.aWins}–${cmp.bWins} (${cmp.ties} ties)`,
    ``,
    `| | ${a.host} | ${b.host} | Δ |`,
    `|---|---|---|---|`,
    `| **Overall** | ${a.score.overall} (${a.score.grade}) | ${b.score.overall} (${b.score.grade}) | ${a.score.overall - b.score.overall > 0 ? '+' : ''}${a.score.overall - b.score.overall} |`,
    ...cmp.rows.map(r => `| ${r.label} | ${r.a} | ${r.b} | ${r.gap > 0 ? '+' : ''}${r.gap} |`),
    ``,
    `_Audited by [nexpage](https://nexpage.dev) · \`npx nexpage battle ${a.host} ${b.host}\`_`,
  ];
  return lines.join('\n');
}
