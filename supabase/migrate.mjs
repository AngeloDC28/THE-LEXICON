#!/usr/bin/env node
/**
 * supabase/migrate.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads every content/entries/*.json file and upserts it into Supabase.
 * Uses the SERVICE KEY (never the anon key) so RLS is bypassed.
 *
 * Prerequisites
 *   1. Run supabase/schema.sql + supabase/rls.sql in the SQL editor first.
 *   2. Set env vars (or put them in .env.local):
 *        SUPABASE_URL          https://xxxx.supabase.co
 *        SUPABASE_SERVICE_KEY  eyJhbGci...  (Settings → API → service_role)
 *
 * Usage
 *   node supabase/migrate.mjs              # upsert (safe to re-run)
 *   node supabase/migrate.mjs --force      # wipe then reimport everything
 *   node supabase/migrate.mjs --dry-run    # validate JSON only, no network
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname }             from 'node:path';
import { fileURLToPath }             from 'node:url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dir, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE   = process.argv.includes('--force');

// ── Load env from .env.local if present ─────────────────────────────────────
try {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k && v && !process.env[k]) process.env[k] = v;
  }
} catch { /* no .env.local is fine */ }

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error('\n❌  Set SUPABASE_URL and SUPABASE_SERVICE_KEY before running.\n');
  process.exit(1);
}

// ── Read source data ─────────────────────────────────────────────────────────
const orderRaw = JSON.parse(readFileSync(join(ROOT, 'content', 'order.json'), 'utf8'));
const orderMap  = Object.fromEntries(orderRaw.map((id, i) => [id, i]));

const entriesDir = join(ROOT, 'content', 'entries');
const files      = readdirSync(entriesDir).filter(f => f.endsWith('.json')).sort();

const entries = files.map(f => {
  const e = JSON.parse(readFileSync(join(entriesDir, f), 'utf8'));
  return { ...e, sort_order: orderMap[e.id] ?? 9999 };
}).sort((a, b) => a.sort_order - b.sort_order);

console.log(`\n📦  ${DRY_RUN ? '[DRY RUN] ' : ''}Migrating ${entries.length} entries...\n`);

if (DRY_RUN) {
  for (const e of entries) {
    const imgs = (e.images || []).length;
    const hots = (e.images || []).reduce((n, i) => n + (i.hotspots || []).length, 0);
    console.log(`  ✓  ${e.id}  (${imgs} images, ${hots} hotspots)`);
  }
  console.log('\n✔   Dry run complete — no data written.\n');
  process.exit(0);
}

// ── HTTP helper ──────────────────────────────────────────────────────────────
const BASE_HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
};

async function rest(method, table, body, extra = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method,
    headers: { ...BASE_HEADERS, ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} /${table} → ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : null;
}

// ── Force-wipe ───────────────────────────────────────────────────────────────
if (FORCE) {
  console.log('⚠️   --force: wiping all existing rows...');
  // Delete in reverse dependency order; filter "id gt 0" matches everything
  // (image_hotspots / entry_images use serial IDs; entries uses text id).
  await rest('DELETE', 'image_hotspots?id=gt.0',  undefined, { 'Prefer': 'return=minimal' });
  await rest('DELETE', 'entry_images?id=gt.0',    undefined, { 'Prefer': 'return=minimal' });
  await rest('DELETE', 'entry_notes?entry_id=neq.___none___', undefined, { 'Prefer': 'return=minimal' });
  await rest('DELETE', 'entry_tags?entry_id=neq.___none___',  undefined, { 'Prefer': 'return=minimal' });
  await rest('DELETE', 'entries?id=neq.___none___',           undefined, { 'Prefer': 'return=minimal' });
  console.log('✓   wiped.\n');
}

// ── Upsert loop ──────────────────────────────────────────────────────────────
const UPSERT = { 'Prefer': 'resolution=merge-duplicates,return=minimal' };
const RETURN  = { 'Prefer': 'return=representation' };

let ok = 0, fail = 0;

for (const entry of entries) {
  try {
    // 1 ── Core entry row
    await rest('POST', 'entries', {
      id:         entry.id,
      title:      entry.title,
      subtitle:   entry.subtitle  ?? null,
      year:       entry.year,
      season:     entry.season,
      volume:     entry.volume    ?? 1,
      sort_order: entry.sort_order,
      status:     entry.status    ?? 'published',
    }, UPSERT);

    // 2 ── Tags
    if (entry.tags && Object.keys(entry.tags).length) {
      await rest('POST', 'entry_tags', { entry_id: entry.id, ...entry.tags }, UPSERT);
    }

    // 3 ── Notes
    if (entry.notes && Object.keys(entry.notes).length) {
      await rest('POST', 'entry_notes', { entry_id: entry.id, ...entry.notes }, UPSERT);
    }

    // 4 ── Images + hotspots
    // For upsert safety: delete existing images for this entry first so
    // we don't accumulate duplicates on re-runs.
    await rest('DELETE', `entry_images?entry_id=eq.${encodeURIComponent(entry.id)}`,
      undefined, { 'Prefer': 'return=minimal' });

    for (let i = 0; i < (entry.images || []).length; i++) {
      const img = entry.images[i];

      const [imgRow] = await rest('POST', 'entry_images', {
        entry_id:   entry.id,
        src:        img.src,
        alt:        img.alt    ?? null,
        width:      img.width  ?? null,
        height:     img.height ?? null,
        sort_order: i,
      }, RETURN);

      if (img.hotspots?.length) {
        const hotspots = img.hotspots.map((h, hi) => ({
          image_id:    imgRow.id,
          x:           h.x,
          y:           h.y,
          label:       h.label,
          description: h.description ?? null,
          sort_order:  hi,
        }));
        await rest('POST', 'image_hotspots', hotspots, { 'Prefer': 'return=minimal' });
      }
    }

    process.stdout.write(`  ✓  ${entry.id}\n`);
    ok++;
  } catch (err) {
    process.stdout.write(`  ✗  ${entry.id}: ${err.message}\n`);
    fail++;
  }
}

console.log(`\n${'─'.repeat(56)}`);
console.log(`  ${ok} inserted / updated,  ${fail} failed\n`);
if (fail > 0) process.exit(1);
