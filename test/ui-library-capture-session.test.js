import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createUiLibraryCaptureSession } from '../src/ui-library/capture-session.js';

test('UI Library capture session opens a visible browser and returns the actual navigated page', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexpage-ui-library-'));
  const events = [];
  const launches = [];
  let browserClosed = false;
  const page = {
    context: () => ({ browser: () => ({}) }),
    screenshot: async options => {
      fs.writeFileSync(options.path, 'png-fixture');
    },
    title: async () => 'Final dashboard',
    url: () => 'https://example.com/dashboard',
    waitForLoadState: async () => undefined,
  };
  const session = createUiLibraryCaptureSession({
    dependencies: {
      browserLauncher: {
        launch: async options => {
          launches.push(options);
          return {
            close: async () => { browserClosed = true; },
            newContext: async () => ({ newPage: async () => page }),
          };
        },
      },
      captureScrollReference: async (_page, outputPath) => {
        fs.writeFileSync(outputPath, 'full-png-fixture');
      },
      collectCodexEvidence: async () => ({ headings: [] }),
      extractDesignLanguage: async () => ({ meta: { title: 'Extracted title' } }),
      navigateForCapture: async () => ({ attempts: 1, degraded: false, warning: null }),
      prepareCodexCapture: async () => ({ hiddenOverlays: 0, scrollSteps: 1 }),
      writeCodexContextPack: ({ outDir }) => {
        const directory = path.join(outDir, 'codex-context');
        fs.mkdirSync(directory);
        fs.writeFileSync(path.join(directory, 'CODEX.md'), '# fixture');
        return { directory, files: ['CODEX.md'], warnings: [] };
      },
    },
    emit: event => events.push(event),
  });

  await session.start({
    outputDirectory: root,
    requestedUrl: 'https://example.com/start',
    runId: 'capture-1',
  });
  assert.deepEqual(launches, [{ headless: false }]);
  assert.equal(events[0].type, 'browser_ready');

  await session.continue('capture-1');

  const completed = events.at(-1);
  assert.equal(completed.type, 'completed');
  assert.equal(completed.finalUrl, 'https://example.com/dashboard');
  assert.equal(completed.title, 'Final dashboard');
  assert.equal(completed.referenceScreenshotPath, path.join(root, 'reference.png'));
  assert.equal(completed.fullScreenshotPath, path.join(root, 'reference-full.png'));
  assert.equal(completed.visualPackagePath, path.join(root, 'codex-context'));
  assert.equal(fs.existsSync(completed.referenceScreenshotPath), true);
  assert.equal(fs.existsSync(completed.fullScreenshotPath), true);
  assert.equal(fs.existsSync(path.join(completed.visualPackagePath, 'CODEX.md')), true);
  assert.equal(browserClosed, true);
  fs.rmSync(root, { force: true, recursive: true });
});

test('UI Library capture session cancellation closes the visible browser', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexpage-ui-library-'));
  const events = [];
  let browserClosed = false;
  const session = createUiLibraryCaptureSession({
    dependencies: {
      browserLauncher: {
        launch: async () => ({
          close: async () => { browserClosed = true; },
          newContext: async () => ({
            newPage: async () => ({ title: async () => 'Ready', waitForLoadState: async () => undefined }),
          }),
        }),
      },
      navigateForCapture: async () => ({ attempts: 1, degraded: false, warning: null }),
    },
    emit: event => events.push(event),
  });

  await session.start({ outputDirectory: root, requestedUrl: 'https://example.com', runId: 'capture-cancel' });
  await session.cancel('capture-cancel');

  assert.equal(browserClosed, true);
  assert.equal(events.at(-1).type, 'cancelled');
  fs.rmSync(root, { force: true, recursive: true });
});
