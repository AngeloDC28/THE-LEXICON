#!/usr/bin/env node
/**
 * check-punctuation.mjs
 *
 * Fails the build when entry prose contains a semicolon doing a comma's job
 * ("the sharp; geometric edges", "his thirteenth show; simply titled No. 13;
 * during London Fashion Week"). An export/sanitising step once swapped commas
 * for semicolons across several entries; this stops that shipping again.
 *
 * It does NOT ban semicolons. Most semicolons in the archive are correct: the
 * hotspot notes are written as two independent clauses joined by one
 * ("The lace sits close over the chest; it features a raw hem."). Turning
 * those into commas would create comma splices, so the check has to tell the
 * two apart:
 *
 *   - A semicolon followed by a clause that opens with a pronoun or
 *     determiner subject (it / they / this / the / a ...) is accepted.
 *   - A semicolon followed by a conjunction, a participle, or anything else
 *     (an adjective, a bare noun) is treated as a swapped comma and FAILS.
 *
 * The second rule has false positives: real clauses that open with a noun
 * ("...over the chest; crude lacing crisscrosses the skirt"). Those are
 * listed, one per line, in content/punctuation-allowlist.json. If the check
 * flags a semicolon you have looked at and it genuinely joins two clauses,
 * either rephrase, or run:
 *
 *     node .github/scripts/check-punctuation.mjs --update-allowlist
 *
 * which rewrites the allowlist to match every semicolon currently in the
 * entries. Only do that after reading the flagged lines — it accepts all of
 * them.
 *
 * Scope: subtitle, notes.*, and hotspot descriptions. Tag values are left
 * alone (era names such as "1990 to 1999; The Deconstructionist Decade" are
 * taxonomy keys, not sentences). Zero dependencies.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT      = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES   = join(ROOT, 'content', 'entries');
const ALLOWLIST = join(ROOT, 'content', 'punctuation-allowlist.json');
const UPDATE    = process.argv.includes('--update-allowlist');

const CLAUSE_PRONOUNS = new Set(['it', 'they', 'there', 'he', 'she', 'we', 'this', 'these', 'those']);
const CLAUSE_DETERMINERS = new Set([
  'the', 'a', 'an', 'each', 'its', 'his', 'her', 'their', 'no', 'every', 'all',
  'one', 'two', 'three', 'four', 'five', 'six', 'some', 'many', 'most', 'several', 'another', 'any',
]);

/** True when the text after the semicolon at `idx` reads as an independent clause. */
function isClauseBreak(text, idx, isNote) {
  const after = text.slice(idx + 1);
  const end = after.search(/[;.!?]/);
  const segment = (end >= 0 ? after.slice(0, end) : after).trim();
  const words = segment.split(/\s+/).filter(Boolean);
  const first = (words[0] || '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (CLAUSE_PRONOUNS.has(first)) return words.length >= 3;
  if (CLAUSE_DETERMINERS.has(first)) {
    // In long-form notes a determiner can just as easily open a list item or
    // an appositive ("; a designation reflecting..."), so those go through
    // the allowlist rather than being trusted here.
    if (isNote) return false;
    if (words.length < 5) return false;
    // "x; a velvet bow; and a silk hem" is a list, not three clauses.
    if (end >= 0 && after[end] === ';' && /^\s*(and|or)\b/i.test(after.slice(end + 1))) return false;
    return true;
  }
  return false;
}

function* proseFields(entry) {
  if (typeof entry.subtitle === 'string') yield ['subtitle', entry.subtitle, true];
  for (const [k, v] of Object.entries(entry.notes || {})) {
    if (typeof v === 'string') yield [`notes.${k}`, v, true];
  }
  const images = entry.images || [];
  for (let i = 0; i < images.length; i++) {
    const hotspots = images[i].hotspots || [];
    for (let j = 0; j < hotspots.length; j++) {
      const d = hotspots[j].description;
      if (typeof d === 'string') yield [`images[${i}].hotspots[${j}].description`, d, false];
    }
  }
}

const allowKey = (slug, text, idx) =>
  `${slug} :: ${text.slice(Math.max(0, idx - 30), idx).trim()} ; ${text.slice(idx + 1, idx + 41).trim()}`;

const allowed = new Set(existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : []);
const seen = [];
const failures = [];
let total = 0;

const files = readdirSync(ENTRIES).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort();
for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  const entry = JSON.parse(readFileSync(join(ENTRIES, f), 'utf8'));
  for (const [path, text, isNote] of proseFields(entry)) {
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== ';') continue;
      total++;
      if (isClauseBreak(text, i, isNote)) continue;
      const key = allowKey(slug, text, i);
      seen.push(key);
      if (!allowed.has(key)) {
        failures.push({ f, path, context: `${text.slice(Math.max(0, i - 45), i)}⟦;⟧${text.slice(i + 1, i + 45)}` });
      }
    }
  }
}

if (UPDATE) {
  writeFileSync(ALLOWLIST, JSON.stringify(seen, null, 2) + '\n', 'utf8');
  console.log(`LEXICON_PUNCTUATION allowlist rewritten (${seen.length} reviewed semicolons)`);
  process.exit(0);
}

if (failures.length) {
  console.error(`\nPUNCTUATION: ${failures.length} semicolon(s) look like commas:\n`);
  for (const x of failures.slice(0, 40)) console.error(`  ${x.f} ${x.path}\n    …${x.context}…`);
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  console.error('\nReplace each with a comma. If one genuinely joins two full clauses, see the header of');
  console.error('.github/scripts/check-punctuation.mjs for how to allow it.\n');
  process.exit(1);
}

console.log(`LEXICON_PUNCTUATION ok (${total} semicolons, ${seen.length} on the reviewed allowlist)`);
