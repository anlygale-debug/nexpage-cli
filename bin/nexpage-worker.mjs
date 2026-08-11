#!/usr/bin/env node
import { createUiLibraryCaptureSession } from '../src/ui-library/capture-session.js';
import { runNexPageJsonlWorker } from '../src/ui-library/jsonl-worker.js';

await runNexPageJsonlWorker({
  createSession: ({ emit }) => createUiLibraryCaptureSession({ emit }),
  input: process.stdin,
  output: process.stdout,
});
