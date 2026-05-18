#!/usr/bin/env node
/**
 * One-off normalization script: ensures era and brand tag values exactly
 * match the taxonomy defined in js/modules/core-state.js so the filter
 * actually matches them. Safe to re-run.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES = join(ROOT, 'content', 'entries');

// Era: normalise en-dash to " to " and fix Schiaparelli's mismatch
const eraFixes = [
  [/"era":\s*"1980–1989; The Post-Modern Shift"/g,
   '"era": "1980 to 1989; The Post-Modern Shift"'],
  [/"era":\s*"1990–1999; The Deconstructionist Decade"/g,
   '"era": "1990 to 1999; The Deconstructionist Decade"'],
  [/"era":\s*"2000–2009; The Global Conglomerate Era"/g,
   '"era": "2000 to 2009; The Global Conglomerate Era"'],
  [/"era":\s*"2010–2019; The Digital and Streetwear Pivot"/g,
   '"era": "2010 to 2019; The Digital and Streetwear Pivot"'],
  [/"era":\s*"2020–Present; The Post-Pandemic Era"/g,
   '"era": "2020 to Present; The Post-Pandemic and Surrealist Current"'],
  [/"era":\s*"2020–Present; The Post-Pandemic and Surrealist Current"/g,
   '"era": "2020 to Present; The Post-Pandemic and Surrealist Current"'],
];

// Brand: split composite "Brand | Designer" into canonical brand only.
// (Designer name is already in subtitle/title where appropriate.)
const brandFixes = [
  [/"brand":\s*"Christian Dior \| John Galliano"/g, '"brand": "Christian Dior"'],
  [/"brand":\s*"Comme des Garçons \| Rei Kawakubo"/g, '"brand": "Comme des Garçons"'],
  [/"brand":\s*"Schiaparelli \| Daniel Roseberry"/g, '"brand": "Schiaparelli"'],
];

let changed = 0;
const files = readdirSync(ENTRIES).filter(f => f.endsWith('.json') && !f.startsWith('_'));
for (const f of files) {
  const path = join(ENTRIES, f);
  const before = readFileSync(path, 'utf8');
  let after = before;
  for (const [re, rep] of [...eraFixes, ...brandFixes]) after = after.replace(re, rep);
  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    console.log('  ✓ normalized ' + f);
    changed++;
  }
}
console.log(`\nNormalised ${changed} of ${files.length} entries.`);
