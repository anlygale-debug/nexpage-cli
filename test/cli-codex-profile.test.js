import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as nexpage from '../src/index.js';

const { planCodexRun } = nexpage;

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
  const evidenceIndex = source.indexOf('collectCodexEvidence(page)');
  const closeIndex = source.indexOf('browser.close()');
  assert.ok(evidenceIndex >= 0);
  assert.ok(closeIndex >= 0);
  assert.ok(evidenceIndex < closeIndex);
  assert.doesNotMatch(source, /join\(outDir, 'codex-context', 'reference\.png'\)/);
});

test('CLI protects every browser operation after a successful launch', () => {
  const source = readFileSync(new URL('../bin/nexpage.mjs', import.meta.url), 'utf8');
  const launchIndex = source.indexOf('await chromium.launch(');
  const tryIndex = source.indexOf('try {', launchIndex);
  const contextIndex = source.indexOf('browser.newContext(');
  assert.ok(launchIndex >= 0);
  assert.ok(tryIndex > launchIndex);
  assert.ok(contextIndex > tryIndex);
});

test('with-codex preserves full output and skips the writer after preparation fails', async () => {
  const calls = [];
  const preparationError = new Error('evidence unavailable');
  const result = await nexpage.runCodexOutputSequence({
    runPlan: planCodexRun(['--with-codex']),
    codexPreparationError: preparationError,
    generateFullOutput: async () => {
      calls.push('full');
      return 'full-result';
    },
    generateCodexPackage: async () => {
      calls.push('codex');
      return 'codex-result';
    },
  });

  assert.deepEqual(calls, ['full']);
  assert.equal(result.fullOutput, 'full-result');
  assert.equal(result.codexPack, null);
  assert.equal(result.codexError, preparationError);
});

test('codex-only skips the full generator', async () => {
  const calls = [];
  const result = await nexpage.runCodexOutputSequence({
    runPlan: planCodexRun(['--profile', 'codex']),
    generateFullOutput: async () => calls.push('full'),
    generateCodexPackage: async () => {
      calls.push('codex');
      return 'codex-result';
    },
  });

  assert.deepEqual(calls, ['codex']);
  assert.equal(result.fullOutput, null);
  assert.equal(result.codexPack, 'codex-result');
  assert.equal(result.codexError, null);
});

test('with-codex returns a writer error after preserving full output', async () => {
  const calls = [];
  const writerError = new Error('validation failed');
  const result = await nexpage.runCodexOutputSequence({
    runPlan: planCodexRun(['--with-codex']),
    generateFullOutput: async () => {
      calls.push('full');
      return 'full-result';
    },
    generateCodexPackage: async () => {
      calls.push('codex');
      throw writerError;
    },
  });

  assert.deepEqual(calls, ['full', 'codex']);
  assert.equal(result.fullOutput, 'full-result');
  assert.equal(result.codexPack, null);
  assert.equal(result.codexError, writerError);
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
