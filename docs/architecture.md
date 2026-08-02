# Nexpage Architecture

本文面向希望理解或贡献 Nexpage 的开发者。

## 主流程

```text
CLI 参数
  ↓
启动可见 Chromium
  ↓
用户可选登录 / 导航 / 确认
  ↓
页面准备（Codex 模式）
  ├─ 清理临时弹层
  └─ 滚动预热懒加载内容
  ↓
采集当前渲染页面
  ├─ 通用设计提取器
  ├─ Codex 语义证据
  └─ 首屏 / 长页截图
  ↓
构建设计模型
  ↓
格式化输出
  ↓
Codex 包校验、暂存和原子替换
```

## 主要模块

| 路径 | 职责 |
|---|---|
| `bin/nexpage.mjs` | CLI 参数、浏览器生命周期和输出编排 |
| `src/crawler.js` | 通用页面采集；支持复用已经打开的 Page |
| `src/extractors/` | 颜色、排版、布局、组件、动效、可访问性等证据 |
| `src/formatters/` | DTCG、CSS、Tailwind、框架主题和 Agent 文件 |
| `src/codex/collect-evidence.js` | 从可见渲染元素采集 Codex 专用证据 |
| `src/codex/prepare-capture.js` | 弹层清理、懒加载预热和长页拼接 |
| `src/codex/navigate.js` | 导航重试与已渲染页面降级判断 |
| `src/codex/verified-model.js` | 将证据分为已验证规则、候选和拒绝项 |
| `src/codex/format-context.js` | 生成 Codex 执行文档与机器 Token |
| `src/codex/validate-package.js` | 校验文件、Token 引用、CSS 和文档契约 |
| `src/codex/write-package.js` | 暂存、验证、备份恢复和原子替换 |

## 证据原则

Nexpage 将“数值是否真实”和“视觉角色是否正确”分开处理：

- 浏览器渲染和 CSS 用于获得精确数值；
- 重复、位置、面积和作用域用于自动推断语义；
- 自动语义可能出错，因此 Codex 包强制要求视觉 Agent 查看截图；
- 截图判断角色，匹配的 Token 提供精确实现值；
- 低证据值保留为候选，不自动提升为硬性规范。

## 测试边界

测试使用 Node.js 内置 test runner，通过公共接口验证：

- CLI 模式和错误处理；
- 证据采集与视觉模型；
- Codex 文件格式与包契约；
- 包校验、写入和失败恢复；
- 浏览器导航、弹层清理和滚动截图。

真实网页只用于 dogfood，不应作为稳定 CI Fixture，因为其 DOM、文案和防自动化策略会随时变化。
