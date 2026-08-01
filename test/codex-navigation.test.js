import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateForCapture } from '../src/codex/navigate.js';

function timeoutError() {
  const error = new Error('page.goto: net::ERR_TIMED_OUT');
  error.name = 'TimeoutError';
  return error;
}

test('navigation retries a transient timeout and reports the successful attempt', async () => {
  let attempts = 0;
  const page = {
    async goto() {
      attempts += 1;
      if (attempts === 1) throw timeoutError();
    },
    url: () => attempts === 1 ? 'about:blank' : 'https://example.test/',
    title: async () => attempts === 1 ? '' : 'Example',
    evaluate: async () => attempts === 1 ? 0 : 120,
    waitForTimeout: async () => {},
    waitForLoadState: async () => {},
  };

  const result = await navigateForCapture(page, 'https://example.test', { attempts: 2, retryDelayMs: 0 });

  assert.equal(attempts, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.degraded, false);
});

test('navigation continues when goto times out after a useful page has rendered', async () => {
  let attempts = 0;
  const page = {
    async goto() {
      attempts += 1;
      throw timeoutError();
    },
    url: () => 'https://example.test/product',
    title: async () => 'Rendered Product',
    evaluate: async () => 240,
    waitForTimeout: async () => {},
    waitForLoadState: async () => {},
  };

  const result = await navigateForCapture(page, 'https://example.test', { attempts: 2, retryDelayMs: 0 });

  assert.equal(attempts, 1);
  assert.equal(result.degraded, true);
  assert.match(result.warning, /ERR_TIMED_OUT/);
});

test('navigation preserves the final error when no usable page is available', async () => {
  let attempts = 0;
  const page = {
    async goto() {
      attempts += 1;
      throw timeoutError();
    },
    url: () => 'about:blank',
    title: async () => '',
    evaluate: async () => 0,
    waitForTimeout: async () => {},
    waitForLoadState: async () => {},
  };

  await assert.rejects(
    navigateForCapture(page, 'https://example.test', { attempts: 2, retryDelayMs: 0 }),
    /ERR_TIMED_OUT/,
  );
  assert.equal(attempts, 2);
});
