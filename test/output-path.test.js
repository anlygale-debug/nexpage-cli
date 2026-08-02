import assert from 'node:assert/strict';
import test from 'node:test';
import * as nexpage from '../src/index.js';

const baseOptions = {
  url: 'https://www.example.com/products',
  cwd: '/workspace',
  homeDir: '/Users/alice',
  now: new Date(2026, 6, 19, 14, 30),
  exists: () => false,
};

test('keeps the existing default output directory unchanged', () => {
  assert.equal(typeof nexpage.resolveOutputDirectory, 'function');
  const result = nexpage.resolveOutputDirectory({ ...baseOptions, args: [] });
  assert.deepEqual(result, {
    directory: '/workspace/nexpage-output',
    mode: 'default',
  });
});

test('expands a quoted home-relative --out path and preserves exact-directory semantics', () => {
  const result = nexpage.resolveOutputDirectory({
    ...baseOptions,
    args: ['--out', '"~/Desktop/UI Exports"'],
  });
  assert.deepEqual(result, {
    directory: '/Users/alice/Desktop/UI Exports',
    mode: 'exact',
  });
});

test('rejects -o and --out when the directory value is missing', () => {
  for (const args of [['-o'], ['--out'], ['--out', '--profile', 'codex']]) {
    assert.throws(
      () => nexpage.resolveOutputDirectory({ ...baseOptions, args }),
      /-o\/--out 后面必须提供文件夹路径/,
    );
  }
});

test('uses a Finder-selected parent and creates a dated domain subfolder', () => {
  let pickerCalls = 0;
  const result = nexpage.resolveOutputDirectory({
    ...baseOptions,
    args: ['--pick-output'],
    pickDirectory: () => {
      pickerCalls += 1;
      return '/Users/alice/Desktop/Exports/';
    },
  });
  assert.equal(pickerCalls, 1);
  assert.deepEqual(result, {
    directory: '/Users/alice/Desktop/Exports/2026-07-19-1430-example-com',
    mode: 'picked',
  });
});

test('adds a numeric suffix when the picked run directory already exists', () => {
  const occupied = new Set([
    '/Users/alice/Desktop/Exports/2026-07-19-1430-example-com',
    '/Users/alice/Desktop/Exports/2026-07-19-1430-example-com-2',
  ]);
  const result = nexpage.resolveOutputDirectory({
    ...baseOptions,
    args: ['--pick-output'],
    pickDirectory: () => '/Users/alice/Desktop/Exports',
    exists: path => occupied.has(path),
  });
  assert.equal(result.directory, '/Users/alice/Desktop/Exports/2026-07-19-1430-example-com-3');
});

test('rejects combining exact output and Finder output modes', () => {
  assert.throws(
    () => nexpage.resolveOutputDirectory({
      ...baseOptions,
      args: ['--out', '/tmp/exact', '--pick-output'],
      pickDirectory: () => '/tmp/picked',
    }),
    /不能同时使用 --out 和 --pick-output/,
  );
});

test('normalizes the macOS Finder result and reports cancellation clearly', () => {
  assert.equal(typeof nexpage.chooseOutputFolder, 'function');
  const selected = nexpage.chooseOutputFolder({
    platform: 'darwin',
    execFile: () => '/Users/alice/Desktop/My Exports/\n',
  });
  assert.equal(selected, '/Users/alice/Desktop/My Exports');

  assert.throws(
    () => nexpage.chooseOutputFolder({
      platform: 'darwin',
      execFile: () => { throw new Error('User canceled.'); },
    }),
    /已取消选择保存文件夹/,
  );
});
