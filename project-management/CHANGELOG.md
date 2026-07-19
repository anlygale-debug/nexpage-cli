# nexpage 版本更新日志

## [Unreleased]

### 输出目录体验

- 新增 `--pick-output`，通过 macOS Finder 选择结果保存位置
- Finder 模式自动创建“日期时间＋域名”子目录
- 同名目录自动追加数字后缀，避免覆盖历史结果
- `-o/--out` 支持带引号的 `~` 路径展开，同时保持原有精确目录语义
- `-o/--out` 缺少路径、或与 `--pick-output` 冲突时立即显示明确错误

### Codex Profile

- 新增 `--profile codex`，保持原有全量输出不变
- 新增独立的 `codex-context/`，只包含 Codex 开发新页面所需的精简上下文
- 新增已验证视觉模型：只把有重复、渲染证据支撑的颜色、排版、形状、材质和动效提升为规则
- 新增关键证据采集：按页面可见元素、组件表面和已运行动画收集，而非只依赖原始频率统计
- Codex 包采用暂存、校验和原子替换；核心文件或截图不完整时不会覆盖上一份有效包
- 正常包同时保存首屏与完整页面两张截图；完整页面截图失败时降级为首屏覆盖并记录限制
- `motion.json` 改为条件生成，只输出已绑定真实目标和时长的有效动效
- 新增离线 Greptile 视觉签名回归：`test/greptile-codex-regression.test.js`
- 新增高质量 `CODEX.md`：视觉方向、颜色、排版、布局、组件、页面结构、语气、动效、实现规则和可信度说明
- 低证据主色与浏览器默认色自动降级为候选，不再写成硬性规则
- Codex 专用 `tokens.json` 使用正文型排版样本，避免把最大标题字号当成正文
- Codex 专用 `variables.css` 保证自定义属性名称唯一
- `motion.json` 仅在存在有效时长、缓动、弹性、已使用 Keyframe 或真实滚动信号时生成
- 新增 Node 内置测试套件，覆盖 Codex 上下文质量和输出清单

## [0.1.0] — 2026-07-14

### 初始版本

从 designlang v12.21.0 Fork，精简为核心提取链路，建立 nexpage 品牌。

**新增功能**
- 可见浏览器交互式提取：Playwright headless:false，用户可登录后提取
- existingPage 参数：复用已打开的浏览器 Page 对象，避免 headless 反爬
- 页面截图：提取前自动截取 PNG 保存
- 质量检测：标题可疑、元素过少、无自定义字体三条规则
- -y 参数：跳过交互式确认，直接提取
- -o 参数：指定输出目录
- 品牌化输出：所有生成文件显示 nexpage（0 处 designlang 残留）
- 终端摘要：评分、主色、字体、颜色数、文件数、警告

**技术决策**
- 选择完整 Fork 而非轻量包装，确保完全独立、随意修改
- 裁剪非提取模块（ci/sync/watch/clone/studio/mcp 等 30+ 文件）
- Playwright 使用全局已安装版本（复用 Chromium，避免重复下载）

**已知限制**
- 仅提取单页面，不支持多页面爬取
- 不生成暗色模式 token
- 不生成响应式截图
- Component Screenshot 代码存在但未连接到 CLI

**变更文件**
- 新建：`bin/nexpage.mjs`、`src/*`（273 files）、`package.json`、`README.md`
