// v10.5 — Form & State Capture
//
// The states LLM agents always botch when rebuilding: form fields (styling
// per type), validation hints, modal containers (backdrop + panel geometry),
// empty / loading / error placeholders, skeleton shapes, and which toast
// library (if any) is on the page. Pure function — reads the crawler's
// existing computedStyles + sections + componentCandidates.

const TOAST_LIBS = [
  { id: 'sonner', re: /\bsonner\b|sonner-toast/i },
  { id: 'react-hot-toast', re: /react-hot-toast/i },
  { id: 'react-toastify', re: /react-toastify/i },
  { id: 'radix-toast', re: /radix-toast|data-radix-toast/i },
  { id: 'chakra-toast', re: /chakra-toast/i },
  { id: 'notistack', re: /notistack/i },
];

const SKELETON_CLASS_RE = /\b(skeleton|placeholder-loading|shimmer|pulse-loading|animate-pulse)\b/i;
const SPINNER_CLASS_RE = /\b(spinner|loading-indicator|loader)\b/i;
const EMPTY_STATE_RE = /\b(empty-state|no-results|no-data|nothing-here)\b/i;
const ERROR_STATE_RE = /\b(error-state|error-message|alert-error|form-error|invalid)\b/i;

function summarizeInputs(styles = []) {
  const types = {};
  for (const s of styles) {
    if (!s.tag || !/^(input|textarea|select)$/i.test(s.tag)) continue;
    const t = (s.type || s.inputType || s.tag).toLowerCase();
    types[t] = (types[t] || 0) + 1;
  }
  return types;
}

function detectToastLib(stack = {}) {
  const haystack = [
    ...(stack.scripts || []),
    ...(stack.classNameSample || []),
  ].join(' ');
  return TOAST_LIBS.filter(t => t.re.test(haystack)).map(t => t.id);
}

function detectModals(sections = []) {
  return sections.filter(s => {
    const blob = `${s.className || ''} ${s.role || ''}`.toLowerCase();
    return /\bmodal\b|dialog|overlay|drawer|sheet/.test(blob) || s.role === 'dialog';
  }).map(s => ({
    role: s.role || null,
    className: (s.className || '').slice(0, 80),
    bounds: s.bounds || null,
  }));
}

function classBasedScan(classSample = []) {
  let skeleton = 0, spinner = 0, emptyState = 0, errorState = 0;
  for (const c of classSample) {
    if (SKELETON_CLASS_RE.test(c)) skeleton++;
    if (SPINNER_CLASS_RE.test(c)) spinner++;
    if (EMPTY_STATE_RE.test(c)) emptyState++;
    if (ERROR_STATE_RE.test(c)) errorState++;
  }
  return { skeleton, spinner, emptyState, errorState };
}

function summarizeFormFields(candidates = []) {
  const inputs = candidates.filter(c => c.kind === 'input');
  if (!inputs.length) return { count: 0, families: {} };
  const families = {};
  for (const inp of inputs) {
    const key = [
      inp.css?.borderRadius || '',
      inp.css?.padding || '',
      inp.css?.border || '',
    ].join('|');
    families[key] = (families[key] || 0) + 1;
  }
  return { count: inputs.length, families: Object.values(families).slice(0, 6) };
}

export function extractFormStates(rawData = {}, design = {}) {
  const light = rawData.light || {};
  const stack = light.stack || {};
  const sections = light.sections || [];
  const candidates = light.componentCandidates || [];

  const toastLibs = detectToastLib(stack);
  const modals = detectModals(sections);
  const classScan = classBasedScan(stack.classNameSample || []);
  const form = summarizeFormFields(candidates);
  const inputTypes = summarizeInputs(light.computedStyles || []);

  const flags = [];
  if (classScan.skeleton) flags.push('skeleton-loading');
  if (classScan.spinner) flags.push('spinner-loading');
  if (classScan.emptyState) flags.push('empty-state');
  if (classScan.errorState) flags.push('error-state');
  if (modals.length) flags.push('modal');
  if (toastLibs.length) flags.push('toast-library');
  if (form.count) flags.push('forms');

  return {
    flags,
    forms: form,
    inputTypesSeen: inputTypes,
    modals,
    toastLibraries: toastLibs,
    loading: { skeleton: classScan.skeleton, spinner: classScan.spinner },
    empty: { count: classScan.emptyState },
    error: { count: classScan.errorState },
  };
}
