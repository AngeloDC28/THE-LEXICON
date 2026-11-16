#!/usr/bin/env node
/**
 * stage-output.mjs
 *
 * Copies the files the website actually serves into out/, which is what
 * Vercel deploys (vercel.json → "outputDirectory": "out").
 *
 * Until this existed the output directory was the repository root, so
 * everything in the repo was publicly downloadable: vercel.json,
 * package.json, CLAUDE.md, the internal briefs, every content/*.json source
 * file, the CI config, and a 7MB "files 3.zip". It also meant there was no
 * real 404 — the catch-all rewrite sent any made-up path to the homepage.
 *
 * The list below is an allowlist on purpose: a new file in the repo root is
 * private until it is added here. Serverless functions in api/ are built by
 * Vercel from the project root and are unaffected.
 *
 * Runs as the last step of `npm run preflight` (Vercel's build command).
 * Zero dependencies.
 */
import { cpSync, existsSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT  = join(ROOT, 'out');

const FILES = [
  'index.html', '404.html', '404.css', 'index.css', 'database.js',
  'favicon.svg', 'site.webmanifest', 'sw.js',
  'robots.txt', 'sitemap.xml', 'sitemap-index.xml', 'feed.xml',
  'public/tailwind.css',
];
// Only the archive's own images from public/: public/data (unreferenced
// source images, ~90MB) and stray files there are not part of the site.
const DIRS = ['js', 'public/THE-LEXICON-ASSETS', 'entry', '.well-known'];

// Required for the site to work at all — fail the build rather than ship a
// deploy that is missing one.
const REQUIRED = ['index.html', '404.html', 'index.css', 'database.js', 'js', 'public/tailwind.css', 'public/THE-LEXICON-ASSETS', 'entry'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const missing = [];
let files = 0;
const count = (p) => statSync(p).isDirectory()
  ? readdirSync(p).reduce((n, c) => n + count(join(p, c)), 0)
  : 1;

for (const name of [...FILES, ...DIRS]) {
  const src = join(ROOT, name);
  if (!existsSync(src)) {
    if (REQUIRED.includes(name)) missing.push(name);
    continue;
  }
  cpSync(src, join(OUT, name), { recursive: true });
  files += count(src);
}

if (missing.length) {
  console.error(`LEXICON_STAGE_OUTPUT failed — missing: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`LEXICON_STAGE_OUTPUT ok (${files} files → out/)`);
