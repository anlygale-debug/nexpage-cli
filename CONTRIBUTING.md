# Contributing to Nexpage

感谢你愿意参与 Nexpage。小修复、测试案例、文档改进和提取准确性优化都很欢迎。

## 开始之前

- Bug 和功能建议请先搜索现有 Issues，避免重复。
- 安全漏洞不要公开提交 Issue，请按 [SECURITY.md](SECURITY.md) 私下报告。
- 只提交你有权贡献的代码、截图和测试素材。
- 不要把登录 Cookie、私有网址、API Key 或包含个人信息的提取结果提交到仓库。

## 本地开发

```bash
git clone https://github.com/anlygale-debug/nexpage-cli.git
cd nexpage-cli
npm install
npx playwright install chromium
npm test
```

本地运行 CLI：

```bash
node bin/nexpage.mjs https://example.com --profile codex -o ./nexpage-output/example
```

也可以执行 `npm link` 后直接使用 `nexpage` 命令。

## 代码约定

- 使用 Node.js 20+ 与 ES Modules。
- 优先保持依赖最少；增加依赖时说明必要性。
- 搜索文件与文本优先使用 `rg`。
- 不要提交 `node_modules/`、`dogfood-output/`、`nexpage-output/` 或真实登录数据。
- 用户可见行为变更必须更新 README 和 CHANGELOG。

## 测试要求

```bash
npm test
git diff --check
```

修复提取错误时，请增加一个能复现问题的自动化测试。真实网站会变化，因此测试应尽量验证稳定的公开行为，而不是依赖易变的页面文案或 DOM 细节。

若必须附带截图，请使用你有权公开的最小测试素材；不要直接提交第三方网站的整页截图。

## Pull Request

一个 PR 尽量只解决一个问题，并说明：

1. 问题是什么；
2. 为什么采用这个方案；
3. 如何验证；
4. 是否改变 CLI 输出契约；
5. 是否涉及第三方内容、隐私或访问控制。

提交 PR 即表示你同意按本项目的 MIT License 授权你的贡献。
