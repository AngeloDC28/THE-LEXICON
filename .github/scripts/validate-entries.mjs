#!/usr/bin/env node
/**
 * Zero-dependency JSON-schema validator.
 *
 * Supports the subset of JSON Schema that content/entry.schema.json uses:
 *   type, required, properties, additionalProperties, items, minItems,
 *   minLength, minimum, maximum, pattern, enum, $ref (intra-file only).
 *
 * Good enough to catch every shape error we care about, without pulling
 * `ajv` into the dependency tree. If we ever outgrow it, swap the
 * validate() call for ajv.compile(schema) — the public interface is the
 * same (returns true/false, sets .errors).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT       = fileURLToPath(new URL('../../', import.meta.url));
const ENTRIES    = join(ROOT, 'content', 'entries');
const ORDER_FILE = join(ROOT, 'content', 'order.json');
const SCHEMA     = JSON.parse(readFileSync(join(ROOT, 'content', 'entry.schema.json'), 'utf8'));

function resolveRef(ref, root) {
  // only support intra-document refs like "#/$defs/hotspot"
  if (!ref.startsWith('#/')) throw new Error('unsupported $ref: ' + ref);
  return ref.slice(2).split('/').reduce((acc, k) => acc?.[k], root);
}

function validate(data, schema, path = '$', root = schema) {
  const errs = [];
  if (schema.$ref) schema = resolveRef(schema.$ref, root);

  if (schema.type) {
    const actual = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
    const expected = schema.type === 'integer' ? 'number' : schema.type;
    if (actual !== expected || (schema.type === 'integer' && !Number.isInteger(data))) {
      errs.push(`${path}: expected ${schema.type}, got ${actual}`);
      return errs; // bail early — type mismatch makes deeper checks noisy
    }
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errs.push(`${path}: ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
  }

  if (typeof data === 'string') {
    if (schema.minLength != null && data.length < schema.minLength) {
      errs.push(`${path}: string length ${data.length} < minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errs.push(`${path}: string does not match pattern /${schema.pattern}/`);
    }
  }

  if (typeof data === 'number') {
    if (schema.minimum != null && data < schema.minimum) errs.push(`${path}: ${data} < minimum ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum) errs.push(`${path}: ${data} > maximum ${schema.maximum}`);
  }

  if (Array.isArray(data) && schema.items) {
    if (schema.minItems != null && data.length < schema.minItems) {
      errs.push(`${path}: array length ${data.length} < minItems ${schema.minItems}`);
    }
    data.forEach((item, i) => errs.push(...validate(item, schema.items, `${path}[${i}]`, root)));
  }

  if (schema.type === 'object' && data && typeof data === 'object') {
    for (const req of schema.required || []) {
      if (!(req in data)) errs.push(`${path}: missing required property "${req}"`);
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const k of Object.keys(data)) {
        if (!(k in schema.properties)) errs.push(`${path}: unexpected property "${k}"`);
      }
    }
    if (schema.properties) {
      for (const [k, subSchema] of Object.entries(schema.properties)) {
        if (k in data) errs.push(...validate(data[k], subSchema, `${path}.${k}`, root));
      }
    }
  }

  return errs;
}

// --- run ---

if (!existsSync(ENTRIES)) {
  console.error('VALIDATE: no content/entries/ directory. Skipping.');
  process.exit(0);
}

const order = JSON.parse(readFileSync(ORDER_FILE, 'utf8'));
// Skip files prefixed with _ (templates, drafts) — they're not part of the live archive.
const files = readdirSync(ENTRIES).filter(f => f.endsWith('.json') && !f.startsWith('_'));

let failed = 0;
for (const file of files) {
  const id = file.replace(/\.json$/, '');
  const data = JSON.parse(readFileSync(join(ENTRIES, file), 'utf8'));
  const errs = validate(data, SCHEMA);

  // extra invariants that schema can't express on its own:
  if (data.id !== id) errs.push(`$.id: "${data.id}" must equal filename "${id}"`);
  if (!order.includes(id)) errs.push(`$: id "${id}" not present in content/order.json`);

  if (errs.length) {
    failed++;
    console.error(`\nFAIL ${file}`);
    for (const e of errs) console.error('  - ' + e);
  }
}

// orphans in order.json
const fileIds = new Set(files.map(f => f.replace(/\.json$/, '')));
for (const id of order) {
  if (!fileIds.has(id)) {
    failed++;
    console.error(`\nFAIL content/order.json: references "${id}" but no entry file exists`);
  }
}

if (failed) {
  console.error(`\nLEXICON_VALIDATE failed: ${failed} entry/entries failed validation`);
  process.exit(1);
}
console.log(`LEXICON_VALIDATE ok (${files.length} entries, ${order.length} ordered)`);
