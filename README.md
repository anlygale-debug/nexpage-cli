# Nexpage

[![CI](https://github.com/anlygale-debug/nexpage-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/anlygale-debug/nexpage-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933.svg)](https://nodejs.org/)

[English](README.en.md) · 简体中文

Nexpage 是一个本地运行的网页视觉语言提取 CLI。它打开一个可见的 Chromium 窗口，让你在需要时手动登录或导航，然后从当前实际渲染页面提取颜色、排版、间距、形状、材质、动效和设计 Token。

它还可以生成专门交给 Codex 等视觉 Agent 使用的 `codex-context/`：源码负责精确测量，截图负责视觉语义，Agent 在两者冲突时进行视觉裁决。

> 项目状态：早期 `0.x` 版本。已经过自动化测试和多站点真实回归，但复杂 Canvas、WebGL、强反自动化页面和特殊登录流程仍可能失败。

## 为什么做 Nexpage

普通无头抓取在登录页、地区选择、延迟加载和复杂前端页面上经常拿不到用户真正看到的状态。Nexpage 使用可见浏览器：

- 你可以在提取前手动登录、关闭提示或进入目标页面；
- 提取器复用同一个浏览器 Page，不重新打开无头页面；
- Codex 模式会清理常见临时弹层、滚动预热懒加载内容并生成长页参考图；
- 不内置 OpenAI、Codex 或其他模型 API，不需要 API Key，也不会产生模型调用费用。

Nexpage 不绕过验证码、访问控制或网站安全措施。网站仍可阻止自动化浏览器，请遵守目标网站条款并只处理你有权访问的内容。

## 功能

- 可见 Chromium 交互式提取
- 颜色、排版、间距、阴影、边框、渐变、动效和组件证据
- W3C DTCG、CSS Variables、Tailwind、Figma Variables 等 40+ 完整输出
- `--profile codex`：只生成经过校验的 Codex 视觉包
- `--with-codex`：完整输出旁附加 Codex 视觉包
- 首屏截图与滚动拼接长页截图
- 常见 Cookie、隐私、地区和登录弹层清理
- 导航超时重试与已渲染页面降级继续
- Codex 包暂存、完整性校验和原子替换
- macOS Finder 输出目录选择与防覆盖命名

## 环境要求

- Node.js 20 或更高版本
- npm
- Playwright Chromium
- macOS、Linux 或 Windows；`--pick-output` 仅支持 macOS Finder

## 安装

当前推荐从源码安装：

```bash
git clone https://github.com/anlygale-debug/nexpage-cli.git
cd nexpage-cli
npm install
npx playwright install chromium
npm link
```

确认安装：

```bash
nexpage --help
```

Nexpage 是独立 Fork，不需要另外安装 designlang。

## 快速开始

交互式提取：

```bash
nexpage https://stripe.com
```

浏览器打开后，你可以登录或导航到目标状态。回到终端按 Enter 后开始提取。

只生成 Codex 视觉包：

```bash
nexpage https://stripe.com --profile codex -o ./nexpage-output/stripe
```

完整输出并附加 Codex 视觉包：

```bash
nexpage https://stripe.com --with-codex -o ./nexpage-output/stripe
```

页面不需要手动操作时，可以跳过确认：

```bash
nexpage https://example.com -y
```

## CLI 选项

| 选项 | 说明 |
|---|---|
| `-o, --out <dir>` | 指定最终输出目录，默认 `./nexpage-output/` |
| `--pick-output` | 用 macOS Finder 选择父目录并创建防覆盖子目录 |
| `-y, --yes` | 跳过 Enter 确认，页面打开后直接提取 |
| `--profile codex` | 只生成 `codex-context/` |
| `--with-codex` | 保留完整输出并附加 `codex-context/` |
| `-h, --help` | 显示帮助 |

`--out` 把提供的路径当作最终输出目录，并支持带引号的 `~`：

```bash
nexpage https://example.com -o "~/Desktop/My UI Research"
```

`--pick-output` 会在所选父目录内创建 `日期时间-域名` 子目录；同名时自动追加数字，不覆盖旧结果。它不能和 `--out` 同时使用。

## Codex 视觉包

正常完整页面采集会生成 10 个文件；检测到有效动效时为 11 个：

```text
codex-context/
├── CODEX.md                  # 第一入口、证据边界与视觉冲突裁决
├── codex-instructions.md     # Agent 阅读顺序和执行流程
├── design-strict.md          # 严格视觉锚点与硬性失败条件
├── components.md             # 按钮、卡片、表面和状态规则
├── STYLE-GUARDRAILS.md       # 防模板化与防跑偏规则
├── acceptance-checklist.md   # 实现后的视觉验收清单
├── tokens.json               # 结构化精确 Token
├── variables.css             # 可直接使用的 CSS Variables
├── reference.png             # 当前视口视觉参考
├── reference-full.png        # 滚动加载后的长页视觉参考
└── motion.json               # 可选，仅在存在有效动效时生成
```

完整页截图失败时不生成 `reference-full.png`，视觉包会明确声明只能证明首屏范围。

### 交给 Codex 使用

把整个 `codex-context/` 目录和你的产品需求一起交给 Codex，例如：

```text
请先读取 codex-context/CODEX.md，并按其中顺序查看其余文件和两张截图。
为我的产品设计并实现一个新页面：继承这里的视觉语言，但不要复制来源品牌、Logo、文案、插画和信息架构。
```

自动提取的 `actionPrimary`、`surface`、`ink` 等语义角色可能误判或缺失。视觉包会要求 Codex：

1. 必须实际查看参考截图；
2. 用截图判断“哪个元素是什么角色”；
3. 用 Token/CSS 获取匹配元素的精确数值；
4. 冲突时按截图重新映射角色，不盲从自动标签；
5. 在完成报告中说明无法确认和人工补全的部分。

这样可以利用下游 Codex 已有的视觉能力纠错，而不要求 Nexpage 自己调用模型 API。

## 完整输出

默认模式会生成 40+ 文件，主要包括：

- DTCG Token、CSS Variables、Tailwind v3/v4、shadcn 主题和 Figma Variables；
- 设计语言 Markdown、预览页、品牌书、Agent 提示和 DESIGN.md；
- CSS、Framer Motion、GSAP、Motion One 和 WAAPI 动效输出；
- React、Vue、Svelte 和 WordPress 主题；
- 语气、页面意图、视觉 DNA、组件库、SEO、图标、技术栈和表单状态数据。

完整清单会随功能演进，生成目录中的文件是最终事实。

## 隐私、版权与合理使用

- 浏览器和提取过程在本地运行；Nexpage 不上传页面、Cookie 或截图。
- 登录只在本次临时浏览器上下文中使用，不要把生成结果当作安全存储。
- 截图和输出可能包含用户名、内部页面、个人信息或第三方版权内容；分享前必须检查和脱敏。
- 只提取你有权访问和使用的页面，不要绕过验证码、付费墙、权限控制或网站安全机制。
- 视觉语言可以用于灵感和主题迁移，但不要复制来源商标、Logo、文案、专有插画或完整产品信息架构。
- 本项目的 MIT License 不会自动授予你使用第三方网站内容和资产的权利。

## 已知限制

- 当前主要面向单个 URL，不是整站爬虫；
- 自动语义角色仍可能在透明按钮、渐变、图片背景或非标准 DOM 上判断错误；
- Canvas、WebGL、视频和必须交互后才出现的状态无法保证完整提取；
- 某些网站会检测或阻止自动化 Chromium；可见浏览器不代表能够绕过验证；
- 长页参考图由多个实际视口拼接，可能出现细小接缝，不是像素级页面存档；
- 移动端和登录后不同权限状态需要分别验证。

## 开发与贡献

```bash
npm install
npx playwright install chromium
npm test
```

提交贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全漏洞请按 [SECURITY.md](SECURITY.md) 私下报告。

项目结构见 [docs/architecture.md](docs/architecture.md)，技术决策见 [project-management/PROJECT.md](project-management/PROJECT.md)，版本记录见 [project-management/CHANGELOG.md](project-management/CHANGELOG.md)。

## 来源与许可

Nexpage 基于 [designlang 12.21.0](https://www.npmjs.com/package/designlang) 的 MIT 源码 Fork，并在可见浏览器工作流、交互式提取、Codex 可信视觉包、截图稳定性、语义证据模型和包校验方面进行了独立修改。

项目按 [MIT License](LICENSE) 开源。原作者版权声明和 Fork 说明见 [NOTICE](NOTICE)。处理第三方网页时仍需遵守相应网站的条款、版权和隐私要求。
