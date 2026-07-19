import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { planCodexRun } from '../src/index.js';

test('default mode keeps full output and skips Codex work', () => {
  assert.deepEqual(planCodexRun([]), {
    codexOnly: false,
    withCodex: false,
    wantsCodex: false,
    generateFullOutput: true,
  });
});

test('--profile codex generates only the Codex package', () => {
  assert.deepEqual(planCodexRun(['--profile', 'codex']), {
    codexOnly: true,
    withCodex: false,
    wantsCodex: true,
    generateFullOutput: false,
  });
});

test('--with-codex preserves full output and adds the package', () => {
  assert.deepEqual(planCodexRun(['--with-codex']), {
    codexOnly: false,
    withCodex: true,
    wantsCodex: true,
    generateFullOutput: true,
  });
});

test('--profile codex takes precedence when both flags are supplied', () => {
  assert.deepEqual(planCodexRun(['--profile', 'codex', '--with-codex']), {
    codexOnly: true,
    withCodex: false,
    wantsCodex: true,
    generateFullOutput: false,
  });
});

test('CLI collects evidence before closing the browser', () => {
  const source = readFileSync(new URL('../bin/nexpage.mjs', import.meta.url), 'utf8');
  assert.ok(source.indexOf('collectCodexEvidence(page)') < source.indexOf('browser.close()'));
  assert.doesNotMatch(source, /join\(outDir, 'codex-context', 'reference\.png'\)/);
});

test('CLI stages Codex captures outside the final output package and always cleans them', () => {
  const source = readFileSync(new URL('../bin/nexpage.mjs', import.meta.url), 'utf8');
  assert.match(source, /mkdtempSync\(join\(tmpdir\(\), 'nexpage-codex-capture-'\)\)/);
  assert.match(source, /finally\s*\{[\s\S]*rmSync\(captureDirectory, \{ recursive: true, force: true \}\)/);
});

test('CLI passes verified evidence and both screenshot outcomes to the atomic writer', () => {
  const source = readFileSync(new URL('../bin/nexpage.mjs', import.meta.url), 'utf8');
  assert.match(source, /writeCodexContextPack\(\{[\s\S]*evidence,[\s\S]*referencePath,[\s\S]*fullPagePath,[\s\S]*fullPageError,/);
});

test('CLI reports Codex package failures without claiming a package path', () => {
  const source = readFileSync(new URL('../bin/nexpage.mjs', import.meta.url), 'utf8');
  assert.match(source, /Codex 上下文包生成失败/);
  assert.match(source, /process\.exitCode = 1/);
  assert.match(source, /if \(codexPack\) console\.log\(`  ✓ Codex 使用目录/);
});
