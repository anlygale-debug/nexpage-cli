// Cookie file loaders. Supports three formats so users can paste whatever
// their existing tooling exports:
//   - JSON array of Playwright cookie objects: [{name, value, domain, path, …}]
//   - Playwright storageState JSON: { cookies: [...], origins: [...] }
//   - Netscape cookies.txt: tab-separated lines (curl / wget / browser extensions)
//
// Returned shape is always the Playwright cookie array.

import { readFileSync } from 'fs';

function parseNetscape(text, targetUrl) {
  const cookies = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Skip comment lines, but keep the Netscape `#HttpOnly_<domain>` prefix
    // that browsers use to mark HttpOnly cookies — those are real entries.
    if (line.startsWith('#') && !/^#HttpOnly_/i.test(line)) continue;
    const parts = raw.split('\t');
    if (parts.length < 7) continue;
    const [domain, , path, secure, expires, name, value] = parts;
    if (!name) continue;
    const cookie = {
      name,
      value: value ?? '',
      domain: domain.replace(/^#HttpOnly_/i, ''),
      path: path || '/',
      secure: secure === 'TRUE',
      httpOnly: /^#HttpOnly_/i.test(domain),
    };
    const exp = Number(expires);
    if (Number.isFinite(exp) && exp > 0) cookie.expires = exp;
    if (!cookie.domain && targetUrl) cookie.url = targetUrl;
    cookies.push(cookie);
  }
  return cookies;
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  // Playwright storageState: { cookies: [...], origins: [...] }
  if (parsed && Array.isArray(parsed.cookies)) return parsed.cookies;
  // Raw array
  if (Array.isArray(parsed)) return parsed;
  throw new Error('cookie file: JSON must be a cookie array or Playwright storageState');
}

export function loadCookiesFromFile(filePath, targetUrl) {
  const text = readFileSync(filePath, 'utf-8');
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJson(text);
  }
  return parseNetscape(text, targetUrl);
}

// Merge CLI-provided cookies (name=value strings) with file cookies.
// Later entries (file) override earlier entries (CLI) at the same name+domain.
export function mergeCookies(cliCookies = [], fileCookies = [], targetUrl) {
  const seen = new Map();
  const parseCli = (c) => {
    if (typeof c !== 'string') return c;
    const [name, ...rest] = c.split('=');
    return { name, value: rest.join('='), url: targetUrl };
  };
  for (const c of [...cliCookies.map(parseCli), ...fileCookies]) {
    if (!c || !c.name) continue;
    const key = `${c.name}|${c.domain || c.url || ''}`;
    seen.set(key, c);
  }
  return [...seen.values()];
}
