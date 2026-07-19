import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

function stripWrappingQuotes(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function expandHomePath(value, homeDir) {
  const clean = stripWrappingQuotes(value);
  if (clean === '~') return homeDir;
  if (clean.startsWith('~/')) return join(homeDir, clean.slice(2));
  return clean;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function runFolderName(url, now) {
  const parsed = new URL(url);
  const host = parsed.hostname
    .replace(/^www\./, '')
    .replace(/\./g, '-')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'website';
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-') + `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${stamp}-${host}`;
}

function uniqueDirectory(base, exists) {
  if (!exists(base)) return base;
  let suffix = 2;
  while (exists(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function chooseOutputFolder({
  platform = process.platform,
  execFile = execFileSync,
} = {}) {
  if (platform !== 'darwin') {
    throw new Error('--pick-output 当前仅支持 macOS，请改用 -o/--out 指定路径');
  }
  try {
    const selected = execFile(
      '/usr/bin/osascript',
      ['-e', 'POSIX path of (choose folder with prompt "选择 nexpage 结果保存位置")'],
      { encoding: 'utf8' },
    );
    const normalized = stripWrappingQuotes(String(selected || '')).replace(/\/+$/, '');
    if (!normalized) throw new Error('User canceled.');
    return normalized;
  } catch (error) {
    const message = `${error?.message || ''} ${error?.stderr || ''}`;
    if (/cancel|取消|-128/i.test(message)) {
      throw new Error('已取消选择保存文件夹');
    }
    throw new Error(`无法打开 Finder 文件夹选择器：${error?.message || '未知错误'}`);
  }
}

export function resolveOutputDirectory({
  args = [],
  url,
  cwd = process.cwd(),
  homeDir = homedir(),
  now = new Date(),
  exists = existsSync,
  pickDirectory = chooseOutputFolder,
} = {}) {
  const shortIndex = args.indexOf('-o');
  const longIndex = args.indexOf('--out');
  const outputIndex = shortIndex >= 0 ? shortIndex : longIndex;
  const wantsPicker = args.includes('--pick-output');

  if (outputIndex >= 0 && wantsPicker) {
    throw new Error('不能同时使用 --out 和 --pick-output');
  }

  if (outputIndex >= 0) {
    const rawPath = args[outputIndex + 1];
    if (!rawPath || rawPath.startsWith('-')) {
      throw new Error('-o/--out 后面必须提供文件夹路径');
    }
    const expanded = expandHomePath(rawPath, homeDir);
    if (!expanded) throw new Error('-o/--out 后面必须提供文件夹路径');
    return {
      directory: isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded),
      mode: 'exact',
    };
  }

  if (wantsPicker) {
    const parent = pickDirectory();
    const base = join(resolve(parent), runFolderName(url, now));
    return {
      directory: uniqueDirectory(base, exists),
      mode: 'picked',
    };
  }

  return {
    directory: resolve(cwd, 'nexpage-output'),
    mode: 'default',
  };
}
