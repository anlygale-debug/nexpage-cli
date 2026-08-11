import { createInterface } from 'node:readline';
import { isAbsolute } from 'node:path';

export const UI_LIBRARY_WORKER_PROTOCOL_VERSION = 1;
export const UI_LIBRARY_WORKER_VERSION = '0.2.0';
export const UI_LIBRARY_WORKER_CAPABILITIES = Object.freeze([
  'visible_browser',
  'manual_continue',
  'reference_screenshot',
  'full_screenshot',
  'codex_context',
]);

function hasExactKeys(value, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === required.length && required.every(key => keys.includes(key));
}

function validRunId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function parseWebUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) return null;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return value;
  } catch {
    return null;
  }
}

function parseCommand(line) {
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    return { command: null, runId: 'invalid-run' };
  }
  const runId = validRunId(value?.runId) ? value.runId : 'invalid-run';
  if (value?.protocolVersion !== UI_LIBRARY_WORKER_PROTOCOL_VERSION) {
    return { command: null, runId };
  }
  if (value.type === 'start') {
    if (!hasExactKeys(value, ['outputDirectory', 'protocolVersion', 'requestedUrl', 'runId', 'type'])) {
      return { command: null, runId };
    }
    const requestedUrl = parseWebUrl(value.requestedUrl);
    if (!requestedUrl || !validRunId(value.runId) || typeof value.outputDirectory !== 'string' || !isAbsolute(value.outputDirectory)) {
      return { command: null, runId };
    }
    return {
      command: {
        outputDirectory: value.outputDirectory,
        requestedUrl,
        runId: value.runId,
        type: 'start',
      },
      runId,
    };
  }
  if (value.type === 'continue' || value.type === 'cancel') {
    if (!hasExactKeys(value, ['protocolVersion', 'runId', 'type']) || !validRunId(value.runId)) {
      return { command: null, runId };
    }
    return { command: { runId: value.runId, type: value.type }, runId };
  }
  return { command: null, runId };
}

function errorMessage(error) {
  return error instanceof Error && error.message
    ? error.message.slice(0, 1000)
    : 'NexPage Worker 执行失败。';
}

export async function runNexPageJsonlWorker({ createSession, input, output }) {
  if (typeof createSession !== 'function') throw new TypeError('createSession is required');
  if (!input || typeof input[Symbol.asyncIterator] !== 'function') throw new TypeError('input is required');
  if (!output || typeof output.write !== 'function') throw new TypeError('output is required');

  const write = event => output.write(`${JSON.stringify(event)}\n`);
  write({
    capabilities: UI_LIBRARY_WORKER_CAPABILITIES,
    protocolVersion: UI_LIBRARY_WORKER_PROTOCOL_VERSION,
    type: 'capabilities',
    workerVersion: UI_LIBRARY_WORKER_VERSION,
  });

  let session = null;
  let activeRunId = null;
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseCommand(line);
    if (!parsed.command) {
      write({
        message: 'NexPage Worker 收到了不兼容的命令。',
        protocolVersion: UI_LIBRARY_WORKER_PROTOCOL_VERSION,
        runId: parsed.runId,
        type: 'failed',
      });
      continue;
    }

      const command = parsed.command;
      try {
        if (command.type === 'start') {
          if (session) throw new Error('NexPage Worker 已经有正在运行的任务。');
          activeRunId = command.runId;
          session = createSession({ emit: write });
          await session.start({
            outputDirectory: command.outputDirectory,
            requestedUrl: command.requestedUrl,
            runId: command.runId,
          });
          continue;
        }
        if (!session || command.runId !== activeRunId) {
          throw new Error('NexPage Worker 任务不存在。');
        }
        if (command.type === 'continue') {
          await session.continue(command.runId);
        } else {
          await session.cancel(command.runId);
        }
      } catch (error) {
        write({
          message: errorMessage(error),
          protocolVersion: UI_LIBRARY_WORKER_PROTOCOL_VERSION,
          runId: command.runId,
          type: 'failed',
        });
      }
    }
  } finally {
    if (session && activeRunId) await session.cancel(activeRunId);
  }
}
