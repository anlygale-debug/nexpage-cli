// nexpage theme-swap — editorial side-by-side preview HTML.
// Renders the original and recoloured palettes against each other so the
// user can see exactly what shifts when the brand primary changes.

const FONT_DISPLAY = 'Instrument Serif';
const FONT_BODY = 'Inter';
const FONT_MONO = 'JetBrains Mono';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function host(url) {
  try { return new URL(url).hostname; } catch { return String(url || ''); }
}

function topPalette(design, n = 12) {
  const all = (design?.colors?.all || []).slice(0, n);
  return all.map(c => esc(c?.hex || c)).filter(Boolean);
}

export function formatThemeSwap(originalDesign, recoloredDesign, opts = {}) {
  if (!originalDesign || !recoloredDesign) throw new Error('formatThemeSwap: both designs required');

  const url = originalDesign.meta?.url || '';
  const hostName = host(url);
  const swap = recoloredDesign.meta?.themeSwap || {};
  const fromHex = swap.from || '#000000';
  const toHex = swap.to || '#000000';
  const hueShift = swap.hueShift ?? 0;
  const changed = swap.changedColors ?? 0;
  const date = new Date(originalDesign.meta?.timestamp || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const beforeColors = topPalette(originalDesign, 14);
  const afterColors = topPalette(recoloredDesign, 14);
  const ogTitle = `${hostName} · theme-swap · ${fromHex} → ${toHex}`;
  const ogDesc = `Recoloured ${hostName} around ${toHex}. Hue shift ${hueShift.toFixed?.(1) ?? hueShift}°. ${changed} colours changed.`;

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
    --from: ${esc(fromHex)};
    --to: ${esc(toHex)};
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

  /* — Hero swatches — */
  .hero-swap { display: grid; grid-template-columns: 1fr auto 1fr; gap: 28px; align-items: center; padding: 8px 0 56px; border-bottom: 1px solid var(--rule); }
  .swatch-card { text-align: center; }
  .swatch-block { width: 100%; height: clamp(180px, 22vw, 240px); border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); margin-bottom: 14px; }
  .swatch-block.from { background: var(--from); }
  .swatch-block.to { background: var(--to); }
  .swatch-card code { font-family: var(--mono); font-size: 14px; letter-spacing: .04em; }
  .swatch-card .lbl { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-soft); display: block; margin-top: 6px; }
  .arrow { font-family: var(--display); font-size: clamp(36px, 5vw, 56px); color: var(--ink-soft); font-style: italic; }
  @media (max-width: 640px) { .hero-swap { grid-template-columns: 1fr; gap: 12px; } .arrow { padding: 8px 0; } }

  /* — Stats strip — */
  .stats { display: flex; gap: 28px; flex-wrap: wrap; padding: 32px 0 0; font-family: var(--mono); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-soft); }
  .stats span strong { color: var(--ink); margin-right: 6px; }

  section { padding: 56px 0; border-bottom: 1px solid var(--rule); }
  section:last-of-type { border-bottom: 0; }
  section > h2 { font-family: var(--display); font-weight: 400; font-size: 32px; margin: 0 0 8px; letter-spacing: -.005em; }
  section > h2 + .lead { color: var(--ink-soft); margin: 0 0 32px; max-width: 60ch; }

  .palettes { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  @media (max-width: 640px) { .palettes { grid-template-columns: 1fr; } }
  .pal h3 { font-family: var(--display); font-weight: 400; font-size: 22px; margin: 0 0 6px; }
  .pal .pal-sub { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-soft); margin-bottom: 16px; }
  .chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; list-style: none; padding: 0; margin: 0; }
  .chip { display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; background: rgba(0,0,0,.02); border: 1px solid var(--rule); border-radius: 6px; }
  [data-theme="dark"] .chip { background: rgba(255,255,255,.03); }
  .chip .swatch { width: 22px; height: 22px; border-radius: 4px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); flex: 0 0 auto; }
  .chip code { font-family: var(--mono); font-size: 11px; color: var(--ink-soft); }

  /* — Mockup row — */
  .mock { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 640px) { .mock { grid-template-columns: 1fr; } }
  .mock-card { padding: 28px; border-radius: 10px; border: 1px solid var(--rule); background: var(--paper); }
  .mock-card .mock-eyebrow { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-soft); margin-bottom: 14px; }
  .mock-card h4 { font-family: var(--display); font-weight: 400; font-size: 24px; margin: 0 0 8px; }
  .mock-card p { color: var(--ink-soft); margin: 0 0 18px; font-size: 14px; }
  .mock-cta { display: inline-block; padding: 10px 18px; border-radius: 6px; color: white; font-weight: 500; font-size: 13px; text-decoration: none; }
  .mock-cta.from { background: var(--from); }
  .mock-cta.to { background: var(--to); }
  .mock-card .ring { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-family: var(--mono); margin-bottom: 14px; border: 1px solid currentColor; }
  .mock-card.from .ring { color: var(--from); }
  .mock-card.to .ring { color: var(--to); }

  footer { padding: 48px 0 0; font-size: 13px; color: var(--ink-soft); display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 16px; }
  footer .sig { font-family: var(--display); font-size: 22px; color: var(--ink); }
  footer code { font-family: var(--mono); }
  footer .stamp { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }

  @media print {
    body { background: white; color: black; }
    .topbar nav, .theme-btn { display: none; }
    section, .hero-swap { page-break-inside: avoid; border-color: #ddd; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="topbar">
      <div class="brand"><a href="https://nexpage.app">nexpage</a></div>
      <nav>
        <span>Theme Swap</span>
        <button class="theme-btn" id="themeBtn" type="button">Theme</button>
      </nav>
    </header>

    <p class="kicker">Theme Swap · ${esc(date)}</p>
    <h1 class="title">${esc(hostName)} <em>recoloured</em>.</h1>

    <div class="hero-swap">
      <div class="swatch-card">
        <div class="swatch-block from"></div>
        <code>${esc(fromHex)}</code>
        <span class="lbl">Source primary</span>
      </div>
      <div class="arrow">→</div>
      <div class="swatch-card">
        <div class="swatch-block to"></div>
        <code>${esc(toHex)}</code>
        <span class="lbl">New primary</span>
      </div>
    </div>

    <div class="stats">
      <span><strong>${(typeof hueShift === 'number' ? hueShift.toFixed(1) : hueShift)}°</strong>hue shift</span>
      <span><strong>${changed}</strong>colours changed</span>
      <span><strong>${(originalDesign.colors?.neutrals || []).length}</strong>neutrals preserved</span>
      <span><strong>${(originalDesign.typography?.scale || []).length}</strong>type sizes unchanged</span>
    </div>

    <section>
      <h2>The palette, side by side.</h2>
      <p class="lead">Brand inks rotate; neutrals (greys, surfaces, body text) stay put. Spacing, type, motion, and component anatomy are untouched.</p>
      <div class="palettes">
        <div class="pal">
          <h3>Original</h3>
          <p class="pal-sub">${esc(hostName)} as extracted</p>
          <ul class="chips">
            ${beforeColors.map(c => `<li class="chip"><span class="swatch" style="background:${c}"></span><code>${c}</code></li>`).join('')}
          </ul>
        </div>
        <div class="pal">
          <h3>Recoloured</h3>
          <p class="pal-sub">around ${esc(toHex)}</p>
          <ul class="chips">
            ${afterColors.map(c => `<li class="chip"><span class="swatch" style="background:${c}"></span><code>${c}</code></li>`).join('')}
          </ul>
        </div>
      </div>
    </section>

    <section>
      <h2>What it feels like.</h2>
      <p class="lead">Same component shape, same typography, same spacing — just a different brand voice.</p>
      <div class="mock">
        <div class="mock-card from">
          <div class="mock-eyebrow">Original</div>
          <span class="ring">Brand</span>
          <h4>Build something they remember.</h4>
          <p>The original tokens, untouched. This is what the site ships today.</p>
          <a href="#" class="mock-cta from">Get started</a>
        </div>
        <div class="mock-card to">
          <div class="mock-eyebrow">Recoloured</div>
          <span class="ring">Brand</span>
          <h4>Build something they remember.</h4>
          <p>Same shape, swapped primary. Drop these tokens into your project.</p>
          <a href="#" class="mock-cta to">Get started</a>
        </div>
      </div>
    </section>

    <footer>
      <div>
        <div class="sig">nexpage</div>
        <div>Run your own: <code>npx nexpage theme-swap ${esc(hostName)} --primary ${esc(toHex)}</code></div>
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

export function formatThemeSwapMarkdown(originalDesign, recoloredDesign) {
  const url = originalDesign?.meta?.url || '';
  const hostName = host(url);
  const swap = recoloredDesign?.meta?.themeSwap || {};
  const fromHex = swap.from || '—';
  const toHex = swap.to || '—';
  const hueShift = swap.hueShift ?? 0;
  const lines = [
    `# Theme swap — ${hostName}`,
    ``,
    `**${fromHex} → ${toHex}** · hue shift ${hueShift}° · ${swap.changedColors ?? 0} colours changed`,
    ``,
    `## Palette diff`,
    ``,
    `| Original | Recoloured |`,
    `|---|---|`,
    ...originalDesign.colors?.all?.slice(0, 14).map((c, i) => {
      const before = c?.hex || '';
      const after = recoloredDesign.colors?.all?.[i]?.hex || '';
      return `| \`${before}\` | \`${after}\` |`;
    }) || [],
    ``,
    `_Run again: \`npx nexpage theme-swap ${hostName} --primary ${toHex}\`_`,
  ];
  return lines.join('\n');
}
