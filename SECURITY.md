# Security Policy

## Supported version

项目仍处于 `0.x` 阶段，安全修复只应用到 `main` 和最新发布版本。

## Reporting a vulnerability

请不要为安全漏洞创建公开 Issue。使用 GitHub 仓库的 **Security → Advisories → Report a vulnerability** 私下报告：

https://github.com/anlygale-debug/nexpage-cli/security/advisories/new

请包含：

- 受影响的版本或 Commit；
- 可复现步骤；
- 可能影响；
- 建议修复方式（如有）。

维护者会尽力在 7 天内确认收到报告。项目目前由个人维护，修复时间会根据严重程度和可复现性安排。

## Sensitive extraction data

Nexpage 可以在用户手动登录后读取当前页面。生成的截图和设计包可能包含私有页面内容、用户名、内部产品信息或其他敏感数据。请只处理你有权访问的页面，并在分享输出前自行检查和脱敏。
