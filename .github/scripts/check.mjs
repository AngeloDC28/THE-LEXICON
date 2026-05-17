#!/usr/bin/env node
/**
 * Quick static safety net.
 * Catches the two failure classes that have shipped to main:
 *   1. Modules that don't parse (e.g. unescaped quote inside a string literal).
 *   2. Duplicate `import { foo } from '...'` lines in the same file.
 * Run with `npm run check`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (name.endsWith('.js') || name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const failures = [];

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');

  // 1. parse check
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' });
  } catch (e) {
    failures.push(`PARSE  ${rel}\n       ${(e.stderr || e.stdout || '').toString().split('\n').slice(0, 4).join('\n       ')}`);
    continue;
  }

  // 2. duplicate top-level import lines (e.g. `import { x } from './y.js'` twice)
  const src = readFileSync(f, 'utf8');
  const importLines = src.split('\n').map((l, i) => [i + 1, l.trim()]).filter(([, l]) => /^import\s/.test(l));
  const seen = new Map();
  for (const [n, line] of importLines) {
    if (seen.has(line)) failures.push(`DUPIMP ${rel}:${seen.get(line)} and :${n} — ${line}`);
    else seen.set(line, n);
  }
}

if (failures.length) {
  console.error('\nLEXICON_CHECK failed:\n\n' + failures.join('\n\n') + '\n');
  process.exit(1);
}
console.log(`LEXICON_CHECK ok (${files.length} files)`);
