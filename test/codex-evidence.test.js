import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCodexEvidence } from '../src/codex/collect-evidence.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

test('collectCodexEvidence reuses the supplied page exactly once', async () => {
  let calls = 0;
  const page = {
    async evaluate(callback) {
      calls += 1;
      assert.equal(typeof callback, 'function');
      return structuredClone(greptileEvidence);
    },
  };

  const evidence = await collectCodexEvidence(page);
  assert.equal(calls, 1);
  assert.equal(evidence.actions.length, 2);
  assert.deepEqual(evidence.animations.map(item => item.duration), [6000, 40000]);
});

test('collectCodexEvidence rejects an invalid Page', async () => {
  await assert.rejects(() => collectCodexEvidence(null), /page\.evaluate is required/);
});
