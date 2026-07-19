import { copyFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildVerifiedVisualModel } from '../codex/verified-model.js';
import {
  buildVerifiedContextFiles,
  formatVerifiedCodexContext,
} from '../codex/format-context.js';

function modelOptions(options) {
  return {
    hostname: options.hostname,
    fullPageCaptured: options.fullPageCaptured ?? options.coverage?.fullPage,
    fullPageError: options.fullPageError ?? options.coverage?.fullPageError,
  };
}

export function formatCodexContext(design, options = {}) {
  const model = buildVerifiedVisualModel(design, options.evidence, modelOptions(options));
  return formatVerifiedCodexContext(model);
}

export function buildCodexContextFiles(design, options = {}) {
  const model = buildVerifiedVisualModel(design, options.evidence, modelOptions(options));
  return buildVerifiedContextFiles(model);
}

export function isCodexProfile(args) {
  if (!Array.isArray(args)) return false;
  const index = args.indexOf('--profile');
  return index >= 0 && args[index + 1] === 'codex';
}

export function isWithCodex(args) {
  return Array.isArray(args) && args.includes('--with-codex');
}

export function writeCodexContextPack({
  design,
  outDir,
  screenshotPath,
  hostname,
  evidence,
  fullPageCaptured,
  fullPageError,
  coverage,
}) {
  if (!design || typeof design !== 'object') throw new TypeError('design is required');
  if (typeof outDir !== 'string' || !outDir) throw new TypeError('outDir is required');

  const directory = join(outDir, 'codex-context');
  mkdirSync(directory, { recursive: true });
  const files = buildCodexContextFiles(design, {
    hostname,
    evidence,
    fullPageCaptured,
    fullPageError,
    coverage,
  });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(directory, name), content, 'utf8');
  }

  const motionPath = join(directory, 'motion.json');
  if (!Object.hasOwn(files, 'motion.json') && existsSync(motionPath)) unlinkSync(motionPath);

  const written = Object.keys(files);
  const referencePath = join(directory, 'reference.png');
  if (typeof screenshotPath === 'string' && existsSync(screenshotPath)) {
    if (screenshotPath !== referencePath) copyFileSync(screenshotPath, referencePath);
    written.push('reference.png');
  }

  return { directory, files: written };
}
