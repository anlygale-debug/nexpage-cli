# nexpage

从任意网站提取设计系统的命令行工具。用可见浏览器打开目标网站，你可以登录、导航到任意页面，然后一键提取完整的色彩、排版、间距、动效等设计 Token。

**和 designlang 的区别**：designlang 用 headless 浏览器，遇到需要登录或人机验证的网站无能为力。nexpage 先弹出一个可见的 Chromium 窗口让你手动操作，确认后再从当前页面提取，不存在任何反爬限制。

## 安装

```bash
cd nexpage-cli && npm link
```

前置依赖：

- Node.js ≥ 20
- designlang（全局安装）：`npm i -g designlang`
- Playwright Chromium：`npx playwright install chromium`

## 使用

```bash
nexpage <url> [选项]
```

### 选项

| 选项 | 说明 |
|------|------|
| `-o, --out <dir>` | 输出目录（默认：`./nexpage-output/`） |
| `-y, --yes` | 跳过"按 Enter 确认"，打开浏览器后直接提取 |
| `-h, --help` | 显示帮助 |

### 示例

```bash
# 基本用法：交互式提取
nexpage https://stripe.com

# 浏览器打开后 → 登录/导航 → 回到终端按 Enter → 提取开始
```

```bash
# 自动提取（不适合需要登录的网站）
nexpage example.com -y
```

```bash
# 指定输出目录
nexpage https://uiverse.io/elements -o ~/Desktop/uiverse-ds
```

## 工作流程

```
nexpage <url>
  │
  ├─ 1. 打开可见 Chromium 窗口
  │
  ├─ 2. 等待你在窗口中操作（登录、跳转、筛选）
  │    按 Enter 继续...
  │
  ├─ 3. 截取当前页面截图
  │
  ├─ 4. 从当前页面提取设计系统（复用浏览器窗口，不需要 headless）
  │
  ├─ 5. 生成 40 个输出文件
  │    设计 Token / 设计语言 / 动效 / 框架主题 / AI Prompts / 数据文件
  │
  └─ 6. 打印摘要
```

## 输出文件

每次提取生成约 40 个文件，按类别组织：

```
nexpage-output/<域名>/
  ├── page-screenshot.png          # 提取时的页面截图
  ├── result.json                  # 完整的结构化数据
  │
  ├── 设计 Token 文件 (9)
  │   ├── <域名>-design-tokens.json    W3C DTCG v1
  │   ├── <域名>-variables.css         CSS 变量
  │   ├── <域名>-tailwind.config.js    Tailwind v3
  │   ├── <域名>-tailwind-v4.css       Tailwind v4 @theme
  │   ├── <域名>-tokens.d.ts           TypeScript 类型
  │   ├── <域名>-reset.css             CSS Reset
  │   ├── <域名>-shadcn-theme.css      shadcn/ui 主题
  │   ├── <域名>-gradients.css|json    渐变色
  │   └── <域名>-figma-variables.json  Figma Variables
  │
  ├── 设计语言 & 预览 (5)
  │   ├── <域名>-design-language.md    给 AI agent 用
  │   ├── <域名>-preview.html          视觉预览
  │   ├── <域名>.brand.html            品牌书
  │   ├── <域名>-AGENT.md              Agent 系统提示
  │   └── <域名>-DESIGN.md             Agent 原生格式
  │
  ├── 动效 (6)
  │   ├── <域名>-motion.html           动效实验室
  │   ├── <域名>-motion.css            CSS Motion
  │   ├── <域名>-motion.framer.js      Framer Motion
  │   ├── <域名>-motion.gsap.js        GSAP
  │   ├── <域名>-motion.one.js         Motion One
  │   └── <域名>-motion.waapi.js       Web Animations API
  │
  ├── 框架 & 平台 (4)
  │   ├── <域名>-theme.js              React
  │   ├── <域名>-vue-theme.js          Vue
  │   ├── <域名>-svelte-theme.css      Svelte
  │   └── <域名>-wordpress-theme.json  WordPress
  │
  ├── AI Prompts (4)
  │   └── <域名>-prompts/
  │       ├── v0.txt
  │       ├── lovable.txt
  │       ├── cursor.md
  │       └── claude-artifacts.md
  │
  └── 数据文件 (9)
      ├── <域名>-voice.json
      ├── <域名>-intent.json
      ├── <域名>-visual-dna.json
      ├── <域名>-library.json
      ├── <域名>-seo.json
      ├── <域名>-icon-system.json
      ├── <域名>-stack-intel.json
      ├── <域名>-form-states.json
      └── <域名>-mcp.json
```

## 提取结果验证

每次提取完成后，终端会显示摘要，帮助你快速判断结果是否可信：

```
══════════════════════════════════════
stripe-com
Stripe - Financial Infrastructure
──────────────────────────────────────
● 评分  A · 92/100
● 主色  #635BFF
● 字体  Soehne, Soehne Mono
● 颜色  25 种
● DOM 元素  2847
● 文件  40 个
──────────────────────────────────────
✓ 已保存到 ./nexpage-output/
```

如果检测到异常（验证页、元素过少、无自定义字体），会显示警告。

## 技术原理

nexpage 对 designlang 的 `crawlPage` 函数做了一个轻量修改：新增 `existingPage` 参数。当传入已打开的 Playwright Page 对象时，跳过浏览器启动，直接在该 Page 上执行 DOM 数据提取和分析。其余全部透传给 designlang，不修改任何提取器或格式化器逻辑。

## 许可

MIT
