import { buildVerifiedVisualModel } from '../codex/verified-model.js';
import {
  buildVerifiedContextFiles,
  formatVerifiedCodexContext,
} from '../codex/format-context.js';
export { writeCodexContextPack } from '../codex/write-package.js';

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
