# Nexpage

[![CI](https://github.com/anlygale-debug/nexpage-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/anlygale-debug/nexpage-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933.svg)](https://nodejs.org/)

English · [简体中文](README.md)

Nexpage is a local CLI that extracts a website's rendered visual language. It opens a visible Chromium window so you can log in or navigate when necessary, then collects colors, typography, spacing, shapes, surfaces, motion, and design tokens from the page you actually see.

It can also generate a verified `codex-context/` package for vision-capable coding agents: source evidence provides exact values, screenshots provide visual meaning, and the agent arbitrates conflicts between them.

> Status: early `0.x`. Nexpage has automated tests and multi-site dogfood coverage, but complex Canvas/WebGL pages, aggressive automation defenses, and unusual login flows may still fail.

## Highlights

- Visible, interactive Chromium extraction
- Reuses the same authenticated Playwright page
- 40+ full export artifacts, including DTCG, CSS variables, Tailwind, and Figma variables
- `--profile codex` for a focused, validated Codex visual package
- `--with-codex` to add the Codex package to the full export
- Viewport and scroll-stitched full-page visual references
- Common cookie, privacy, location, and login overlay cleanup
- Navigation retry and degraded continuation for already-rendered pages
- Atomic Codex package validation and replacement
- No model API, API key, account, or token cost

Nexpage does not bypass CAPTCHAs, access controls, or website security. Only process pages you are authorized to access and follow the target site's terms.

## Requirements

- Node.js 20+
- npm
- Playwright Chromium
- macOS, Linux, or Windows; `--pick-output` uses macOS Finder only

## Install from source

```bash
git clone https://github.com/anlygale-debug/nexpage-cli.git
cd nexpage-cli
npm install
npx playwright install chromium
npm link
```

Nexpage is a standalone fork. You do not need to install designlang separately.

## Quick start

Interactive extraction:

```bash
nexpage https://stripe.com
```

Generate only the Codex package:

```bash
nexpage https://stripe.com --profile codex -o ./nexpage-output/stripe
```

Generate the full export and add the Codex package:

```bash
nexpage https://stripe.com --with-codex -o ./nexpage-output/stripe
```

Skip the Enter confirmation when no manual interaction is needed:

```bash
nexpage https://example.com -y
```

## CLI options

| Option | Description |
|---|---|
| `-o, --out <dir>` | Exact output directory; defaults to `./nexpage-output/` |
| `--pick-output` | Choose a parent directory with macOS Finder and create a collision-safe run folder |
| `-y, --yes` | Skip Enter confirmation and extract immediately after opening |
| `--profile codex` | Generate only `codex-context/` |
| `--with-codex` | Keep the full export and add `codex-context/` |
| `-h, --help` | Show help |

## Codex visual package

A normal full-page capture contains 10 files, or 11 when meaningful motion is detected:

```text
codex-context/
├── CODEX.md
├── codex-instructions.md
├── design-strict.md
├── components.md
├── STYLE-GUARDRAILS.md
├── acceptance-checklist.md
├── tokens.json
├── variables.css
├── reference.png
├── reference-full.png
└── motion.json              # optional
```

Give the entire directory to Codex together with your own product requirements. `CODEX.md` requires the agent to inspect the screenshots before implementation. If an automatic role such as `actionPrimary`, `surface`, or `ink` conflicts with the image, the screenshot determines the semantic role while matching source tokens provide exact values.

This lets downstream Codex use its existing visual capability without Nexpage calling a model API.

## Privacy and responsible use

- Browsing and extraction run locally. Nexpage does not upload pages, cookies, or screenshots.
- Generated screenshots and files may contain private page content, personal data, or copyrighted assets. Review and sanitize them before sharing.
- Do not use Nexpage to bypass CAPTCHAs, paywalls, permissions, or security controls.
- Transfer visual language, not the source site's trademarks, logos, copy, proprietary illustrations, or full information architecture.
- Nexpage's MIT license does not grant rights to third-party website content.

## Known limitations

- Single-page extraction, not a whole-site crawler
- Semantic roles may still be wrong on transparent, gradient, image-backed, or non-standard controls
- Canvas, WebGL, video, and interaction-only states may be incomplete
- Some sites block automated Chromium even when it is visible
- Full-page references are stitched from real viewports and can contain small seams
- Responsive and permission-specific states require separate validation

## Development

```bash
npm install
npx playwright install chromium
npm test
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

See [docs/architecture.md](docs/architecture.md) for the extraction and Codex package pipeline.

## Origin and license

Nexpage is a fork of the MIT-licensed [designlang 12.21.0](https://www.npmjs.com/package/designlang), with independent work on the visible-browser workflow, interactive extraction, verified Codex package, capture stability, semantic evidence model, and package validation.

Released under the [MIT License](LICENSE). See [NOTICE](NOTICE) for upstream attribution. Third-party website content remains subject to its owners' rights and terms.
