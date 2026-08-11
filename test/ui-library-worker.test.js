import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { runNexPageJsonlWorker } from '../src/ui-library/jsonl-worker.js';

function createHarness(createSession) {
  const input = new PassThrough();
  const output = new PassThrough();
  const lines = [];
  output.setEncoding('utf8');
  output.on('data', chunk => {
    for (const line of chunk.split('\n').filter(Boolean)) lines.push(JSON.parse(line));
  });
  const running = runNexPageJsonlWorker({ createSession, input, output });
  return { input, lines, running };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error('worker test timed out');
}

test('UI Library worker negotiates protocol v1 and exposes browser-ready', async () => {
  const calls = [];
  const harness = createHarness(({ emit }) => ({
    cancel: async () => undefined,
    continue: async () => undefined,
    start: async input => {
      calls.push(input);
      emit({
        message: '真实浏览器已打开',
        protocolVersion: 1,
        runId: input.runId,
        type: 'browser_ready',
      });
    },
  }));

  await waitFor(() => harness.lines.length === 1);
  assert.deepEqual(harness.lines[0], {
    capabilities: ['visible_browser', 'manual_continue', 'reference_screenshot', 'full_screenshot', 'codex_context'],
    protocolVersion: 1,
    type: 'capabilities',
    workerVersion: '0.2.0',
  });

  harness.input.write(`${JSON.stringify({
    outputDirectory: '/tmp/nexpage-run-1',
    protocolVersion: 1,
    requestedUrl: 'https://example.com/start',
    runId: 'run-1',
    type: 'start',
  })}\n`);

  await waitFor(() => harness.lines.length === 2);
  assert.deepEqual(calls, [{
    outputDirectory: '/tmp/nexpage-run-1',
    requestedUrl: 'https://example.com/start',
    runId: 'run-1',
  }]);
  assert.equal(harness.lines[1].type, 'browser_ready');
  harness.input.end();
  await harness.running;
});

test('UI Library worker continues the same run and returns canonical capture paths', async () => {
  const harness = createHarness(({ emit }) => ({
    cancel: async () => undefined,
    start: async input => emit({
      message: '浏览器已准备好',
      protocolVersion: 1,
      runId: input.runId,
      type: 'browser_ready',
    }),
    continue: async runId => {
      emit({
        message: '正在生成视觉包',
        protocolVersion: 1,
        runId,
        step: 'build_codex_context',
        type: 'progress',
      });
      emit({
        finalUrl: 'https://example.com/final',
        fullScreenshotPath: '/tmp/nexpage-run-2/reference-full.png',
        outputDirectory: '/tmp/nexpage-run-2',
        protocolVersion: 1,
        referenceScreenshotPath: '/tmp/nexpage-run-2/reference.png',
        runId,
        title: 'Example final',
        type: 'completed',
        visualPackagePath: '/tmp/nexpage-run-2/codex-context',
      });
    },
  }));

  await waitFor(() => harness.lines.length === 1);
  harness.input.write(`${JSON.stringify({
    outputDirectory: '/tmp/nexpage-run-2',
    protocolVersion: 1,
    requestedUrl: 'https://example.com',
    runId: 'run-2',
    type: 'start',
  })}\n`);
  await waitFor(() => harness.lines.some(line => line.type === 'browser_ready'));
  harness.input.write(`${JSON.stringify({
    protocolVersion: 1,
    runId: 'run-2',
    type: 'continue',
  })}\n`);

  await waitFor(() => harness.lines.some(line => line.type === 'completed'));
  assert.deepEqual(
    harness.lines.slice(-2).map(line => line.type),
    ['progress', 'completed'],
  );
  assert.equal(harness.lines.at(-1).referenceScreenshotPath, '/tmp/nexpage-run-2/reference.png');
  harness.input.end();
  await harness.running;
});

test('UI Library worker rejects malformed commands without starting capture', async () => {
  let created = false;
  const harness = createHarness(() => {
    created = true;
    throw new Error('must not create session');
  });

  await waitFor(() => harness.lines.length === 1);
  harness.input.write('{"protocolVersion":2,"type":"start","runId":"run-3"}\n');
  await waitFor(() => harness.lines.length === 2);

  assert.equal(created, false);
  assert.deepEqual(harness.lines[1], {
    message: 'NexPage Worker 收到了不兼容的命令。',
    protocolVersion: 1,
    runId: 'run-3',
    type: 'failed',
  });
  harness.input.end();
  await harness.running;
});

test('UI Library worker cancels the active browser session when its host disconnects', async () => {
  const cancelled = [];
  const harness = createHarness(({ emit }) => ({
    cancel: async runId => { cancelled.push(runId); },
    continue: async () => undefined,
    start: async input => emit({
      message: '浏览器已准备好',
      protocolVersion: 1,
      runId: input.runId,
      type: 'browser_ready',
    }),
  }));

  await waitFor(() => harness.lines.length === 1);
  harness.input.write(`${JSON.stringify({
    outputDirectory: '/tmp/nexpage-host-disconnect',
    protocolVersion: 1,
    requestedUrl: 'https://example.com',
    runId: 'run-disconnect',
    type: 'start',
  })}\n`);
  await waitFor(() => harness.lines.some(line => line.type === 'browser_ready'));
  harness.input.end();
  await harness.running;

  assert.deepEqual(cancelled, ['run-disconnect']);
});
