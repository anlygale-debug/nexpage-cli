# nexpage — 项目管理文档

## 项目概述

nexpage 是一个从任意网站提取设计系统的命令行工具。核心能力：

- 可见浏览器打开目标网站 → 用户登录/导航 → 提取设计 Token
- 完全独立的 CLI 工具，仅保留 Playwright 运行依赖
- Fork from designlang v12.21.0，精简为核心提取链路
- 所有品牌标识已替换为 nexpage

**当前版本**：0.1.0（`main` 含下一版本的未发布改进）

## 技术架构

```
nexpage-cli/
  bin/nexpage.mjs          CLI 入口
  src/
    crawler.js             浏览器引擎（支持 existingPage）
    index.js               提取编排 + 所有导出
    codex/                 证据采集、截图准备、模型、格式化与校验
    extractors/            40+ 分析模块
    formatters/            40+ 输出格式器
    utils.js               工具函数
    utils-cookies.js       Cookie 处理
    widgets.js             第三方 widget 忽略列表
  project-management/      项目管理文档
```

## 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| playwright | ^1.42 | 浏览器引擎（visible + headless） |
| Node.js | ≥20 | 运行时 |

## 核心功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 可见浏览器提取 | ✅ 0.1.0 | Playwright headless:false + existingPage |
| 页面截图 | ✅ 0.1.0 | 提取前自动截取当前页面 |
| 质量检测 | ✅ 0.1.0 | 标题可疑/元素过少/无字体 三条检测 |
| 交互式确认 | ✅ 0.1.0 | 按 Enter 确认，-y 跳过 |
| 品牌替换 | ✅ 0.1.0 | 所有输出文件显示 nexpage |
| Cookie 传递 | ✅ 0.1.0 | 可见浏览器登录态自动保留 |
| 一键提取 | ✅ 0.1.0 | -y 跳过确认直接提取 |
| Codex 可信包 | ✅ Unreleased | `--profile codex` 只生成 `codex-context/`；`--with-codex` 保留默认完整导出并附加可信包 |

## Codex 可信包契约

- 默认完整导出保持不变；只有显式传入 `--profile codex` 才只输出 `codex-context/`。
- `codex-context/` 始终含 `reference.png`、`CODEX.md`、`tokens.json`、`variables.css`、严格设计规则、组件规则、执行说明、防跑偏规则和验收清单；完整页面截图成功时含 `reference-full.png`，有效动效存在时含 `motion.json`。
- 因此正常完整页面包为 10/11 个文件；完整页面截图失败时降级为首屏覆盖的 9/10 个文件，并明确标示覆盖范围。
- 包用于迁移视觉语言，不复制来源品牌、内容或信息架构；用户把整个输出目录交给 Codex 后，可用“这是我的目标视觉风格”作为最小说明。
- nexpage 不调用 Codex/OpenAI API，不需要 API Key，也不产生模型 Token 费用。
- 自动语义标签与截图冲突时，下游 Codex 必须用视觉能力查看截图并重新映射角色；Token 继续提供精确数值。

## 输出文件清单（40 个）

| 类别 | 文件数 | 内容 |
|------|--------|------|
| 设计 Token 文件 | 12 | DTCG / CSS Variables / Tailwind v3+v4 / TS / Reset / shadcn / Gradients / Figma |
| 设计语言 & 预览 | 5 | Markdown / Preview HTML / Brand HTML / AGENT.md / DESIGN.md |
| 动效 | 6 | Lab + Framer Motion / GSAP / Motion One / WAAPI / CSS |
| 框架 & 平台 | 4 | React / Vue / Svelte / WordPress |
| AI Prompts | 4 | v0 / Lovable / Cursor / Claude Artifacts |
| 数据文件 | 9 | Voice / Intent / Visual DNA / Library / SEO / Icons / Stack / Forms / MCP |

## 当前限制

- 仅支持单个 URL，不支持多页面爬取
- 不支持暗色模式提取
- 不支持响应式断点截图
- 不支持 Component Screenshot（保留了 extractor 但未集成到 CLI）
- `extractDesignLanguage` 的 `url` 参数在 existingPage 路径下仅用于元数据记录（页面已加载）

## 非目标（当前未实现）

- 多断点或响应式视觉采集
- 多页面抓取、整站信息架构迁移
- Figma 自动转换
- AI 运行时、模型调用或自动生成新页面

## 文档索引

| 文档 | 用途 | 维护方式 |
|------|------|----------|
| [PROJECT.md](PROJECT.md) | 项目总览（当前文档） | 版本发布时更新 |
| [CHANGELOG.md](CHANGELOG.md) | 版本更新记录 | 每个版本新增一条 |
| [IDEAS.md](IDEAS.md) | 功能想法 & 需求池 | 有新想法就加，实现后标记 |
| [BUGS.md](BUGS.md) | Bug 追踪 | 发现 Bug 就加，修复后标记 |
| [../README.md](../README.md) | 用户文档 | 功能变更时更新 |

## 工作流程

```
新想法 → IDEAS.md
  ↓ 确认要做
CHANGELOG.md（下一个版本新增条目）
  ↓ 实现 + 测试
版本发布 + 更新 PROJECT.md + 更新 README.md

Bug 发现 → BUGS.md
  ↓ 修复
CHANGELOG.md（标记已修复）+ BUGS.md（标记已修复）
```

## 下一步计划

详见 [IDEAS.md](IDEAS.md) 和 [CHANGELOG.md](CHANGELOG.md)
