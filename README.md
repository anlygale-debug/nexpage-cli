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

| 选项                | 说明                                      |
| ------------------- | ----------------------------------------- |
| `-o, --out <dir>` | 输出目录（默认：`./nexpage-output/`）   |
| `--pick-output`   | 用 Finder 选择父文件夹并创建防覆盖结果目录 |
| `-y, --yes`       | 跳过"按 Enter 确认"，打开浏览器后直接提取 |
| `--profile codex` | 只生成 Codex 精简上下文包                 |
| `--with-codex`    | 在完整结果旁额外生成 Codex 精简上下文包      |
| `-h, --help`      | 显示帮助                                  |

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

```bash
# 用 Finder 选择保存位置；自动创建“时间＋域名”子目录
nexpage https://uiverse.io/elements --pick-output
```

```bash
# Finder 选目录，只生成专供 Codex 使用的精简上下文
nexpage https://stripe.com --pick-output --profile codex
```

```bash
# 生成原有完整结果，并额外附带 Codex 精简上下文
nexpage https://stripe.com --with-codex
```

### 保存位置

`-o/--out` 会把你提供的路径当作最终输出目录，兼容原有用法，并支持 `~`：

```bash
nexpage https://example.com -o "~/Desktop/My UI Research"
```

`--pick-output` 会弹出 macOS Finder 文件夹选择器。选择父文件夹后，nexpage 会自动创建独立目录：

```text
你选择的文件夹/
└── 2026-07-19-1430-example-com/
```

如果同一分钟内重复提取，会自动追加 `-2`、`-3`，不会覆盖上一份结果。`--out` 和 `--pick-output` 不能同时使用；漏写 `-o/--out` 的路径时会立即提示错误。

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

## Codex Profile

传入 `--profile codex` 后，只生成：

```text
codex-context/
  ├── reference.png    # 当前视口视觉参考
  ├── CODEX.md         # 为 Codex 清洗、校验后的设计上下文与实现规则
  ├── tokens.json      # 结构化设计 Token
  ├── variables.css    # 可直接接入项目的 CSS Variables
  └── motion.json      # 仅在检测到有效动效时生成
```

让 Codex 开发新页面时，只需把 `codex-context/` 目录作为视觉上下文，不需要加载全量输出。

如果需要保留原有 40 多个完整文件并同时生成上述目录，请改用 `--with-codex`。

`CODEX.md` 会明确区分“提取事实”和“启发式推断”，并进行以下质量处理：

- 低使用次数或浏览器默认色不会被写成强制品牌色
- CTA、组件变体和断点会被安全格式化，不输出 `[object Object]`
- 标题字号不会直接被误标为正文 Token
- 重复 CSS Variable 名称会自动添加序号
- 未使用的 Keyframe 和空滚动信号不会生成 `motion.json`
- 截图与自动推断冲突时，明确要求 Codex 以截图和产品需求为准

推荐提示词：

```text
请先读取 codex-context/CODEX.md，并按其中的“使用顺序”查看其余文件。
为我的产品开发一个新页面：继承参考网站的视觉语言，但不要复制其品牌、Logo、文案和产品信息。
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

nexpage 从 designlang v12.21.0 Fork，保留完整的 40+ 提取器和 40+ 格式化器，精简了 CI/同步/监控等非提取模块。核心改动：

- `crawler.js`：新增 `existingPage` 参数，可直接复用外部打开的浏览器 Page 对象
- 所有输出文件品牌标识从 designlang 替换为 nexpage
- 仅依赖 playwright，不依赖任何外部 npm 包

## 项目管理

版本记录、功能规划、Bug 追踪见 `project-management/` 目录：

- [PROJECT.md](project-management/PROJECT.md) — 项目总览
- [CHANGELOG.md](project-management/CHANGELOG.md) — 版本更新日志
- [IDEAS.md](project-management/IDEAS.md) — 功能想法 & 需求池
- [BUGS.md](project-management/BUGS.md) — Bug 追踪

## 许可

MIT
