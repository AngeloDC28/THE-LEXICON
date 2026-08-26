#!/usr/bin/env node
/**
 * .github/scripts/inject-env.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates that required Vercel environment variables are present at build
 * time. These are used only by the /api/* serverless functions and are never
 * exposed to the browser, so nothing is written to disk — the SPA loads its
 * data from the static database.js and talks to the backend via /api/*.
 *
 * Required Vercel env vars (set in project dashboard, never commit):
 *   DATABASE_URL   — Neon Postgres connection string
 *   RESEND_API_KEY — Resend transactional email API key
 *   APP_ORIGIN     — https://thelexicon.xyz (no trailing slash)
 *
 * Locally: no env vars needed for the SPA itself. The /api functions
 * require a .env.local with the vars above if testing locally with
 * `vercel dev`.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Load .env.local for local invocations
try {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k && v && !process.env[k]) process.env[k] = v;
  }
} catch { /* no .env.local is fine in CI */ }

// Warn (not fail) if backend vars are missing — the SPA works without auth.
const required = ['DATABASE_URL', 'RESEND_API_KEY', 'APP_ORIGIN'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.warn(`INJECT_ENV warn — missing backend env vars: ${missing.join(', ')}`);
  console.warn('  Sign-in will not work until these are set in Vercel dashboard.');
}

console.log('INJECT_ENV ok');
