#!/usr/bin/env node
import { writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { chromium } from 'playwright';
import { extractDesignLanguage, formatDtcgTokens, formatMarkdown, formatTailwind,
  formatCssVars, formatPreview, formatFigma, formatReactTheme, formatShadcnTheme,
  formatMotionTokens, formatWordPress, formatVueTheme, formatSvelteTheme,
  formatAnatomyStubs, formatV0Prompt, formatLovablePrompt, formatCursorPrompt,
  formatClaudeArtifactPrompt, isCodexProfile, isWithCodex, writeCodexContextPack,
  resolveOutputDirectory } from '../src/index.js';

// ── Parse args ──
const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
if (help || args.length === 0) {
  console.log(`
  nexpage — 提取任意网站的设计系统

  用法: nexpage <url> [选项]

  选项:
    -o, --out <dir>   输出目录 (默认: ./nexpage-output/)
    --pick-output     用 Finder 选择保存位置，并自动创建防覆盖子目录
    -y, --yes         跳过"按 Enter 确认"提示，打开浏览器后直接提取
    --profile codex   只生成专供 Codex 使用的精简上下文包
    --with-codex      在完整结果旁额外生成 Codex 精简上下文包
    -h, --help        显示帮助

  示例:
    nexpage https://stripe.com
    nexpage https://stripe.com -o ~/Desktop/stripe-ds
    nexpage https://stripe.com --pick-output
    nexpage https://uiverse.io/elements -y
    nexpage https://stripe.com --pick-output --profile codex
    nexpage https://stripe.com --with-codex
`);
  process.exit(0);
}

let rawUrl = args[0];
if (!rawUrl.startsWith('http')) rawUrl = `https://${rawUrl}`;
try { new URL(rawUrl); } catch { console.error(' 错误：无效的网址'); process.exit(1); }

const skip = args.includes('-y') || args.includes('--yes');
const codexProfile = isCodexProfile(args);
const withCodex = isWithCodex(args);
let output;
try {
  output = resolveOutputDirectory({ args, url: rawUrl });
} catch (error) {
  console.error(`  错误：${error.message}`);
  process.exit(1);
}
const outDir = output.directory;
const hostname = new URL(rawUrl).hostname.replace(/^www\./, '').replace(/\./g, '-');
mkdirSync(outDir, { recursive: true });

console.log('');
console.log('  nexpage');
console.log(`  ${rawUrl}`);
if (output.mode === 'picked') console.log(`  保存到 ${outDir}`);
console.log('');

// ── Step 1: Open visible browser ──
console.log('  ◐ 正在打开浏览器...');
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.goto(rawUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
console.log(`  ✓ 浏览器已打开 — ${await page.title()}`);
console.log('');

// ── Step 2: Wait for user ──
if (!skip) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => {
    rl.question('  请在浏览器中登录或导航到目标页面，完成后按 Enter 继续...', () => {
      rl.close();
      resolve();
    });
  });
  console.log('');
}

// ── Step 3: Screenshot ──
console.log('  ◐ 正在截图...');
const screenshotPath = codexProfile
  ? join(outDir, 'codex-context', 'reference.png')
  : join(outDir, 'page-screenshot.png');
if (codexProfile) mkdirSync(join(outDir, 'codex-context'), { recursive: true });
let screenshot = { ok: false };
try {
  await page.screenshot({ path: screenshotPath, fullPage: false, type: 'png' });
  screenshot = { path: screenshotPath, title: await page.title(), ok: true };
  console.log('  ✓ 截图已保存');
} catch (e) { console.log('  ! 截图失败:', e.message); }

// ── Step 4: Extract ──
console.log('  ◐ 正在提取设计系统...');
const start = Date.now();
const currentUrl = page.url();
const design = await extractDesignLanguage(currentUrl, { existingPage: page, url: currentUrl });
delete design._raw;
delete design._smart;

// ── Step 5: Validate ──
const warnings = [];
const title = design.meta?.title || '';
if (/cloudflare|attention required|just a moment|checking your browser|ddos|captcha|verify|验证|人机|are you human|enable javascript/i.test(title))
  warnings.push(`页面标题可疑："${title}"，可能是验证页`);
const elc = design.meta?.elementCount || 0;
if (elc < 100) warnings.push(`仅 ${elc} 个 DOM 元素`);
const families = design.typography?.families || [];
const sys = new Set(['Times','Arial','Helvetica','sans-serif','serif','monospace','system-ui','-apple-system']);
if (families.length <= 1 && !families.some(f => !sys.has(f.name)))
  warnings.push('无自定义字体');

// ── Step 6: Close browser ──
await browser.close();
console.log(`  ✓ 提取完成 (${((Date.now()-start)/1000).toFixed(1)}s)`);
console.log('');

// ── Step 7: Generate output files ──
console.log('  ◐ 正在生成输出文件...');
const p = hostname;
function w(name, content) {
  try { writeFileSync(join(outDir, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2)); } catch {}
}
if (!codexProfile) {
const dl = await import('../src/index.js');
w(`${p}-design-tokens.json`, dl.formatDtcgTokens(design));
w(`${p}-variables.css`, dl.formatCssVars(design));
try { w(`${p}-tailwind-v4.css`, (await import('../src/formatters/tailwind-v4.js')).formatTailwindV4(design)); } catch {}
w(`${p}-tailwind.config.js`, dl.formatTailwind(design));
try { w(`${p}-tokens.d.ts`, (await import('../src/formatters/ts-defs.js')).formatTsDefs(design)); } catch {}
try { w(`${p}-reset.css`, (await import('../src/formatters/css-reset.js')).formatCssReset(design)); } catch {}
w(`${p}-shadcn-theme.css`, dl.formatShadcnTheme(design));
try { const g = await import('../src/formatters/gradients.js'); w(`${p}-gradients.css`, g.formatGradientsCss(design)); w(`${p}-gradients.json`, g.formatGradientsJson(design)); } catch {}
w(`${p}-figma-variables.json`, dl.formatFigma(design));
w(`${p}-design-language.md`, dl.formatMarkdown(design));
w(`${p}-preview.html`, dl.formatPreview(design));
try { w(`${p}-AGENT.md`, (await import('../src/formatters/agent-prompt.js')).formatAgentPrompt(design)); } catch {}
try { w(`${p}-DESIGN.md`, (await import('../src/formatters/design-md.js')).formatDesignMd(design)); } catch {}
try { w(`${p}.brand.html`, (await import('../src/formatters/brand-book.js')).formatBrandBook(design, { version: '0.1.0' })); } catch {}
for (const [m, n] of [['motion-lab','motion.html'],['framer-motion','motion.framer.js'],['motion-one','motion.one.js'],['motion-css','motion.css'],['motion-tailwind','motion.tailwind.js'],['motion-gsap','motion.gsap.js'],['motion-waapi','motion.waapi.js']]) {
  try { const mod = await import(`../src/formatters/${m}.js`); w(`${p}-${n}`, mod[Object.keys(mod).find(k => k.startsWith('format')) || 'default'](design)); } catch {}
}
w(`${p}-motion-tokens.json`, dl.formatMotionTokens(design.motion || {}));
w(`${p}-theme.js`, dl.formatReactTheme(design));
try { w(`${p}-vue-theme.js`, dl.formatVueTheme(design)); } catch {}
try { w(`${p}-svelte-theme.css`, dl.formatSvelteTheme(design)); } catch {}
try { w(`${p}-wordpress-theme.json`, dl.formatWordPress(design)); } catch {}
const pd = join(outDir, `${p}-prompts`); mkdirSync(pd, { recursive: true });
try { w(join(`${p}-prompts`, 'v0.txt'), dl.formatV0Prompt(design)); } catch {}
try { w(join(`${p}-prompts`, 'lovable.txt'), dl.formatLovablePrompt(design)); } catch {}
try { w(join(`${p}-prompts`, 'cursor.md'), dl.formatCursorPrompt(design)); } catch {}
try { w(join(`${p}-prompts`, 'claude-artifacts.md'), dl.formatClaudeArtifactPrompt(design)); } catch {}
try { if (Array.isArray(design.componentAnatomy) && design.componentAnatomy.length) w(`${p}-anatomy.tsx`, dl.formatAnatomyStubs(design.componentAnatomy)); } catch {}
w(`${p}-voice.json`, design.voice);
w(`${p}-intent.json`, { pageIntent: design.pageIntent, sectionRoles: design.sectionRoles });
w(`${p}-visual-dna.json`, { materialLanguage: design.materialLanguage, imageryStyle: design.imageryStyle, backgroundPatterns: design.backgroundPatterns });
if (design.componentLibrary) w(`${p}-library.json`, design.componentLibrary);
if (design.seo) w(`${p}-seo.json`, design.seo);
if (design.iconSystem) w(`${p}-icon-system.json`, design.iconSystem);
if (design.stackIntel) w(`${p}-stack-intel.json`, design.stackIntel);
if (design.formStates) w(`${p}-form-states.json`, design.formStates);
if (design.darkModePaired?.available) w(`${p}-dark-mode.json`, design.darkModePaired);
w(`${p}-mcp.json`, { colors: { all: design.colors?.all || [] }, regions: design.regions || [], componentClusters: design.componentClusters || [], accessibility: { remediation: design.accessibility?.remediation || [] }, cssHealth: design.cssHealth || null });
writeFileSync(join(outDir, 'result.json'), JSON.stringify(design, null, 2));
}

let codexPack = null;
if (codexProfile || withCodex) {
  codexPack = writeCodexContextPack({
    design,
    outDir,
    screenshotPath: screenshot.ok ? screenshotPath : null,
    hostname,
  });
  console.log(`  ✓ Codex 上下文包已生成 (${codexPack.files.length} 个文件)`);
}

// ── Summary ──
const s = design.score || {};
const c = design.colors || {};
const t = design.typography || {};
const files = codexProfile && codexPack ? codexPack.files.length : readdirSync(outDir).length;

const gradeIcon = s.grade === 'A' ? '●' : s.grade === 'B' ? '◉' : '○';
console.log('  ══════════════════════════════════════');
console.log(`  ${hostname}`);
console.log(`  ${title}`);
console.log('  ──────────────────────────────────────');
console.log(`  ${gradeIcon} 评分  ${s.grade || '—'} · ${s.overall || '—'}/100`);
console.log(`  ● 主色  ${c.primary?.hex || '—'}`);
console.log(`  ● 字体  ${(t.families || []).map(f => f.name).join(', ') || '—'}`);
console.log(`  ● 颜色  ${(c.all || []).length} 种`);
console.log(`  ● DOM 元素  ${design.meta?.elementCount || 0}`);
console.log(`  ● 文件  ${files} 个`);
if (warnings.length) {
  console.log('  ──────────────────────────────────────');
  console.log('  ! 注意事项:');
  warnings.forEach(w => console.log(`    - ${w}`));
}
console.log('  ──────────────────────────────────────');
console.log(`  ✓ 已保存到 ${outDir}/`);
if (codexPack) console.log(`  ✓ Codex 使用目录 ${codexPack.directory}/`);
console.log('');
