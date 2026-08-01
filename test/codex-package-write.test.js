import assert from 'node:assert/strict';
import {
  copyFileSync,
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
      'STYLE-GUARDRAILS.md',
      'acceptance-checklist.md',
      'codex-instructions.md',
      'components.md',
      'design-strict.md',
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

test('degrades to viewport coverage when the staged full-page copy is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
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
      fileOps: {
        copyFileSync(from, to) {
          if (basename(to) === 'reference-full.png') return;
          copyFileSync(from, to);
        },
      },
    });

    assert.equal(result.files.includes('reference-full.png'), false);
    assert.equal(existsSync(join(result.directory, 'reference-full.png')), false);
    assert.match(result.warnings.join('\n'), /完整页面截图/);
    assert.match(readFileSync(join(result.directory, 'CODEX.md'), 'utf8'), /只覆盖桌面首屏/);
    assert.equal(result.model.coverage.fullPage, false);
    assert.equal(hasGeneratedTemporaryDirectory(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects a staged reference path that is not a file', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
    const old = join(root, 'codex-context');
    mkdirSync(old);
    writeFileSync(join(old, 'marker.txt'), 'keep me');
    const referencePath = join(root, 'capture.png');
    writeFileSync(referencePath, 'viewport');

    assert.throws(() => writeCodexContextPack({
      design,
      evidence: greptileEvidence,
      outDir: root,
      referencePath,
      hostname: 'greptile-com',
      fileOps: {
        copyFileSync(from, to) {
          if (basename(to) === 'reference.png') {
            mkdirSync(to);
            return;
          }
          copyFileSync(from, to);
        },
      },
    }), /reference\.png/);

    assert.equal(readFileSync(join(old, 'marker.txt'), 'utf8'), 'keep me');
    assert.equal(hasGeneratedTemporaryDirectory(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('retains exact recovery paths when both package swap and backup restore fail', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexpage-codex-test-'));
  try {
    const old = join(root, 'codex-context');
    mkdirSync(old);
    writeFileSync(join(old, 'marker.txt'), 'keep me');
    const referencePath = join(root, 'capture.png');
    writeFileSync(referencePath, 'viewport');

    let error;
    try {
      writeCodexContextPack({
        design,
        evidence: greptileEvidence,
        outDir: root,
        referencePath,
        hostname: 'greptile-com',
        fileOps: {
          renameSync(from, to) {
            if (to === old && basename(from).startsWith('.codex-context-staging-')) {
              throw new Error('simulated staging swap failure');
            }
            if (to === old && basename(from).startsWith('.codex-context-backup-')) {
              throw new Error('simulated backup restore failure');
            }
            renameSync(from, to);
          },
        },
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error);
    assert.match(error.message, /simulated staging swap failure/);
    assert.match(error.restoreError?.message || '', /simulated backup restore failure/);
    assert.equal(typeof error.backupPath, 'string');
    assert.equal(existsSync(error.backupPath), true);
    assert.equal(readFileSync(join(error.backupPath, 'marker.txt'), 'utf8'), 'keep me');
    assert.deepEqual(
      readdirSync(root).filter(name => name.startsWith('.codex-context-backup-')),
      [basename(error.backupPath)],
    );
    assert.deepEqual(
      readdirSync(root).filter(name => name.startsWith('.codex-context-staging-')),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
