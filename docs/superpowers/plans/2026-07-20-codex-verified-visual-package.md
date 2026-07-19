# Nexpage Verified Codex Visual Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `--profile codex` 升级为可直接交给 Codex 的可信视觉包：机器文件只包含已验证规则，截图负责视觉比例，`CODEX.md` 负责边界和使用行为，且不改变默认 40 多文件完整导出。

**Architecture:** 在现有设计提取结果与 Codex 输出之间增加单一的“可信视觉模型”。Codex 模式在当前 Playwright `Page` 关闭前补采关键计算样式与运行中动画；模型将证据分为 `verified`、`candidates`、`rejected` 和 `rhythm`；全部文本输出由该模型统一生成，再经过包级验证与原子替换。

**Tech Stack:** Node.js 20+、ES Modules、Playwright、`node:test`、内置 `node:fs`/`node:path`/`node:os`；不增加第三方依赖，不调用 Codex/OpenAI API。

## Global Constraints

- 保持 `bin/nexpage.mjs` 的默认完整导出内容与文件命名不变；默认模式不得运行 Codex 专用证据收集。
- `--profile codex` 只生成 `codex-context/`；`--with-codex` 保留完整输出并附加该目录。
- 输出最多六个文件：必需的 `reference.png`、`CODEX.md`、`tokens.json`、`variables.css`，可降级的 `reference-full.png`，以及仅在有可靠动效时存在的 `motion.json`。
- 只有 `verified` 数据可以进入 `tokens.json`、`variables.css` 和 `motion.json`；`candidates` 只能出现在 `CODEX.md`；`rejected` 不对下游输出。
- `reference.png` 缺失属于核心失败；`reference-full.png` 缺失允许降级，但终端与 `CODEX.md` 都必须明确提示覆盖范围有限。
- 新实现不得复用通用 `formatDtcgTokens()` 或 `formatCssVars()` 生成 Codex 机器文件，避免 `[object Object]`、站点运行时变量和断裂引用；原有完整输出继续使用它们。
- 写包时先在目标目录同级生成 staging，验证通过后再替换；已有 `codex-context/` 在新包验证通过前必须保持不变，切换失败必须恢复备份。
- 保留工作区中与本计划无关的既有修改。每次提交只使用列出的精确路径执行 `git add`，禁止 `git add .`。
- 每个任务遵循 TDD：先写失败测试并确认失败原因，再写最小实现，随后运行相关测试和全量测试。

---

## Task 1: 收集 Codex 专用渲染证据

**Files:**

- Create: `src/codex/collect-evidence.js`
- Create: `test/fixtures/codex-fixture.js`
- Create: `test/codex-evidence.test.js`
- Modify: `src/index.js`

- [ ] **Step 1: 建立稳定的 Greptile 风格测试夹具**

在 `test/fixtures/codex-fixture.js` 导出 `greptileEvidence`。夹具必须包含两个作用域不同的绿色 CTA、紫色标题/正文、三种字体、重复切角、深浅表面和两条实际动画：

```js
export const greptileEvidence = {
  viewport: { width: 1280, height: 800 },
  headings: [{
    selector: 'h1', text: 'Build software with confidence', visible: true,
    rect: { x: 96, y: 172, width: 760, height: 150 },
    style: {
      color: 'rgb(61, 59, 79)', backgroundColor: 'rgba(0, 0, 0, 0)',
      fontFamily: 'Anybody, sans-serif', fontSize: '72px', fontWeight: '700',
      lineHeight: '76px', letterSpacing: '-1.44px', borderRadius: '0px',
      borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)', clipPath: 'none',
    },
  }],
  bodyText: [{
    selector: 'main p', text: 'AI code review for engineering teams', visible: true,
    rect: { x: 96, y: 350, width: 560, height: 58 },
    style: {
      color: 'rgb(61, 59, 79)', backgroundColor: 'rgba(0, 0, 0, 0)',
      fontFamily: 'DM Sans, sans-serif', fontSize: '18px', fontWeight: '400',
      lineHeight: '29px', letterSpacing: 'normal', borderRadius: '0px',
      borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)', clipPath: 'none',
    },
  }],
  labels: [{
    selector: '.eyebrow', text: 'CODE INTELLIGENCE', visible: true,
    rect: { x: 96, y: 132, width: 180, height: 18 },
    style: {
      color: 'rgb(61, 59, 79)', backgroundColor: 'rgba(0, 0, 0, 0)',
      fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: '400',
      lineHeight: '18px', letterSpacing: '0.72px', borderRadius: '0px',
      borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)', clipPath: 'none',
    },
  }],
  actions: [
    {
      selector: 'nav a.cta', text: 'Get started', scope: 'nav', visible: true,
      rect: { x: 1088, y: 24, width: 112, height: 44 },
      style: {
        color: 'rgb(61, 59, 79)', backgroundColor: 'rgb(40, 233, 159)',
        fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: '600',
        lineHeight: '20px', letterSpacing: 'normal', borderRadius: '0px',
        borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)',
        clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
      },
    },
    {
      selector: 'main a.cta', text: 'Book a demo', scope: 'main', visible: true,
      rect: { x: 96, y: 444, width: 146, height: 48 },
      style: {
        color: 'rgb(61, 59, 79)', backgroundColor: 'rgb(40, 233, 159)',
        fontFamily: 'DM Sans, sans-serif', fontSize: '15px', fontWeight: '600',
        lineHeight: '22px', letterSpacing: 'normal', borderRadius: '0px',
        borderWidth: '0px', borderColor: 'rgba(0, 0, 0, 0)',
        clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
      },
    },
  ],
  cards: [{
    selector: '.feature-card', visible: true,
    rect: { x: 96, y: 980, width: 340, height: 260 },
    style: {
      color: 'rgb(61, 59, 79)', backgroundColor: 'rgb(245, 244, 237)',
      fontFamily: 'DM Sans, sans-serif', fontSize: '16px', fontWeight: '400',
      lineHeight: '24px', letterSpacing: 'normal', borderRadius: '0px',
      borderWidth: '1px', borderColor: 'rgb(61, 59, 79)', clipPath: 'none',
    },
  }],
  surfaces: [
    { selector: 'body', order: 0, rect: { width: 1280, height: 2400 }, style: { backgroundColor: 'rgb(245, 244, 237)', color: 'rgb(61, 59, 79)' } },
    { selector: 'main section:nth-of-type(2)', order: 1, rect: { width: 1280, height: 720 }, style: { backgroundColor: 'rgb(61, 59, 79)', color: 'rgb(245, 244, 237)' } },
    { selector: 'main section:nth-of-type(3)', order: 2, rect: { width: 1280, height: 680 }, style: { backgroundColor: 'rgb(245, 244, 237)', color: 'rgb(61, 59, 79)' } },
  ],
  animations: [
    { name: 'float-code', target: '.code-window', duration: 6000, easing: 'ease-in-out', iterations: Infinity, playState: 'running' },
    { name: 'grid-drift', target: '.background-grid', duration: 40000, easing: 'linear', iterations: Infinity, playState: 'running' },
  ],
};
```

- [ ] **Step 2: 写证据收集器的失败测试**

在 `test/codex-evidence.test.js` 使用一个只记录 `evaluate()` 次数的假 Page，锁定公开接口和返回值：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCodexEvidence } from '../src/codex/collect-evidence.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

test('collectCodexEvidence reuses the supplied page exactly once', async () => {
  let calls = 0;
  const page = {
    async evaluate(callback) {
      calls += 1;
      assert.equal(typeof callback, 'function');
      return structuredClone(greptileEvidence);
    },
  };

  const evidence = await collectCodexEvidence(page);
  assert.equal(calls, 1);
  assert.equal(evidence.actions.length, 2);
  assert.deepEqual(evidence.animations.map(item => item.duration), [6000, 40000]);
});

test('collectCodexEvidence rejects an invalid Page', async () => {
  await assert.rejects(() => collectCodexEvidence(null), /page\.evaluate is required/);
});
```

- [ ] **Step 3: 运行测试并确认因模块不存在而失败**

Run: `node --test test/codex-evidence.test.js`

Expected: `ERR_MODULE_NOT_FOUND` 指向 `src/codex/collect-evidence.js`。

- [ ] **Step 4: 实现单次 `page.evaluate()` 收集**

创建 `src/codex/collect-evidence.js`。页面函数必须：

- 用 `getComputedStyle()` 生成相同的 `style` 字段；
- 用 `getBoundingClientRect()` 记录位置和面积，只保留可见元素；
- 分别采样 `h1,h2,h3`、正文、导航/技术标签、按钮/链接、卡片候选和主要表面；
- 给 action 标记 `nav`、`main`、`footer` 或 `other` 作用域；
- 读取 `document.getAnimations()`，把 `effect.getTiming()` 的真实 `duration`、`easing`、`iterations` 与 target selector 绑定；
- 对每一类设置上限，避免把整棵 DOM 重复复制到 Node 进程。

公开接口固定为：

```js
export async function collectCodexEvidence(page) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new TypeError('page.evaluate is required');
  }
  return page.evaluate(() => {
    // 此函数内只使用浏览器原生 DOM API，返回可 JSON 序列化对象。
  });
}
```

- [ ] **Step 5: 从公共入口导出并验证测试**

在 `src/index.js` 增加：

```js
export { collectCodexEvidence } from './codex/collect-evidence.js';
```

Run: `node --test test/codex-evidence.test.js`

Expected: 2 tests pass。

- [ ] **Step 6: 提交本任务**

```bash
git add src/codex/collect-evidence.js test/fixtures/codex-fixture.js test/codex-evidence.test.js src/index.js
git commit -m "feat: collect rendered evidence for Codex packages"
```

## Task 2: 构建 verified / candidates / rejected / rhythm 模型

**Files:**

- Create: `src/codex/verified-model.js`
- Create: `test/codex-model.test.js`
- Modify: `src/index.js`

- [ ] **Step 1: 写颜色、字体、形状和异常间距的失败测试**

`test/codex-model.test.js` 使用 Task 1 的 `greptileEvidence`，并构造只提供原始统计而不提供可靠语义的 design：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiedVisualModel } from '../src/codex/verified-model.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

const design = {
  meta: { url: 'https://www.greptile.com/', title: 'Greptile', elementCount: 1200 },
  colors: { all: [{ hex: '#0000ee', count: 22 }, { hex: '#28e99f', count: 4 }] },
  typography: { families: [], scale: [] },
  spacing: { scale: [4, 8, 16, 24, 32, 64, 233, 337] },
  borders: { radii: [] },
  shadows: { values: [] },
  motion: { keyframes: [{ name: 'float-code', used: true }, { name: 'grid-drift', used: true }] },
  sectionRoles: { readingOrder: ['hero', 'testimonials', 'faq'] },
};

test('model promotes rendered semantic evidence instead of raw frequency', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, {
    hostname: 'greptile-com', fullPageCaptured: true,
  });
  assert.equal(model.kind, 'nexpage-verified-visual-model');
  assert.equal(model.verified.colors.actionPrimary.value, '#28e99f');
  assert.equal(model.verified.colors.ink.value, '#3d3b4f');
  assert.ok(model.verified.materials.some(item => item.value.background === '#3d3b4f'));
  assert.equal(model.verified.typography.display.value.family, 'Anybody');
  assert.equal(model.verified.typography.body.value.family, 'DM Sans');
  assert.equal(model.verified.typography.mono.value.family, 'Space Mono');
  assert.match(model.verified.shapes.actionPrimary.value.clipPath, /^polygon\(/);
});

test('model rejects one-off measurements and source information architecture', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });
  const scale = model.verified.spacing.map(item => item.value);
  assert.equal(scale.includes(233), false);
  assert.equal(scale.includes(337), false);
  assert.equal(JSON.stringify(model.rhythm).includes('testimonials'), false);
  assert.equal(JSON.stringify(model.rhythm).includes('faq'), false);
  assert.ok(model.rejected.some(item => item.path.includes('spacing')));
});

test('model binds animation targets to actual durations', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });
  assert.deepEqual(model.verified.motion.map(item => item.value.duration), [6000, 40000]);
  assert.deepEqual(model.verified.motion.map(item => item.value.target), ['.code-window', '.background-grid']);
});
```

- [ ] **Step 2: 确认模型测试失败**

Run: `node --test test/codex-model.test.js`

Expected: `ERR_MODULE_NOT_FOUND` 指向 `src/codex/verified-model.js`。

- [ ] **Step 3: 实现固定模型契约与净化工具**

创建 `src/codex/verified-model.js`，导出：

```js
export function buildVerifiedVisualModel(design, evidence = {}, options = {}) {
  return {
    kind: 'nexpage-verified-visual-model',
    meta: {
      title: design.meta?.title || options.hostname || 'Extracted Website',
      source: design.meta?.url || '',
      hostname: options.hostname || '',
      elementCount: Number.isFinite(design.meta?.elementCount) ? design.meta.elementCount : 0,
    },
    coverage: {
      viewport: true,
      fullPage: options.fullPageCaptured === true,
      fullPageError: options.fullPageError || null,
    },
    verified: {
      colors: {}, typography: {}, spacing: [], shapes: {},
      materials: [], components: { actions: [], cards: [] }, motion: [],
    },
    candidates: { colors: [], typography: [], shapes: [], rhythm: [] },
    rejected: [],
    rhythm: { surfaceSequence: [], principles: [] },
  };
}
```

每个已验证条目统一为 `{ value, confidence, evidence }`。实现以下净化规则：

- 把 `rgb()`/`rgba()` 转为小写六位 hex；透明背景不参与角色判断。
- 拒绝空值、对象字符串、浏览器默认蓝/紫链接色和不可序列化数值。
- 字体只保留首个真实 family 名，去掉引号与 fallback。
- 尺寸只接受有限数值。
- 对相邻相同 surface 去重。

- [ ] **Step 4: 实现语义验证规则**

规则固定如下：

- `actionPrimary`：有实色背景的可见 action；按跨作用域重复、实例数、色彩饱和度和面积共同评分。关键 `main` action 即使单实例也可进入 verified，但必须写明证据。
- `ink`：H1 与正文共同使用的文本色优先；`surface`：body/大面积 section 的浅色背景；深色 section 记录为独立 material surface，并可支持 `actionSecondary`，但不覆盖 ink 角色。
- `display`、`body`、`mono`：分别来自 H1、正文和带 `Mono`/`monospace` 的标签；字号层级由可见角色而非最大数值决定。
- spacing：保留 4–128px 范围内、在渲染证据中重复或接近 4/8 基础节奏的数值；其他值写入 `rejected`，不进入 candidates。
- shape：跨 action 重复的 `clipPath`/圆角进入 verified；单个关键主 action 的明确形状允许 verified；缺失圆角和阴影不生成占位条目。
- motion：只绑定 `evidence.animations` 中正在运行且 duration 为正数的动画，并与 `design.motion.keyframes` 的名称交叉验证。
- rhythm：只输出“浅/深表面交替、强调色克制、卡片密度变化”等抽象原则和匿名色序列，禁止复制 `sectionRoles.readingOrder` 的业务名称。

- [ ] **Step 5: 增加降级覆盖测试**

追加：

```js
test('model records limited coverage without inventing full-page rhythm', () => {
  const model = buildVerifiedVisualModel(design, {
    ...greptileEvidence,
    surfaces: greptileEvidence.surfaces.slice(0, 1),
  }, { fullPageCaptured: false, fullPageError: 'page height exceeded limit' });
  assert.equal(model.coverage.fullPage, false);
  assert.equal(model.coverage.fullPageError, 'page height exceeded limit');
  assert.deepEqual(model.rhythm.surfaceSequence, []);
});
```

Run: `node --test test/codex-model.test.js`

Expected: 4 tests pass。

- [ ] **Step 6: 导出并运行相关测试**

在 `src/index.js` 增加：

```js
export { buildVerifiedVisualModel } from './codex/verified-model.js';
```

Run: `node --test test/codex-evidence.test.js test/codex-model.test.js`

Expected: 6 tests pass。

- [ ] **Step 7: 提交本任务**

```bash
git add src/codex/verified-model.js test/codex-model.test.js src/index.js
git commit -m "feat: build a verified visual model"
```

## Task 3: 从单一模型生成四类文本文件

**Files:**

- Create: `src/codex/format-context.js`
- Create: `test/codex-format.test.js`
- Modify: `src/formatters/codex-context.js`
- Modify: `src/index.js`

- [ ] **Step 1: 写输出契约的失败测试**

在 `test/codex-format.test.js` 构建模型并验证四个格式器：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVerifiedContextFiles,
  formatVerifiedCodexContext,
  formatVerifiedTokens,
  formatVerifiedCss,
  formatVerifiedMotion,
} from '../src/codex/format-context.js';
import { buildVerifiedVisualModel } from '../src/codex/verified-model.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

const design = {
  meta: { url: 'https://www.greptile.com/', title: 'Greptile', elementCount: 1200 },
  spacing: { scale: [4, 8, 16, 24, 32, 64, 233] },
  motion: { keyframes: [{ name: 'float-code', used: true }, { name: 'grid-drift', used: true }] },
};
const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });

test('machine files contain verified values and no object strings', () => {
  const files = buildVerifiedContextFiles(model);
  assert.deepEqual(Object.keys(files).sort(), ['CODEX.md', 'motion.json', 'tokens.json', 'variables.css']);
  assert.doesNotMatch(files['variables.css'], /\[object Object\]|undefined|null/);
  assert.doesNotMatch(files['tokens.json'], /\[object Object\]|undefined/);
  assert.match(files['variables.css'], /--color-action-primary: #28e99f;/);
  assert.match(files['variables.css'], /--shape-action-primary-clip-path: polygon\(/);
});

test('tokens only create semantic references backed by primitive definitions', () => {
  const tokens = JSON.parse(formatVerifiedTokens(model));
  assert.equal(tokens.semantic.color.actionPrimary.$value, '{color.action-primary}');
  assert.equal(tokens.color['action-primary'].$value, '#28e99f');
  assert.equal(tokens.semantic.radius, undefined);
  assert.equal(tokens.semantic.shadow, undefined);
  assert.match(tokens.$extensions['nexpage/shapes'].actionPrimary.clipPath, /^polygon\(/);
});

test('CODEX context establishes style and waits for product requirements', () => {
  const markdown = formatVerifiedCodexContext(model);
  assert.match(markdown, /不要复刻来源页面/);
  assert.match(markdown, /尚未收到新产品需求.*等待/);
  assert.match(markdown, /先设计新产品自己的信息架构/);
  assert.doesNotMatch(markdown, /Hero.*Testimonials.*FAQ/i);
});

test('motion output preserves real target and duration', () => {
  const motion = JSON.parse(formatVerifiedMotion(model));
  assert.deepEqual(motion.animations.map(item => item.duration), [6000, 40000]);
  assert.equal(motion.animations[1].target, '.background-grid');
});
```

- [ ] **Step 2: 运行并确认因 formatter 不存在而失败**

Run: `node --test test/codex-format.test.js`

Expected: `ERR_MODULE_NOT_FOUND` 指向 `src/codex/format-context.js`。

- [ ] **Step 3: 实现 CODEX.md 与文件阅读顺序**

创建 `src/codex/format-context.js`。`formatVerifiedCodexContext(model)` 固定包含这些章节：

1. `用途与边界`
2. `Codex 行为规则`
3. `阅读顺序与证据优先级`
4. `已验证视觉语言`
5. `低可信候选`
6. `抽象视觉节奏`
7. `覆盖范围与限制`

行为规则必须使用直接指令语言：

```md
- 本目录只用于建立视觉语言，不用于复刻来源页面。
- 不复制来源品牌、Logo、文案、专有插画、产品内容或信息架构。
- 如果尚未收到新产品需求，确认已读取视觉基准后等待用户继续说明需求。
- 如果视觉包与产品需求同时提供，先设计新产品自己的信息架构，再应用本视觉语言。
- 截图决定视觉比例，已验证规则决定语义，机器文件提供精确数值；候选不是强制规范。
```

阅读优先级写为：用户需求 → 两张截图 → CODEX 已验证规则 → CSS/Token/Motion → 低可信候选。若 `coverage.fullPage === false`，必须说明只覆盖桌面首屏，不得推断完整页面节奏。

- [ ] **Step 4: 实现安全的 Token、CSS 和 Motion formatter**

公开接口：

```js
export function formatVerifiedCodexContext(model) {}
export function formatVerifiedTokens(model) {}
export function formatVerifiedCss(model) {}
export function formatVerifiedMotion(model) {}
export function buildVerifiedContextFiles(model) {}
```

约束：

- `tokens.json` 使用 DTCG 标量类型；颜色 primitive 在 `color` 下，语义引用在 `semantic.color` 下；字体组合对象使用 `$type: "typography"`；非标准 shape 放入根级 `$extensions['nexpage/shapes']`，避免制造无效 DTCG 类型。
- 只有 primitive 已存在时才创建 `{path}` 引用；没有 radius/shadow 就完全不创建相关 semantic key。
- `variables.css` 只输出一个 `:root {}`，每一行必须是 `--kebab-case: scalar;`；不输出来源页的 `--tw-*` 或任意复杂对象。
- `motion.json` 使用 `{ "animations": [...] }`，每项包含 `name`、`target`、`duration`、`easing`、`iterations`、`category`、`reducedMotion`。
- `buildVerifiedContextFiles()` 始终返回前三个文件，只有 `model.verified.motion.length > 0` 时才加入 `motion.json`。

- [ ] **Step 5: 让旧 formatter 退化为兼容 facade**

修改 `src/formatters/codex-context.js`：

- 保留 `isCodexProfile()` 与 `isWithCodex()` 及其现有行为；
- `formatCodexContext(design, options)` 先构建模型，再调用 `formatVerifiedCodexContext()`；
- `buildCodexContextFiles(design, options)` 支持 `options.evidence` 与覆盖信息，然后调用 `buildVerifiedContextFiles()`；
- 暂时保留 `writeCodexContextPack()` 导出名称，但在 Task 5 中切换到原子 writer；
- 删除对通用 `formatCssVars`、`formatDtcgTokens`、`formatMotionTokens` 的依赖。

在 `src/index.js` 导出新 formatter，同时维持已有导出名称，避免破坏现有调用者。

- [ ] **Step 6: 验证 formatter 与兼容测试**

Run: `node --test test/codex-format.test.js test/codex-context.test.js`

Expected: 新 formatter 测试全部通过；现有 flag 与基本包文件测试继续通过。若现有测试断言旧文案或旧 Token 结构，更新其断言以匹配已经确认的新契约，不删除 flag 覆盖。

- [ ] **Step 7: 提交本任务**

```bash
git add src/codex/format-context.js test/codex-format.test.js src/formatters/codex-context.js src/index.js test/codex-context.test.js
git commit -m "feat: format Codex files from verified evidence"
```

## Task 4: 增加包级质量门槛

**Files:**

- Create: `src/codex/validate-package.js`
- Create: `test/codex-package-validation.test.js`
- Modify: `src/index.js`

- [ ] **Step 1: 写有效包、断裂引用、非法 CSS 和截图降级测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCodexPackage, assertValidCodexPackage } from '../src/codex/validate-package.js';

const validFiles = {
  'CODEX.md': '# Context\n\n## 用途与边界\n不要复刻来源页面。\n\n## Codex 行为规则\n等待新产品需求。\n\n## 阅读顺序与证据优先级\n截图优先。\n\n## 覆盖范围与限制\n缺少完整页面截图时只覆盖桌面首屏，不推断完整页面节奏。\n',
  'tokens.json': JSON.stringify({
    color: { ink: { $type: 'color', $value: '#3d3b4f' } },
    semantic: { color: { ink: { $type: 'color', $value: '{color.ink}' } } },
  }),
  'variables.css': ':root {\n  --color-ink: #3d3b4f;\n}\n',
};

test('validates a core package and warns when full screenshot is missing', () => {
  const result = validateCodexPackage({
    files: validFiles, referencePath: '/tmp/reference.png', referenceExists: true,
    fullPagePath: null, fullPageExists: false,
  });
  assert.equal(result.ok, true);
  assert.match(result.warnings.join('\n'), /完整页面截图/);
});

test('rejects missing token references and object strings', () => {
  const files = {
    ...validFiles,
    'tokens.json': JSON.stringify({ semantic: { radius: { card: { $value: '{radius.r0}' } } } }),
    'variables.css': ':root {\n  --bad: [object Object];\n}\n',
  };
  const result = validateCodexPackage({ files, referenceExists: true, fullPageExists: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /radius\.r0/);
  assert.match(result.errors.join('\n'), /object Object/);
  assert.throws(() => assertValidCodexPackage({ files, referenceExists: true }), {
    name: 'CodexPackageValidationError',
  });
});

test('rejects an empty motion file and missing reference screenshot', () => {
  const result = validateCodexPackage({
    files: { ...validFiles, 'motion.json': '{"animations":[]}' },
    referenceExists: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /reference\.png/);
  assert.match(result.errors.join('\n'), /motion\.json/);
});
```

- [ ] **Step 2: 确认 validator 测试失败**

Run: `node --test test/codex-package-validation.test.js`

Expected: `ERR_MODULE_NOT_FOUND` 指向 `src/codex/validate-package.js`。

- [ ] **Step 3: 实现递归引用解析和文件验证**

创建以下接口：

```js
export class CodexPackageValidationError extends Error {
  constructor(errors) {
    super(`Codex package validation failed:\n- ${errors.join('\n- ')}`);
    this.name = 'CodexPackageValidationError';
    this.errors = errors;
  }
}

export function validateCodexPackage(input) {
  return { ok: errors.length === 0, errors, warnings };
}

export function assertValidCodexPackage(input) {
  const result = validateCodexPackage(input);
  if (!result.ok) throw new CodexPackageValidationError(result.errors);
  return result;
}
```

验证规则：

- 必需文本文件存在且非空；`referenceExists` 必须为 true。
- JSON 必须可解析；递归扫描所有形如 `{a.b.c}` 的字符串，并从 JSON 根对象解析该路径。
- CSS 必须只有 `:root` 块、空行/注释/大括号和 `--[a-z0-9-]+: 非空标量;` 声明；拒绝 `[object Object]`、`undefined`、`null` 和重复变量名。
- `CODEX.md` 必须包含用途边界、行为规则、阅读顺序，并包含“不复刻/不复制”和“等待需求”的含义。
- 存在 `motion.json` 时 `animations` 必须为非空数组，每条 duration 大于 0 且 target 非空。
- `fullPageExists === false` 只产生 warning；如果 CODEX.md 没有相应覆盖限制，则产生 error。
- 递归检查 machine files 不得包含 `candidate` 或 `candidates` 键。

- [ ] **Step 4: 导出并运行验证测试**

在 `src/index.js` 增加 validator 三个公开导出。

Run: `node --test test/codex-package-validation.test.js test/codex-format.test.js`

Expected: 全部通过。

- [ ] **Step 5: 提交本任务**

```bash
git add src/codex/validate-package.js test/codex-package-validation.test.js src/index.js
git commit -m "feat: validate Codex package integrity"
```

## Task 5: 使用 staging、备份和恢复原子写包

**Files:**

- Create: `src/codex/write-package.js`
- Create: `test/codex-package-write.test.js`
- Modify: `src/formatters/codex-context.js`
- Modify: `src/index.js`

- [ ] **Step 1: 写成功替换与失败保留旧包的测试**

测试只使用 `mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'))` 创建隔离目录；测试结束时只删除该精确临时目录。

```js
test('writes a validated package and atomically replaces an old package', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
    const old = join(root, 'codex-context');
    mkdirSync(old);
    writeFileSync(join(old, 'old.txt'), 'old');
    const referencePath = join(root, 'capture.png');
    const fullPagePath = join(root, 'capture-full.png');
    writeFileSync(referencePath, 'viewport');
    writeFileSync(fullPagePath, 'full');

    const result = writeCodexContextPack({
      design, evidence: greptileEvidence, outDir: root,
      referencePath, fullPagePath, hostname: 'greptile-com',
    });
    assert.equal(existsSync(join(old, 'old.txt')), false);
    assert.deepEqual(result.files.sort(), [
      'CODEX.md', 'motion.json', 'reference-full.png',
      'reference.png', 'tokens.json', 'variables.css',
    ]);
    assert.equal(readdirSync(root).some(name => name.includes('staging') || name.includes('backup')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('keeps the previous package when core validation fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
    const old = join(root, 'codex-context');
    mkdirSync(old);
    writeFileSync(join(old, 'marker.txt'), 'keep me');
    assert.throws(() => writeCodexContextPack({
      design, evidence: greptileEvidence, outDir: root,
      referencePath: join(root, 'missing.png'), hostname: 'greptile-com',
    }), /reference\.png/);
    assert.equal(readFileSync(join(old, 'marker.txt'), 'utf8'), 'keep me');
    assert.equal(readdirSync(root).some(name => name.includes('staging') || name.includes('backup')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 运行并确认 writer 测试失败**

Run: `node --test test/codex-package-write.test.js`

Expected: `ERR_MODULE_NOT_FOUND` 指向 `src/codex/write-package.js`。

- [ ] **Step 3: 实现构建、验证、staging 与替换**

公开接口固定为：

```js
export function writeCodexContextPack({
  design,
  evidence = {},
  outDir,
  referencePath,
  fullPagePath = null,
  fullPageError = null,
  hostname = '',
  fileOps = defaultFileOps,
}) {}
```

实现顺序：

1. 验证 `design`、`outDir` 和真实存在的 `referencePath`。
2. 构建 verified model 和文本 files。
3. 在 `outDir` 内用 `mkdtempSync(join(outDir, '.codex-context-staging-'))` 创建唯一 staging。
4. 写文本并复制 `reference.png`；有完整截图时复制 `reference-full.png`。
5. 对 staging 中的真实文件调用 `assertValidCodexPackage()`。
6. 若目标不存在，直接 `renameSync(staging, target)`。
7. 若目标存在，先将目标改名为唯一 `.codex-context-backup-<pid>-<timestamp>`，再将 staging 改名为目标。
8. 第二次 rename 失败时恢复 backup；只有成功后才删除 backup。
9. 任意失败都只清理本次创建的精确 staging；绝不递归清理 `outDir` 或模糊匹配目录。
10. 返回 `{ directory, files, warnings, model }`。

- [ ] **Step 4: 将旧公共入口委托给原子 writer**

`src/formatters/codex-context.js` 从 `src/codex/write-package.js` 导入并重新导出 `writeCodexContextPack`，删除直接 `mkdirSync/writeFileSync/copyFileSync` 实现。`src/index.js` 继续从公共入口导出同名函数，同时直接导出新的 writer 只保留一个绑定，避免 ESM 重复导出错误。

- [ ] **Step 5: 模拟切换失败并验证恢复分支**

为 writer 增加可选、仅测试使用的 `fileOps = defaultFileOps` 参数，其中包含 `renameSync` 等精确操作。测试注入一个在 staging → target 时抛错、其他 rename 正常的实现，并断言：旧 `marker.txt` 恢复、target 存在、无 backup/staging 遗留。

Run: `node --test test/codex-package-write.test.js`

Expected: 成功写入、核心失败保留、切换失败恢复三个测试全部通过。

- [ ] **Step 6: 运行 Codex 模块全套测试**

Run: `node --test test/codex-*.test.js`

Expected: 全部通过，且测试临时目录无遗留。

- [ ] **Step 7: 提交本任务**

```bash
git add src/codex/write-package.js test/codex-package-write.test.js src/formatters/codex-context.js src/index.js
git commit -m "feat: write Codex packages atomically"
```

## Task 6: 接入 CLI 生命周期与两种 Codex 模式

**Files:**

- Modify: `bin/nexpage.mjs`
- Create: `test/cli-codex-profile.test.js`
- Modify: `test/codex-context.test.js`

- [ ] **Step 1: 抽出纯模式计划函数并写失败测试**

为了不在单元测试中启动可见浏览器，在 `src/formatters/codex-context.js` 增加：

```js
export function planCodexRun(args) {
  const codexOnly = isCodexProfile(args);
  const withCodex = !codexOnly && isWithCodex(args);
  return {
    codexOnly,
    withCodex,
    wantsCodex: codexOnly || withCodex,
    generateFullOutput: !codexOnly,
  };
}
```

在 `test/cli-codex-profile.test.js` 断言：

```js
test('default mode keeps full output and skips Codex work', () => {
  assert.deepEqual(planCodexRun([]), {
    codexOnly: false, withCodex: false, wantsCodex: false, generateFullOutput: true,
  });
});

test('--profile codex generates only the Codex package', () => {
  assert.deepEqual(planCodexRun(['--profile', 'codex']), {
    codexOnly: true, withCodex: false, wantsCodex: true, generateFullOutput: false,
  });
});

test('--with-codex preserves full output and adds the package', () => {
  assert.deepEqual(planCodexRun(['--with-codex']), {
    codexOnly: false, withCodex: true, wantsCodex: true, generateFullOutput: true,
  });
});

test('--profile codex takes precedence when both flags are supplied', () => {
  assert.deepEqual(planCodexRun(['--profile', 'codex', '--with-codex']), {
    codexOnly: true, withCodex: false, wantsCodex: true, generateFullOutput: false,
  });
});
```

- [ ] **Step 2: 运行失败测试并实现纯模式计划**

Run: `node --test test/cli-codex-profile.test.js`

Expected before implementation: `planCodexRun` export missing。

实现并从 `src/index.js` 导出后再次运行。

Expected after implementation: 4 tests pass。

- [ ] **Step 3: 重排 CLI 页面关闭前的 Codex 工作**

修改 `bin/nexpage.mjs`：

- 导入 `mkdtempSync`、`rmSync`、`tmpdir`、`collectCodexEvidence` 和 `planCodexRun`。
- 用 `const runPlan = planCodexRun(args)` 替代分散条件判断。
- 默认模式继续把视口截图写到 `outDir/page-screenshot.png`。
- `--profile codex` 在系统临时目录创建 `nexpage-codex-capture-*`，把首屏先写为 `reference.png`；不得提前创建最终 `codex-context/`。
- `--with-codex` 可复用 `page-screenshot.png` 作为最终包的 `reference.png` 来源。
- 只有 `runPlan.wantsCodex` 时，在 `extractDesignLanguage()` 完成后、`browser.close()` 前调用 `collectCodexEvidence(page)`，随后尝试 `page.screenshot({ fullPage: true })`。
- full-page 失败时保存 `fullPageError = error.message` 并继续；首屏失败时 writer 必须报核心失败。
- 浏览器关闭后调用新 `writeCodexContextPack({ design, evidence, outDir, referencePath, fullPagePath, fullPageError, hostname })`。
- 使用 `try/finally` 清理本次 capture 临时目录。

- [ ] **Step 4: 明确两类失败语义**

- `--profile codex` 写包失败：打印 `Codex 上下文包生成失败` 与具体 errors，设置 `process.exitCode = 1`，不得打印包生成成功。
- `--with-codex` 写包失败：已经生成的完整输出继续保留；打印单独警告并设置 `process.exitCode = 1`，最终摘要仍显示完整输出路径，不显示不存在的 Codex 路径。
- full-page 降级：包成功，终端逐条打印 writer 返回的 warnings。
- 文件计数使用真实 `codexPack.files.length`；有 motion 与完整截图时为 6，无 motion 或 full-page 降级时按实际数量显示。

- [ ] **Step 5: 添加无浏览器 CLI 静态回归检查**

在 `test/cli-codex-profile.test.js` 读取 `bin/nexpage.mjs` 并断言：

```js
test('CLI collects evidence before closing the browser', () => {
  const source = readFileSync(new URL('../bin/nexpage.mjs', import.meta.url), 'utf8');
  assert.ok(source.indexOf('collectCodexEvidence(page)') < source.indexOf('browser.close()'));
  assert.doesNotMatch(source, /join\(outDir, 'codex-context', 'reference\.png'\)/);
});
```

然后运行：

```bash
node --check bin/nexpage.mjs
node bin/nexpage.mjs --help
node --test test/cli-codex-profile.test.js test/codex-context.test.js
```

Expected: 语法通过；help 显示 `--profile codex` 与 `--with-codex`；全部测试通过且不打开浏览器。

- [ ] **Step 6: 运行全量测试**

Run: `npm test`

Expected: 现有 output-path 测试和全部 Codex 测试通过。

- [ ] **Step 7: 提交本任务**

```bash
git add bin/nexpage.mjs src/formatters/codex-context.js src/index.js test/cli-codex-profile.test.js test/codex-context.test.js
git commit -m "feat: integrate verified Codex packages into the CLI"
```

## Task 7: 文档契约与离线 Greptile 回归

**Files:**

- Modify: `README.md`
- Modify: `project-management/CHANGELOG.md`
- Modify: `project-management/BUGS.md`
- Modify: `project-management/PROJECT.md`
- Create: `test/greptile-codex-regression.test.js`

- [ ] **Step 1: 写 Greptile 离线回归测试**

基于 `greptileEvidence` 和固定 design 构建完整内存包，断言：

```js
test('Greptile regression preserves the verified visual signature', () => {
  const model = buildVerifiedVisualModel(design, greptileEvidence, { fullPageCaptured: true });
  const files = buildVerifiedContextFiles(model);
  const combined = Object.values(files).join('\n');
  assert.doesNotMatch(combined, /\[object Object\]|\{radius\.|\{shadow\./);
  assert.match(files['variables.css'], /#28e99f/);
  assert.match(files['variables.css'], /#3d3b4f/);
  assert.match(files['tokens.json'], /Anybody/);
  assert.match(files['tokens.json'], /DM Sans/);
  assert.match(files['tokens.json'], /Space Mono/);
  assert.match(files['tokens.json'], /polygon\(/);
  assert.match(files['motion.json'], /6000/);
  assert.match(files['motion.json'], /40000/);
  assert.doesNotMatch(files['CODEX.md'], /复制.*(Hero|Testimonials|FAQ)/i);
});
```

Run: `node --test test/greptile-codex-regression.test.js`

Expected: 1 test pass，且不访问网络。

- [ ] **Step 2: 更新 README 的真实使用方式**

在 `README.md` 的 Codex 模式说明中写清：

- `nexpage <url> --profile codex -o <目录>` 只生成 `codex-context/`；
- `nexpage <url> --with-codex -o <目录>` 保留完整导出并附加可信包；
- 用户把整个目录交给 Codex，只需说明“这是我的目标视觉风格”；
- Nexpage 本身不接入 Codex/OpenAI API，不需要 API Key，不产生模型 Token 费用；
- 列出 5/6 文件契约与 full-page 降级语义；
- 明确它迁移视觉语言，不复制来源品牌、内容和信息架构。

- [ ] **Step 3: 更新项目管理记录**

- `CHANGELOG.md`：记录 verified model、关键证据收集、原子验证、双截图和 conditional motion。
- `BUGS.md`：将 `[object Object]`、断裂 radius/shadow 引用、颜色语义错误、动画周期未绑定标记为已修复，并链接对应测试文件名。
- `PROJECT.md`：记录默认完整导出不变、Codex 模式边界和后续非目标（多断点、多页面、AI 运行时）。

不得把未实现的多页面、Figma 自动转换或 AI 页面生成写成已完成能力。

- [ ] **Step 4: 运行文档与全量检查**

```bash
rg -n "\[object Object\]|\{radius\.|\{shadow\." src/codex test
npm test
git diff --check
```

Expected: 第一条只允许命中用于拒绝非法内容的测试字符串，不得命中 formatter 生成逻辑；测试全绿；`git diff --check` 无输出。

- [ ] **Step 5: 提交本任务**

```bash
git add README.md project-management/CHANGELOG.md project-management/BUGS.md project-management/PROJECT.md test/greptile-codex-regression.test.js
git commit -m "docs: define the verified Codex package workflow"
```

## Task 8: 真实网站与下游 Codex 人工验收

**Files:**

- Verify only: repository code and a new temporary output directory

- [ ] **Step 1: 在隔离目录运行真实 Greptile 提取**

先创建专用目录并记录输出路径：

```bash
mktemp -d /tmp/nexpage-greptile-acceptance.XXXXXX
```

然后将返回路径代入：

```bash
node bin/nexpage.mjs https://www.greptile.com/ --profile codex -y -o /tmp/nexpage-greptile-acceptance.XXXXXX
```

Expected: 可见浏览器只启动一次；CLI 只报告 Codex 包；输出根目录除 `codex-context/` 外没有完整导出的 40 多文件。

- [ ] **Step 2: 检查真实文件数量与语法**

将上一步真实路径代入以下命令：

```bash
find /tmp/nexpage-greptile-acceptance.XXXXXX/codex-context -maxdepth 1 -type f -print | sort
rg -n "\[object Object\]|undefined|null|\{radius\.|\{shadow\." /tmp/nexpage-greptile-acceptance.XXXXXX/codex-context
node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1])); JSON.parse(require('node:fs').readFileSync(process.argv[2]));" /tmp/nexpage-greptile-acceptance.XXXXXX/codex-context/tokens.json /tmp/nexpage-greptile-acceptance.XXXXXX/codex-context/motion.json
```

Expected: 正常情况下文件为 5 或 6 个；如果 full-page 明确降级则为 4 或 5 个。非法内容搜索无命中；存在 motion 时 JSON 都能解析。若不存在 motion，只单独解析 `tokens.json`，并确认页面确实没有收集到可靠活动动画。

- [ ] **Step 3: 检查 Greptile 视觉签名**

```bash
rg -n "#28e99f|#3d3b4f|Anybody|DM Sans|Space Mono|polygon|6000|40000" /tmp/nexpage-greptile-acceptance.XXXXXX/codex-context
```

Expected: 绿色主要操作色、紫色 ink/深表面、三种字体、切角和两个长周期均可在结构化文件或 CODEX 规则中找到。使用图像查看器人工对照 `reference.png` 与 `reference-full.png`；若 full-page 降级，终端和 CODEX.md 必须同时出现明确警告。

- [ ] **Step 4: 验证 `--with-codex` 不破坏完整输出**

在第二个隔离目录运行：

```bash
node bin/nexpage.mjs https://www.greptile.com/ --with-codex -y -o /tmp/nexpage-greptile-with-codex.XXXXXX
```

Expected: 原有完整文件仍存在，包括 `result.json`、站点前缀 design tokens、CSS、preview 与 prompts；另有经过验证的 `codex-context/`。

- [ ] **Step 5: 在全新 Codex 任务做零补充提示验收**

把真实生成的 `codex-context/` 作为唯一视觉上下文，只说：

```text
这是我的目标视觉风格。
```

合格标准：

1. Codex 能概括深浅表面、绿色强调、紫色 ink、三类字体、切角和长周期环境动效。
2. Codex 明确不复制 Greptile 品牌、文案和来源页面结构。
3. 未提供产品需求时，Codex 确认已建立视觉基准并等待需求，不直接生成 Greptile 首页。
4. 后续提供不同产品需求时，先建立新产品信息架构，再应用视觉语言。

- [ ] **Step 6: 最终回归与工作区审计**

```bash
npm test
node --check bin/nexpage.mjs
git status --short
git log --oneline -8
```

Expected: 测试全绿、CLI 语法有效；`git status` 仅显示用户原有且与本功能无关的修改，或完全干净；提交历史包含本计划各任务的独立提交。
