import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { buildVerifiedContextFiles } from './format-context.js';
import { assertValidCodexPackage } from './validate-package.js';
import { buildVerifiedVisualModel } from './verified-model.js';

const defaultFileOps = Object.freeze({
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
});

function requireExistingFile(path, label, fileOps) {
  if (typeof path !== 'string' || !path || !isExistingFile(path, fileOps)) {
    throw new TypeError(`${label} must reference an existing file`);
  }
}

function isExistingFile(path, fileOps) {
  return fileOps.existsSync(path) && fileOps.statSync(path).isFile();
}

function uniqueBackupPath(outDir, fileOps) {
  const base = join(outDir, `.codex-context-backup-${process.pid}-${Date.now()}`);
  let path = base;
  let suffix = 0;
  while (fileOps.existsSync(path)) {
    suffix += 1;
    path = `${base}-${suffix}`;
  }
  return path;
}

function validateStagingPackage(staging, textFiles, stagedFiles, fileOps) {
  const files = Object.fromEntries(Object.keys(textFiles).map(name => [
    name,
    fileOps.readFileSync(join(staging, name), 'utf8'),
  ]));
  return assertValidCodexPackage({
    files,
    referencePath: join(staging, 'reference.png'),
    referenceExists: stagedFiles.referenceExists,
    fullPagePath: stagedFiles.fullPageExists ? join(staging, 'reference-full.png') : null,
    fullPageExists: stagedFiles.fullPageExists,
  });
}

export function writeCodexContextPack({
  design,
  evidence = {},
  outDir,
  referencePath,
  fullPagePath = null,
  fullPageError = null,
  hostname = '',
  fileOps = defaultFileOps,
  screenshotPath = null,
}) {
  if (!design || typeof design !== 'object' || Array.isArray(design)) {
    throw new TypeError('design is required');
  }
  if (typeof outDir !== 'string' || !outDir) throw new TypeError('outDir is required');

  const ops = { ...defaultFileOps, ...fileOps };
  const sourceReferencePath = referencePath ?? screenshotPath;
  requireExistingFile(sourceReferencePath, 'reference.png', ops);
  if (!ops.existsSync(outDir) || !ops.statSync(outDir).isDirectory()) {
    throw new TypeError('outDir must reference an existing directory');
  }

  const sourceFullPageExists = typeof fullPagePath === 'string'
    && fullPagePath.length > 0
    && isExistingFile(fullPagePath, ops);
  const target = join(outDir, 'codex-context');
  let staging = null;

  try {
    staging = ops.mkdtempSync(join(outDir, '.codex-context-staging-'));
    ops.copyFileSync(sourceReferencePath, join(staging, 'reference.png'));
    if (sourceFullPageExists) {
      ops.copyFileSync(fullPagePath, join(staging, 'reference-full.png'));
    }

    const stagedFiles = {
      referenceExists: isExistingFile(join(staging, 'reference.png'), ops),
      fullPageExists: isExistingFile(join(staging, 'reference-full.png'), ops),
    };
    const model = buildVerifiedVisualModel(design, evidence, {
      hostname,
      fullPageCaptured: stagedFiles.fullPageExists,
      fullPageError,
    });
    const textFiles = buildVerifiedContextFiles(model);
    for (const [name, content] of Object.entries(textFiles)) {
      ops.writeFileSync(join(staging, name), content, 'utf8');
    }

    const validation = validateStagingPackage(staging, textFiles, stagedFiles, ops);
    if (!ops.existsSync(target)) {
      ops.renameSync(staging, target);
      staging = null;
    } else {
      let backup = uniqueBackupPath(outDir, ops);
      ops.renameSync(target, backup);
      try {
        ops.renameSync(staging, target);
        staging = null;
      } catch (swapError) {
        try {
          ops.renameSync(backup, target);
          backup = null;
        } catch (restoreError) {
          swapError.restoreError = restoreError;
          swapError.backupPath = backup;
        }
        throw swapError;
      }
      ops.rmSync(backup, { recursive: true, force: true });
    }

    const files = [
      ...Object.keys(textFiles),
      'reference.png',
      ...(stagedFiles.fullPageExists ? ['reference-full.png'] : []),
    ];
    return { directory: target, files, warnings: validation.warnings, model };
  } finally {
    if (staging && ops.existsSync(staging)) {
      ops.rmSync(staging, { recursive: true, force: true });
    }
  }
}
