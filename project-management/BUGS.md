# nexpage CLI · Bug 追踪

## 格式说明

每个 Bug 标注：发现日期、严重程度（阻塞/功能缺失/轻微）、状态（待修复/已修复）、修复版本

---

## 待修复

（暂无）

---

## 已修复

| Bug | 状态 | 回归测试 |
|-----|------|----------|
| 机器文件出现 `[object Object]` | ✅ 已修复 | `test/codex-format.test.js`、`test/greptile-codex-regression.test.js` |
| radius/shadow 的断裂 Token 引用（如 `{radius.*}`、`{shadow.*}`） | ✅ 已修复 | `test/codex-format.test.js`、`test/greptile-codex-regression.test.js` |
| 把低证据颜色或浏览器默认色误写成颜色语义 | ✅ 已修复 | `test/codex-model.test.js`、`test/codex-format.test.js` |
| 动画周期未与真实选择器目标绑定 | ✅ 已修复 | `test/codex-model.test.js`、`test/codex-format.test.js`、`test/greptile-codex-regression.test.js` |

---

## 历史 Bug

以下 Bug 发生在 NEXPAGE Web 项目，其根因和修复推动了 nexpage CLI 的设计决策：

| # | Bug | 严重程度 | 状态 | 对 CLI 的影响 |
|---|-----|----------|------|---------------|
| 1 | Turbopack 无法解析 designlang import | 阻塞 | ✅ 已修复 | CLI 独立进程不受影响 |
| 6 | npm unlink 后 runner 找不到 designlang | 阻塞 | ✅ 已修复 | CLI Fork 后零依赖，彻底规避 |
| 8 | headless Chrome 被 Cloudflare 拦截 | 阻塞 | ✅ 已修复 | CLI 默认 visible browser |
| 8e | 进程通信层 id 冲突导致响应丢失 | 阻塞 | ✅ 已修复 | CLI 无跨进程通信 |

> 详细记录见 `designlang-ui/BUGFIX.md`
