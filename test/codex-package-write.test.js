import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import { writeCodexContextPack } from '../src/codex/write-package.js';
import { greptileEvidence } from './fixtures/codex-fixture.js';

const design = {
  meta: { url: 'https://www.greptile.com/', title: 'Greptile', elementCount: 1200 },
  spacing: { scale: [4, 8, 16, 24, 32, 64] },
  motion: { keyframes: [{ name: 'float-code', used: true }, { name: 'grid-drift', used: true }] },
};

function hasGeneratedTemporaryDirectory(root) {
  return readdirSync(root).some(name => name.includes('staging') || name.includes('backup'));
}

test('writes a validated package and atomically replaces an old package', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
    const old = join(root, 'codex-context');
    mkdirSync(old);
    writeFileSync(join(old, 'old.txt'), 'old');
    const referencePath = join(root, 'capture.png');
    const fullPagePath = join(root, 'capture-full.png');
    writeFileSync(referencePath, 'viewport');
    writeFileSync(fullPagePath, 'full');

    const result = writeCodexContextPack({
      design,
      evidence: greptileEvidence,
      outDir: root,
      referencePath,
      fullPagePath,
      hostname: 'greptile-com',
    });

    assert.equal(existsSync(join(old, 'old.txt')), false);
    assert.deepEqual(result.files.sort(), [
      'CODEX.md',
      'motion.json',
      'reference-full.png',
      'reference.png',
      'tokens.json',
      'variables.css',
    ]);
    assert.equal(readFileSync(join(old, 'reference.png'), 'utf8'), 'viewport');
    assert.equal(readFileSync(join(old, 'reference-full.png'), 'utf8'), 'full');
    assert.equal(hasGeneratedTemporaryDirectory(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('keeps the previous package when core validation fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
    const old = join(root, 'codex-context');
    mkdirSync(old);
    writeFileSync(join(old, 'marker.txt'), 'keep me');

    assert.throws(() => writeCodexContextPack({
      design,
      evidence: greptileEvidence,
      outDir: root,
      referencePath: join(root, 'missing.png'),
      hostname: 'greptile-com',
    }), /reference\.png/);

    assert.equal(readFileSync(join(old, 'marker.txt'), 'utf8'), 'keep me');
    assert.equal(hasGeneratedTemporaryDirectory(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('restores the previous package when the staging swap fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
    const old = join(root, 'codex-context');
    mkdirSync(old);
    writeFileSync(join(old, 'marker.txt'), 'keep me');
    const referencePath = join(root, 'capture.png');
    writeFileSync(referencePath, 'viewport');

    const fileOps = {
      renameSync(from, to) {
        if (basename(from).startsWith('.codex-context-staging-') && to === old) {
          throw new Error('simulated staging swap failure');
        }
        renameSync(from, to);
      },
    };

    assert.throws(() => writeCodexContextPack({
      design,
      evidence: greptileEvidence,
      outDir: root,
      referencePath,
      hostname: 'greptile-com',
      fileOps,
    }), /simulated staging swap failure/);

    assert.equal(existsSync(old), true);
    assert.equal(readFileSync(join(old, 'marker.txt'), 'utf8'), 'keep me');
    assert.equal(hasGeneratedTemporaryDirectory(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
