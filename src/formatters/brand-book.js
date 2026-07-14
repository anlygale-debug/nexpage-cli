// nexpage brand-book — full editorial brand-guidelines document.
//
// A single self-contained HTML book that documents an extracted design
// system the way a hand-off doc would: cover, table of contents, 13
// chapters. The layout is editorial (Stripe Press / Pentagram-leaning),
// not data-dump — each chapter shows the actual values, not just lists.
//
// Two design rules:
//   1. The brand's primary colour leads the cover. It's the first thing
//      anyone sees, full bleed. Everything else dials down from there.
//   2. Real text from the site whenever possible. The voice extractor
//      surfaces real headings — use them. No filler aphorisms.

const FONT_DISPLAY = 'Instrument Serif';
const FONT_BODY = 'Inter';
const FONT_MONO = 'JetBrains Mono';

// ── Helpers ────────────────────────────────────────────────────

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

// Coerce *anything* into a list of strings. The component-anatomy
// extractor returns slots/props as objects, arrays, or strings.
function asList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter(x => x != null);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  if (typeof v === 'object') return Object.keys(v);
  return [String(v)];
}

function hexToRgb(hex) {
  if (!hex) return null;
  const s = String(hex).trim().replace(/^#/, '');
  const full = s.length === 3 ? s.split('').map(c => c + c).join('') : s.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }) {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
      case gN: h = (bN - rN) / d + 2; break;
      case bN: h = (rN - gN) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function relLum({ r, g, b }) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function bestTextOn(rgb) {
  return relLum(rgb) > 0.5 ? '#0a0a0a' : '#ffffff';
}

function pickAccent(design) {
  // The cover band uses the brand's actual primary if we can detect one
  // — that's the whole point. Fall back through secondary, accent, the
  // most-used coloured token, then ink.
  const candidates = [
    design.colors?.primary?.hex,
    design.colors?.secondary?.hex,
    design.colors?.accent?.hex,
    ...(design.colors?.all || []).map(c => c?.hex).filter(Boolean),
  ];
  for (const hex of candidates) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    // Skip near-greys.
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    if (max - min > 24) return hex;
  }
  return '#141414';
}

// Pull two real lines from the site for the type specimen. Falls back
// to a neutral pangram only when the voice extractor came back empty.
function specimenLines(design) {
  const headings = (design.voice?.sampleHeadings || []).filter(h => typeof h === 'string' && h.trim().length > 4 && h.length < 120);
  if (headings.length >= 2) return [headings[0], headings[1]];
  if (headings.length === 1) return [headings[0], 'Quick brown fox jumps over the lazy dog.'];
  return ['Quick brown fox jumps over the lazy dog.', 'AaBbCc 0123456789 ?!&'];
}

// ── Section builders ──────────────────────────────────────────

function buildCover(design, accent) {
  const meta = design.meta || {};
  const hostName = host(meta.url);
  const date = new Date(meta.timestamp || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const grade = design.score?.grade || '—';
  const overall = design.score?.overall ?? '—';
  const intent = design.pageIntent?.type || 'site';
  const fg = bestTextOn(hexToRgb(accent) || { r: 0, g: 0, b: 0 });
  return `
    <section class="cover" id="cover" aria-labelledby="cover-title">
      <div class="cover-band" style="background:${esc(accent)};color:${fg}">
        <span class="cover-band-label">Brand guidelines</span>
        <span class="cover-band-hex"><code>${esc(accent)}</code></span>
      </div>
      <div class="cover-body">
        <p class="kicker">${esc(date)}</p>
        <h1 id="cover-title" class="cover-title">${esc(hostName)}</h1>
        <p class="cover-sub">A reading of the visual language at <a href="${esc(meta.url || '')}" target="_blank" rel="noopener">${esc(meta.url || hostName)}</a>. Every token, every rule, every component — captured from the live site.</p>
        <dl class="cover-meta">
          <div><dt>Page intent</dt><dd>${esc(intent)}</dd></div>
          <div><dt>System grade</dt><dd>${esc(grade)} <span class="muted">${esc(String(overall))}/100</span></dd></div>
          <div><dt>Tokens</dt><dd>${(design.colors?.all || []).length} colours · ${(design.typography?.scale || []).length} sizes</dd></div>
          <div><dt>Generated</dt><dd>nexpage</dd></div>
        </dl>
      </div>
    </section>`;
}

function buildToc() {
  const items = [
    ['about',         '01', 'About'],
    ['logo',          '02', 'Logo'],
    ['color',         '03', 'Colour'],
    ['type',          '04', 'Typography'],
    ['spacing',       '05', 'Spacing'],
    ['shape',         '06', 'Shape'],
    ['iconography',   '07', 'Iconography'],
    ['motion',        '08', 'Motion'],
    ['components',    '09', 'Components'],
    ['voice',         '10', 'Voice'],
    ['accessibility', '11', 'Accessibility'],
    ['tokens',        '12', 'Tokens'],
    ['usage',         '13', 'Usage'],
  ];
  return `
    <nav class="toc" aria-label="Table of contents">
      <h2 class="toc-title">Contents</h2>
      <ol>
        ${items.map(([id, n, label]) => `<li><a href="#${id}"><span class="toc-num">${n}</span><span class="toc-label">${label}</span></a></li>`).join('')}
      </ol>
    </nav>`;
}

function chapterHeader(num, title) {
  return `
    <header class="chapter-header">
      <span class="sec-num">Chapter ${num}</span>
      <h2>${esc(title)}</h2>
    </header>`;
}

function buildAbout(design) {
  const intent = design.pageIntent || {};
  const material = design.materialLanguage || {};
  const imagery = design.imageryStyle || {};
  const lib = design.componentLibrary || {};
  const stack = design.stack || {};
  const voice = design.voice || {};
  return `
    <section id="about">
      ${chapterHeader('01', 'About')}
      <dl class="meta-grid">
        <div><dt>Page intent</dt><dd>${esc(intent.type || 'unknown')}${typeof intent.confidence === 'number' ? ` <span class="muted">${(intent.confidence * 100).toFixed(0)}% confidence</span>` : ''}</dd></div>
        <div><dt>Material language</dt><dd>${esc(material.label || 'unknown')}</dd></div>
        <div><dt>Imagery style</dt><dd>${esc(imagery.label || 'unknown')}</dd></div>
        <div><dt>Component library</dt><dd>${esc(lib.library || 'unknown')}</dd></div>
        <div><dt>Stack</dt><dd>${esc(stack.framework || 'unknown')}${stack.css?.tailwind ? ' · Tailwind' : ''}</dd></div>
        <div><dt>Voice tone</dt><dd>${esc(voice.tone || 'neutral')}</dd></div>
      </dl>
    </section>`;
}

function buildLogo(design) {
  const logo = design.logo || {};
  const hasSvg = typeof logo.svg === 'string' && logo.svg.includes('<svg');
  const hostName = host(design.meta?.url) || 'logo';
  return `
    <section id="logo">
      ${chapterHeader('02', 'Logo')}
      <div class="logo-card">
        <div class="logo-canvas" aria-label="Extracted logo on canvas">
          ${hasSvg ? logo.svg : `<span class="logo-placeholder">${esc(hostName)}</span>`}
        </div>
        <dl class="meta-grid logo-meta">
          <div><dt>Source</dt><dd>${esc(logo.source || 'inferred')}</dd></div>
          <div><dt>Dimensions</dt><dd>${logo.width ? `${logo.width} × ${logo.height} px` : '—'}</dd></div>
          <div><dt>Aspect</dt><dd>${logo.aspect ? logo.aspect.toFixed(2) : '—'}</dd></div>
          <div><dt>Format</dt><dd>${esc(logo.format || (hasSvg ? 'svg' : 'unknown'))}</dd></div>
        </dl>
      </div>
    </section>`;
}

function bigSwatch(name, c, role) {
  if (!c?.hex) return '';
  const rgb = hexToRgb(c.hex);
  if (!rgb) return '';
  const fg = bestTextOn(rgb);
  const hsl = rgbToHsl(rgb);
  return `
    <article class="brand-color brand-color-${role}">
      <div class="big-swatch" style="background:${esc(c.hex)};color:${fg}">
        <span class="big-swatch-name">${esc(name)}</span>
        <span class="big-swatch-hex">${esc(c.hex.toUpperCase())}</span>
      </div>
      <dl class="color-meta">
        <div><dt>RGB</dt><dd><code>${rgb.r}, ${rgb.g}, ${rgb.b}</code></dd></div>
        <div><dt>HSL</dt><dd><code>${hsl.h}°, ${hsl.s}%, ${hsl.l}%</code></dd></div>
      </dl>
    </article>`;
}

function buildColor(design) {
  const colors = design.colors || {};
  const primary = colors.primary;
  const secondary = colors.secondary;
  const accent = colors.accent;
  const neutrals = colors.neutrals || [];
  const all = colors.all || [];
  const a11y = design.accessibility || {};
  const summary = [
    primary?.hex && '1 primary',
    secondary?.hex && '1 secondary',
    accent?.hex && '1 accent',
    `${neutrals.length} neutrals`,
    `${all.length} total`,
  ].filter(Boolean).join(' · ');

  return `
    <section id="color">
      ${chapterHeader('03', 'Colour')}
      <p class="summary">${esc(summary)}</p>

      ${primary?.hex ? `<div class="brand-grid brand-grid-primary">${bigSwatch('Primary', primary, 'primary')}</div>` : ''}

      ${(secondary?.hex || accent?.hex) ? `
        <div class="brand-grid brand-grid-pair">
          ${secondary?.hex ? bigSwatch('Secondary', secondary, 'secondary') : ''}
          ${accent?.hex ? bigSwatch('Accent', accent, 'accent') : ''}
        </div>
      ` : ''}

      ${neutrals.length ? `
        <h3 class="sub">Neutrals</h3>
        <div class="neutral-strip">
          ${neutrals.slice(0, 12).map(c => {
            const rgb = hexToRgb(c.hex);
            if (!rgb) return '';
            const fg = bestTextOn(rgb);
            return `<div class="neutral-cell" style="background:${esc(c.hex)};color:${fg}"><code>${esc(c.hex.toUpperCase())}</code></div>`;
          }).join('')}
        </div>
      ` : ''}

      <h3 class="sub">Full palette</h3>
      <div class="palette-grid">
        ${all.slice(0, 28).map(c => {
          const rgb = hexToRgb(c.hex);
          if (!rgb) return '';
          const fg = bestTextOn(rgb);
          return `<div class="mini-swatch" style="background:${esc(c.hex)};color:${fg}"><code>${esc(c.hex.toUpperCase())}</code></div>`;
        }).join('')}
      </div>

      ${a11y.score != null ? `
        <p class="callout"><strong>WCAG ${a11y.score}%</strong> · ${a11y.passCount || 0} passing pairs · ${a11y.failCount || 0} failing. Full breakdown in §11.</p>
      ` : ''}
    </section>`;
}

function buildType(design) {
  const t = design.typography || {};
  const families = (t.families || []).map(familyName).filter(Boolean);
  const scaleRaw = (t.scale || []);
  const sizes = scaleRaw.map(s => typeof s === 'number' ? s : (s?.size ?? 0)).filter(n => n > 0).sort((a, b) => b - a);
  const weights = (t.weights || []).map(w => typeof w === 'object' ? (w.weight || w.value) : w).filter(Boolean);
  const head = families[0];
  const body = families[1] || head;
  const lines = specimenLines(design);
  const headStack = head ? `${esc(head)}, '${FONT_DISPLAY}', serif` : `'${FONT_DISPLAY}', serif`;
  return `
    <section id="type">
      ${chapterHeader('04', 'Typography')}
      <p class="summary">${families.length || 0} families · ${sizes.length} sizes · ${weights.length} weights</p>

      <dl class="meta-grid">
        <div><dt>Display</dt><dd>${esc(head || '—')}</dd></div>
        <div><dt>Body</dt><dd>${esc(body || '—')}</dd></div>
        <div><dt>Weights</dt><dd>${weights.join(', ') || '—'}</dd></div>
      </dl>

      <h3 class="sub">Specimen</h3>
      <div class="specimen" style="font-family: ${headStack};">
        <div class="spec-line spec-display" style="font-size: ${Math.min(sizes[0] || 64, 80)}px">${esc(lines[0])}</div>
        <div class="spec-line spec-body" style="font-size: 24px">${esc(lines[1])}</div>
      </div>

      <h3 class="sub">Scale</h3>
      <table class="scale-table">
        <thead><tr><th class="t-step">Step</th><th class="t-size">Size</th><th class="t-sample">Sample</th></tr></thead>
        <tbody>
          ${sizes.slice(0, 10).map((s, i) => `
            <tr>
              <td class="t-step"><code>t${String(i).padStart(2, '0')}</code></td>
              <td class="t-size"><code>${s}px</code></td>
              <td class="t-sample" style="font-size:${Math.min(s, 56)}px; font-family: ${headStack}; line-height: 1;">${esc(lines[0].slice(0, 28))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>`;
}

function buildSpacing(design) {
  const sp = design.spacing || {};
  const raw = (sp.scale || []).map(v => typeof v === 'number' ? v : (v?.value ?? v?.size ?? 0)).filter(n => n > 0);
  const scale = raw.slice().sort((a, b) => a - b).slice(0, 10);
  const base = sp.base || (scale[0] || 4);
  return `
    <section id="spacing">
      ${chapterHeader('05', 'Spacing')}
      <p class="summary">Base ${base}px · ${(sp.scale || []).length} steps captured</p>

      <h3 class="sub">Rhythm</h3>
      <div class="space-rhythm">
        ${scale.map(v => `
          <div class="space-step">
            <div class="space-block" style="width:${Math.min(v * 1.6, 320)}px"></div>
            <code>${v}px</code>
          </div>
        `).join('')}
      </div>
    </section>`;
}

function buildShape(design) {
  const radii = (design.borders?.radii || [])
    .map(r => typeof r === 'object' ? r.value : r)
    .filter(n => typeof n === 'number')
    .sort((a, b) => a - b);
  const shadowsRaw = (design.shadows?.values || []).slice(0, 6);
  const shadowLabels = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  return `
    <section id="shape">
      ${chapterHeader('06', 'Shape')}
      <p class="summary">${radii.length} radii · ${shadowsRaw.length} elevation tiers</p>

      <h3 class="sub">Border radii</h3>
      <div class="radii-row">
        ${radii.slice(0, 6).map(v => `
          <div class="radius-card">
            <div class="radius-block" style="border-radius:${v}px"></div>
            <code>${v}px</code>
          </div>
        `).join('')}
      </div>

      ${shadowsRaw.length ? `
        <h3 class="sub">Elevation</h3>
        <div class="shadows-row">
          ${shadowsRaw.map((s, i) => {
            const raw = typeof s === 'string' ? s : (s?.raw || '');
            const label = shadowLabels[i] || `e${i}`;
            return `
              <div class="shadow-card">
                <div class="shadow-block" style="box-shadow:${esc(raw)}"></div>
                <code>${esc(label)}</code>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </section>`;
}

function buildIconography(design) {
  const sys = design.iconSystem || {};
  const icons = (sys.icons || design.icons?.icons || []).slice(0, 24);
  return `
    <section id="iconography">
      ${chapterHeader('07', 'Iconography')}
      <p class="summary">${esc(sys.library || 'unknown library')} · ${icons.length} captured</p>

      <dl class="meta-grid">
        <div><dt>Library</dt><dd>${esc(sys.library || 'unknown')}</dd></div>
        <div><dt>Confidence</dt><dd>${sys.confidence != null ? Math.round(sys.confidence * 100) + '%' : '—'}</dd></div>
        <div><dt>Stroke style</dt><dd>${esc((sys.signals && sys.signals[0]) || '—')}</dd></div>
      </dl>

      ${icons.length ? `
        <div class="icon-grid">
          ${icons.map(i => `<div class="icon-cell">${i.svg ? i.svg : `<code>${esc(i.name || 'icon')}</code>`}</div>`).join('')}
        </div>
      ` : '<p class="muted">No icons captured.</p>'}
    </section>`;
}

function buildMotion(design, accent) {
  const m = design.motion || {};
  const durations = (m.durations || []).slice(0, 6);
  const easings = (m.easings || []).slice(0, 4);
  return `
    <section id="motion">
      ${chapterHeader('08', 'Motion')}
      <p class="summary">Feel: ${esc(m.feel || 'unknown')} · ${(m.durations || []).length} durations · ${(m.easings || []).length} easings</p>

      ${durations.length ? `
        <h3 class="sub">Duration scale</h3>
        <div class="motion-tempo">
          ${durations.map(d => {
            const ms = d.ms || (typeof d === 'number' ? d : 0);
            const label = d.label ? esc(d.label) : '';
            return `
              <div class="tempo-item">
                <div class="tempo-bar" style="--dur:${ms}ms; background:${esc(accent)}"></div>
                <code>${ms}ms${label ? ' · ' + label : ''}</code>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      ${easings.length ? `
        <h3 class="sub">Easings</h3>
        <ul class="easings">
          ${easings.map(e => `<li><code>${esc(typeof e === 'string' ? e : (e.value || e.label || e.family || ''))}</code></li>`).join('')}
        </ul>
      ` : ''}
    </section>`;
}

function buildComponents(design, accent) {
  const lib = design.componentLibrary || {};
  const anatomy = design.componentAnatomy || [];
  const components = anatomy.slice(0, 6);
  const radii = (design.borders?.radii || [])
    .map(r => typeof r === 'object' ? r.value : r)
    .filter(n => typeof n === 'number')
    .sort((a, b) => a - b);
  const radius = radii[1] || radii[0] || 6;
  const accentRgb = hexToRgb(accent) || { r: 20, g: 20, b: 20 };
  const accentFg = bestTextOn(accentRgb);
  const neutral = (design.colors?.neutrals || [])[0]?.hex || '#1a1a1a';
  const surface = (design.colors?.backgrounds || [])[1] || '#f7f5ef';
  const text = (design.colors?.text || [])[0] || '#0a0a0a';
  return `
    <section id="components">
      ${chapterHeader('09', 'Components')}
      <p class="summary">${esc(lib.library || 'unknown library')} · ${components.length} component patterns captured</p>

      <h3 class="sub">Mocks</h3>
      <div class="mock-grid">
        <div class="mock-button">
          <button type="button" class="m-btn m-btn-primary" style="background:${esc(accent)};color:${accentFg};border-radius:${radius}px">Primary action</button>
          <button type="button" class="m-btn m-btn-secondary" style="border-radius:${radius}px;border-color:${esc(accent)};color:${esc(accent)}">Secondary</button>
        </div>
        <div class="mock-card" style="background:${esc(surface)};color:${esc(text)};border-radius:${radius * 1.5}px">
          <span class="m-card-eyebrow">Card</span>
          <h4 class="m-card-title">Built from these tokens</h4>
          <p class="m-card-body">Radius, primary, surface, text — all sampled from the live site.</p>
          <a class="m-card-link" href="#" style="color:${esc(accent)}">Read more →</a>
        </div>
      </div>

      ${components.length ? `
        <h3 class="sub">Detected patterns</h3>
        <div class="component-list">
          ${components.map(c => `
            <article class="component-card">
              <h4>${esc(c.kind || c.name || 'component')}</h4>
              <dl class="meta-grid">
                <div><dt>Slots</dt><dd>${asList(c.slots).map(esc).join(', ') || '—'}</dd></div>
                <div><dt>Variants</dt><dd>${asList(c.props && c.props.variant).map(esc).join(', ') || '—'}</dd></div>
                <div><dt>Sizes</dt><dd>${asList(c.props && c.props.size).map(esc).join(', ') || '—'}</dd></div>
              </dl>
            </article>
          `).join('')}
        </div>
      ` : ''}
    </section>`;
}

function buildVoice(design) {
  const v = design.voice || {};
  const headings = (v.sampleHeadings || []).slice(0, 4);
  const verbs = (v.ctaVerbs || []).slice(0, 8);
  return `
    <section id="voice">
      ${chapterHeader('10', 'Voice')}
      <p class="summary">${esc(v.tone || 'neutral')} · ${esc(v.pronounPosture || '—')} · ${esc(v.headingCase || '—')}</p>

      ${headings.length ? `
        <h3 class="sub">Headlines from the site</h3>
        <ul class="quotes">
          ${headings.map(h => `<li>${esc(h)}</li>`).join('')}
        </ul>
      ` : ''}

      ${verbs.length ? `
        <h3 class="sub">CTA verbs</h3>
        <ul class="cta-verbs">
          ${verbs.map(v2 => {
            const word = typeof v2 === 'string' ? v2 : (v2.verb || '');
            const count = typeof v2 === 'object' ? v2.count : null;
            return `<li><code>${esc(word)}</code>${count ? `<span class="muted">×${count}</span>` : ''}</li>`;
          }).join('')}
        </ul>
      ` : ''}
    </section>`;
}

function buildAccessibility(design) {
  const a = design.accessibility || {};
  const failing = (a.failingPairs || []).slice(0, 5);
  const remediation = (a.remediation || []).slice(0, 5);
  const score = a.score != null ? a.score : null;
  return `
    <section id="accessibility">
      ${chapterHeader('11', 'Accessibility')}

      <div class="a11y-score">
        <span class="a11y-num">${score != null ? score : '—'}<span class="a11y-suffix">${score != null ? '%' : ''}</span></span>
        <span class="a11y-label">WCAG 2.1 contrast<br>${a.passCount ?? '—'} passing · ${a.failCount ?? '—'} failing</span>
      </div>

      ${failing.length ? `
        <h3 class="sub">Failing pairs</h3>
        <div class="a11y-pairs">
          ${failing.map(p => {
            const fg = p.fg || p.foreground;
            const bg = p.bg || p.background;
            const ratio = (p.ratio || 0).toFixed(2);
            const rule = p.rule || 'AA';
            return `
              <div class="a11y-pair">
                <div class="a11y-stack" style="background:${esc(bg)};color:${esc(fg)}">
                  <span class="a11y-Aa">Aa</span>
                  <span class="a11y-ratio">${ratio}:1</span>
                </div>
                <dl>
                  <div><dt>Foreground</dt><dd><code>${esc(fg)}</code></dd></div>
                  <div><dt>Background</dt><dd><code>${esc(bg)}</code></dd></div>
                  <div><dt>Rule</dt><dd>${esc(rule)}</dd></div>
                </dl>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<p class="muted">No failing contrast pairs detected.</p>'}

      ${remediation.length ? `
        <h3 class="sub">Suggested replacements</h3>
        <ul class="remediation">
          ${remediation.map(r => `<li><code>${esc(r.from || r.fg)}</code> → <code>${esc(r.to || r.suggested)}</code> ${r.ratio ? `<span class="muted">(${r.ratio.toFixed(2)}:1)</span>` : ''}</li>`).join('')}
        </ul>
      ` : ''}
    </section>`;
}

function buildTokens(design) {
  const primary = design.colors?.primary?.hex || '#0066cc';
  const fontHead = familyName((design.typography?.families || [])[0]) || 'Inter';
  const space = design.spacing?.base || 4;
  const radii = (design.borders?.radii || [])
    .map(r => typeof r === 'object' ? r.value : r)
    .filter(n => typeof n === 'number')
    .sort((a, b) => a - b);
  const radiusMd = radii[1] || radii[0] || 8;
  const hostName = host(design.meta?.url) || '<url>';
  const cssVars = `:root {
  --color-primary: ${primary};
  --font-display: "${fontHead}";
  --space-base: ${space}px;
  --radius-md: ${radiusMd}px;
}`;
  const tailwind = `// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: { brand: '${primary}' },
      fontFamily: { display: ['${fontHead}', 'serif'] },
      spacing: { base: '${space}px' },
      borderRadius: { md: '${radiusMd}px' },
    },
  },
};`;
  return `
    <section id="tokens">
      ${chapterHeader('12', 'Tokens')}
      <p class="summary">Drop-in code for the most common stacks. All values from the live extraction.</p>

      <div class="codeblock-wrap">
        <div class="codeblock-head"><span>CSS variables</span><span class="muted">variables.css</span></div>
        <pre class="codeblock"><code>${esc(cssVars)}</code></pre>
      </div>

      <div class="codeblock-wrap">
        <div class="codeblock-head"><span>Tailwind config</span><span class="muted">tailwind.config.js</span></div>
        <pre class="codeblock"><code>${esc(tailwind)}</code></pre>
      </div>

      <p class="muted">Run <code>npx nexpage pack ${esc(hostName)}</code> for the full bundle (DTCG, shadcn, Figma vars, motion, anatomy, Storybook).</p>
    </section>`;
}

function buildUsage() {
  const rules = [
    ['Lead with the primary.', 'It belongs on calls-to-action and one accent moment per screen. Not on body copy.'],
    ['Two type families, three weights.', 'Display for headlines, body for paragraphs. Resist a third unless there is a real reason.'],
    ['Snap to the spacing scale.', 'Padding, margin, and gap should land on the values in §05. One-off pixels accumulate into noise.'],
    ['Treat accessibility as a hard constraint.', 'When a colour pair fails WCAG, fix the colour — not the contrast check.'],
  ];
  return `
    <section id="usage">
      ${chapterHeader('13', 'Usage')}
      <ol class="usage-list">
        ${rules.map(([title, body]) => `
          <li>
            <h3 class="usage-title">${esc(title)}</h3>
            <p class="usage-body">${esc(body)}</p>
          </li>
        `).join('')}
      </ol>
    </section>`;
}

// ── The book ────────────────────────────────────────────────────

export function formatBrandBook(design, opts = {}) {
  if (!design) throw new Error('formatBrandBook: design is required');
  const meta = design.meta || {};
  const hostName = host(meta.url);
  const accent = pickAccent(design);
  const ogTitle = `${hostName} · brand guidelines`;
  const ogDesc = `Design-system documentation for ${hostName}: colour, type, spacing, motion, voice, accessibility, components, and drop-in tokens.`;

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
    --accent: ${accent};
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
  html { scroll-behavior: smooth; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--body);
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: background .25s, color .25s;
  }
  a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--rule); padding-bottom: 1px; }
  a:hover { border-color: var(--ink); }
  code { font-family: var(--mono); font-size: 0.92em; }
  .muted { color: var(--ink-soft); }
  .summary { font-family: var(--mono); font-size: 12px; letter-spacing: .04em; color: var(--ink-faint); margin: 0 0 32px; padding-bottom: 14px; border-bottom: 1px solid var(--rule); }

  .wrap { max-width: 880px; margin: 0 auto; padding: 0 0 96px; }

  /* — Top bar — */
  .topbar { display: flex; justify-content: space-between; align-items: center; padding: 24px 40px; font-size: 13px; border-bottom: 1px solid var(--rule); }
  .brand { font-family: var(--display); font-size: 22px; }
  .brand a { color: var(--ink); text-decoration: none; border-bottom: 0; }
  .topbar nav { display: flex; gap: 18px; align-items: center; color: var(--ink-soft); }
  .theme-btn { background: transparent; border: 1px solid var(--rule); color: var(--ink-soft); font-size: 11px; padding: 6px 12px; border-radius: 999px; cursor: pointer; letter-spacing: .12em; text-transform: uppercase; font-family: var(--body); }
  .theme-btn:hover { color: var(--ink); border-color: var(--ink); }

  /* — Cover — */
  .cover { padding: 0; border-bottom: 1px solid var(--rule); }
  .cover-band {
    height: clamp(180px, 28vw, 320px);
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 32px 40px;
  }
  .cover-band-label {
    font-family: var(--mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .18em;
    opacity: 0.78;
  }
  .cover-band-hex code { font-family: var(--mono); font-size: 13px; opacity: 0.9; }
  .cover-body { padding: 56px 40px 64px; }
  .kicker { font-family: var(--mono); text-transform: uppercase; letter-spacing: .18em; font-size: 11px; color: var(--ink-soft); margin: 0 0 18px; }
  .cover-title {
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(56px, 11vw, 132px);
    line-height: .94;
    letter-spacing: -.02em;
    margin: 0 0 24px;
  }
  .cover-sub { font-size: 19px; line-height: 1.5; color: var(--ink-soft); max-width: 60ch; margin: 0 0 36px; }
  .cover-meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 22px 32px; padding: 28px 0 0; border-top: 1px solid var(--rule); margin: 0; }
  .cover-meta dt { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-faint); margin-bottom: 4px; }
  .cover-meta dd { margin: 0; font-size: 15px; }

  /* — TOC — */
  .toc { padding: 56px 40px; border-bottom: 1px solid var(--rule); background: var(--paper-2); }
  .toc-title { font-family: var(--display); font-weight: 400; font-size: 28px; margin: 0 0 24px; }
  .toc ol { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 48px; }
  @media (max-width: 640px) { .toc ol { columns: 1; } .toc, .topbar, .cover-band, .cover-body { padding-left: 22px; padding-right: 22px; } }
  .toc li { padding: 10px 0; border-top: 1px solid var(--rule); break-inside: avoid; }
  .toc li:last-child { border-bottom: 1px solid var(--rule); }
  .toc a { display: flex; gap: 14px; align-items: baseline; border: 0; }
  .toc-num { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); width: 26px; }
  .toc-label { font-family: var(--display); font-size: 18px; }

  /* — Sections — */
  section { padding: 72px 40px; border-bottom: 1px solid var(--rule); }
  section:last-of-type { border-bottom: 0; }
  @media (max-width: 640px) { section { padding: 48px 22px; } }
  .chapter-header { padding-bottom: 18px; margin-bottom: 28px; border-bottom: 1px solid var(--rule); }
  .sec-num { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; color: var(--ink-faint); text-transform: uppercase; display: block; margin-bottom: 10px; }
  section h2 { font-family: var(--display); font-weight: 400; font-size: clamp(36px, 4.5vw, 56px); line-height: 1.04; letter-spacing: -.005em; margin: 0; }
  .sub { font-family: var(--display); font-weight: 400; font-size: 22px; margin: 36px 0 14px; }

  /* — Meta grid — */
  .meta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px 32px; padding: 0; margin: 0 0 24px; }
  .meta-grid > div { padding: 0; }
  .meta-grid dt { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-faint); margin-bottom: 4px; }
  .meta-grid dd { margin: 0; font-size: 15px; }

  /* — Color section — */
  .brand-grid { display: grid; gap: 20px; margin: 0 0 28px; }
  .brand-grid-pair { grid-template-columns: 1fr 1fr; }
  @media (max-width: 640px) { .brand-grid-pair { grid-template-columns: 1fr; } }
  .brand-color { display: flex; flex-direction: column; gap: 14px; }
  .big-swatch {
    aspect-ratio: 1.9 / 1;
    border-radius: 8px;
    padding: 22px 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.06);
  }
  .brand-color-primary .big-swatch { aspect-ratio: 2.6 / 1; }
  .big-swatch-name { font-family: var(--display); font-size: 32px; line-height: 1; }
  .big-swatch-hex { font-family: var(--mono); font-size: 14px; letter-spacing: .04em; opacity: 0.92; }
  .color-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; padding: 0; margin: 0; }
  .color-meta dt { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-faint); margin-bottom: 2px; }
  .color-meta dd { margin: 0 0 10px; font-size: 14px; }

  .neutral-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; }
  .neutral-cell { aspect-ratio: 1.8 / 1; display: flex; align-items: flex-end; padding: 10px 12px; }
  .neutral-cell code { font-size: 11px; }

  .palette-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; }
  .mini-swatch { aspect-ratio: 1.6 / 1; border-radius: 5px; padding: 9px 11px; display: flex; align-items: flex-end; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
  .mini-swatch code { font-size: 10px; opacity: 0.92; }

  .callout {
    margin-top: 32px;
    padding: 14px 18px;
    background: rgba(0,0,0,.03);
    border-left: 2px solid var(--accent);
    border-radius: 0 4px 4px 0;
    font-size: 14px;
  }
  [data-theme="dark"] .callout { background: rgba(255,255,255,.04); }

  /* — Logo — */
  .logo-card { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: center; padding: 24px 0; }
  @media (max-width: 640px) { .logo-card { grid-template-columns: 1fr; } }
  .logo-canvas { aspect-ratio: 16 / 9; background: var(--paper-2); border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 32px; box-shadow: inset 0 0 0 1px var(--rule); }
  .logo-canvas svg { max-width: 60%; max-height: 80%; }
  .logo-placeholder { font-family: var(--display); font-size: 36px; color: var(--ink-soft); }
  .logo-meta { grid-template-columns: 1fr; }

  /* — Type — */
  .specimen { padding: 18px 0 26px; }
  .spec-line { line-height: 1.05; margin: 0 0 18px; letter-spacing: -.01em; }
  .spec-display { font-weight: 400; }
  .spec-body { color: var(--ink-soft); font-style: italic; }
  .scale-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .scale-table th, .scale-table td { padding: 14px 8px; text-align: left; border-bottom: 1px solid var(--rule); vertical-align: middle; }
  .scale-table th { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-faint); border-bottom: 1px solid var(--ink); }
  .scale-table .t-step { width: 64px; }
  .scale-table .t-size { width: 80px; }
  .scale-table .t-sample { color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* — Spacing — */
  .space-rhythm { display: flex; flex-direction: column; gap: 10px; padding: 8px 0; }
  .space-step { display: flex; align-items: center; gap: 14px; }
  .space-block { height: 14px; background: var(--ink); border-radius: 2px; flex: 0 0 auto; }
  [data-theme="dark"] .space-block { background: var(--ink); }
  .space-step code { font-size: 11px; color: var(--ink-soft); min-width: 56px; }

  /* — Shape — */
  .radii-row, .shadows-row { display: grid; gap: 16px; }
  .radii-row { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
  .shadows-row { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .radius-card, .shadow-card { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .radius-block { width: 96px; height: 96px; background: var(--paper-2); box-shadow: inset 0 0 0 1px var(--rule); }
  .shadow-block { width: 100%; height: 96px; background: var(--paper); border-radius: 10px; }
  [data-theme="dark"] .shadow-block { background: var(--paper-2); }
  .radius-card code, .shadow-card code { font-size: 11px; color: var(--ink-soft); }

  /* — Iconography — */
  .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 10px; }
  .icon-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border: 1px solid var(--rule); border-radius: 6px; padding: 10px; background: var(--paper-2); }
  .icon-cell svg { width: 100%; height: 100%; }

  /* — Motion — */
  .motion-tempo { display: flex; flex-direction: column; gap: 10px; }
  .tempo-item { display: flex; align-items: center; gap: 14px; }
  .tempo-bar { height: 6px; border-radius: 999px; min-width: 24px; opacity: 0.8; flex: 0 0 auto; animation: tempoSlide var(--dur, 600ms) cubic-bezier(.2,.7,.2,1) infinite alternate; }
  @keyframes tempoSlide { from { width: 24px; opacity: 0.5; } to { width: 280px; opacity: 0.95; } }
  .tempo-item code { font-family: var(--mono); font-size: 12px; color: var(--ink-soft); min-width: 120px; }
  .easings { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 10px; }
  .easings li { padding: 6px 12px; background: var(--paper-2); border: 1px solid var(--rule); border-radius: 4px; font-size: 12px; }

  /* — Components — */
  .mock-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 24px; align-items: start; padding: 8px 0 28px; }
  @media (max-width: 640px) { .mock-grid { grid-template-columns: 1fr; } }
  .mock-button { display: flex; flex-direction: column; gap: 14px; padding: 32px; background: var(--paper-2); border-radius: 12px; box-shadow: inset 0 0 0 1px var(--rule); align-items: flex-start; }
  .m-btn { font-family: var(--body); font-size: 14px; font-weight: 500; padding: 12px 22px; border: 1px solid transparent; cursor: pointer; }
  .m-btn-secondary { background: transparent; border-style: solid; border-width: 1px; }
  .mock-card { padding: 26px 28px; box-shadow: inset 0 0 0 1px var(--rule); }
  .m-card-eyebrow { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-faint); }
  .m-card-title { font-family: var(--display); font-weight: 400; font-size: 26px; margin: 8px 0 8px; line-height: 1.1; }
  .m-card-body { margin: 0 0 14px; font-size: 14px; color: var(--ink-soft); line-height: 1.5; }
  .m-card-link { font-family: var(--body); font-size: 13px; font-weight: 500; border: 0; padding: 0; }

  .component-list { display: flex; flex-direction: column; }
  .component-card { padding: 18px 0; border-top: 1px solid var(--rule); }
  .component-card:last-of-type { border-bottom: 1px solid var(--rule); }
  .component-card h4 { font-family: var(--display); font-weight: 400; font-size: 22px; margin: 0 0 14px; }

  /* — Voice — */
  .quotes { list-style: none; padding: 0; margin: 0; }
  .quotes li {
    font-family: var(--display);
    font-size: 26px;
    line-height: 1.18;
    padding: 22px 0;
    border-top: 1px solid var(--rule);
    color: var(--ink);
  }
  .quotes li:last-child { border-bottom: 1px solid var(--rule); }
  .cta-verbs { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; }
  .cta-verbs li { display: flex; align-items: baseline; gap: 6px; font-size: 14px; }
  .cta-verbs code { font-size: 13px; }
  .cta-verbs .muted { font-family: var(--mono); font-size: 11px; }

  /* — Accessibility — */
  .a11y-score { display: flex; align-items: baseline; gap: 24px; padding: 12px 0 32px; border-bottom: 1px solid var(--rule); margin-bottom: 24px; }
  .a11y-num { font-family: var(--display); font-size: clamp(72px, 10vw, 120px); line-height: 1; letter-spacing: -.02em; }
  .a11y-suffix { font-size: 0.5em; color: var(--ink-soft); margin-left: 4px; }
  .a11y-label { color: var(--ink-soft); font-size: 14px; line-height: 1.4; }
  .a11y-pairs { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
  .a11y-pair { display: flex; flex-direction: column; gap: 12px; }
  .a11y-stack { padding: 22px 18px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); display: flex; justify-content: space-between; align-items: center; }
  .a11y-Aa { font-family: var(--display); font-size: 32px; line-height: 1; }
  .a11y-ratio { font-family: var(--mono); font-size: 12px; opacity: 0.9; }
  .a11y-pair dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; padding: 0; margin: 0; }
  .a11y-pair dt { font-family: var(--mono); font-size: 9px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-faint); }
  .a11y-pair dd { margin: 0 0 4px; font-size: 12px; }
  .remediation { list-style: none; padding: 0; margin: 0; }
  .remediation li { padding: 10px 0; border-top: 1px solid var(--rule); }
  .remediation li:last-child { border-bottom: 1px solid var(--rule); }

  /* — Tokens — */
  .codeblock-wrap { margin: 0 0 18px; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; }
  .codeblock-head { display: flex; justify-content: space-between; padding: 10px 14px; font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-faint); background: var(--paper-2); border-bottom: 1px solid var(--rule); }
  .codeblock { background: var(--paper-2); padding: 16px 18px; overflow-x: auto; font-family: var(--mono); font-size: 12px; line-height: 1.6; margin: 0; color: var(--ink); }

  /* — Usage — */
  .usage-list { padding: 0; margin: 0; counter-reset: rule; list-style: none; }
  .usage-list li { padding: 22px 0; border-top: 1px solid var(--rule); position: relative; padding-left: 56px; counter-increment: rule; }
  .usage-list li:last-child { border-bottom: 1px solid var(--rule); }
  .usage-list li::before { content: counter(rule, decimal-leading-zero); position: absolute; left: 0; top: 26px; font-family: var(--mono); font-size: 11px; color: var(--ink-faint); letter-spacing: .14em; }
  .usage-title { font-family: var(--display); font-weight: 400; font-size: 22px; margin: 0 0 6px; }
  .usage-body { margin: 0; color: var(--ink-soft); font-size: 15px; line-height: 1.55; }

  /* — Footer — */
  footer { padding: 40px 40px 0; font-size: 13px; color: var(--ink-soft); display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 16px; }
  footer .sig { font-family: var(--display); font-size: 22px; color: var(--ink); }
  footer .stamp { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; }
  @media (max-width: 640px) { footer { padding: 40px 22px 0; } }

  /* — Print — */
  @media print {
    body { background: white; color: black; }
    .topbar nav, .theme-btn { display: none; }
    .cover, .toc, section { page-break-inside: avoid; border-color: #ddd; padding: 36px 32px; }
    .cover-band { background-color: var(--accent) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toc, .cover { page-break-after: always; }
    section { page-break-before: always; page-break-after: always; break-before: page; }
    .topbar { display: none !important; }
    .scale-table, .a11y-pair, .component-card { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <header class="topbar">
    <div class="brand"><a href="https://nexpage.app">nexpage</a></div>
    <nav>
      <span>Brand guidelines</span>
      <button class="theme-btn" id="themeBtn" type="button">Theme</button>
    </nav>
  </header>

  <main class="wrap">
    ${buildCover(design, accent)}
    ${buildToc()}
    ${buildAbout(design)}
    ${buildLogo(design)}
    ${buildColor(design)}
    ${buildType(design)}
    ${buildSpacing(design)}
    ${buildShape(design)}
    ${buildIconography(design)}
    ${buildMotion(design, accent)}
    ${buildComponents(design, accent)}
    ${buildVoice(design)}
    ${buildAccessibility(design)}
    ${buildTokens(design)}
    ${buildUsage()}

    <footer>
      <div>
        <div class="sig">nexpage</div>
        <div>Re-run: <code>npx nexpage brand ${esc(host(design.meta?.url) || '<url>')}</code></div>
      </div>
      <div class="stamp">${esc(new Date(design.meta?.timestamp || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))} · v${esc(opts.version || '')}</div>
    </footer>
  </main>

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

export function formatBrandBookMarkdown(design) {
  const meta = design.meta || {};
  const hostName = host(meta.url);
  const date = new Date(meta.timestamp || Date.now()).toISOString().slice(0, 10);
  const colors = design.colors || {};
  const t = design.typography || {};
  const families = (t.families || []).map(familyName).filter(Boolean);
  const lines = [
    `# ${hostName} — Brand guidelines`,
    ``,
    `_Generated by nexpage on ${date}._`,
    ``,
    `## 01 · About`,
    ``,
    `- Page intent: ${design.pageIntent?.type || 'unknown'}`,
    `- Material language: ${design.materialLanguage?.label || 'unknown'}`,
    `- Component library: ${design.componentLibrary?.library || 'unknown'}`,
    `- Voice tone: ${design.voice?.tone || 'neutral'}`,
    ``,
    `## 03 · Colour`,
    ``,
    colors.primary?.hex ? `- **Primary:** \`${colors.primary.hex}\`` : '- Primary: —',
    colors.secondary?.hex ? `- **Secondary:** \`${colors.secondary.hex}\`` : null,
    colors.accent?.hex ? `- **Accent:** \`${colors.accent.hex}\`` : null,
    `- ${(colors.all || []).length} total colours`,
    ``,
    `## 04 · Typography`,
    ``,
    `- Display: ${families[0] || '—'}`,
    `- Body: ${families[1] || families[0] || '—'}`,
    `- Scale: ${(t.scale || []).length} sizes`,
    ``,
    `## 05 · Spacing`,
    ``,
    `- Base unit: ${design.spacing?.base ? design.spacing.base + 'px' : '—'}`,
    `- Scale length: ${(design.spacing?.scale || []).length}`,
    ``,
    `## 11 · Accessibility`,
    ``,
    `- WCAG score: ${design.accessibility?.score ?? '—'}%`,
    `- Failing pairs: ${design.accessibility?.failCount ?? '—'}`,
    ``,
    `---`,
    `_Re-run: \`npx nexpage brand ${hostName}\`_`,
  ].filter(Boolean);
  return lines.join('\n');
}
