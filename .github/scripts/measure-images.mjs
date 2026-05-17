#!/usr/bin/env node
/**
 * Walk public/THE-LEXICON-ASSETS, read the JPEG/PNG/WebP header of each
 * image, and write { "path/to/img.jpg": { "w": 1234, "h": 1645 } } to
 * content/image-dimensions.json. Render code reads this so every <img>
 * ships with width/height attributes and the browser can reserve space —
 * eliminating Cumulative Layout Shift on first paint.
 *
 * Zero dependencies: parses image headers directly from the byte buffer.
 * Idempotent: re-running only touches images whose mtime is newer than
 * the existing dimensions entry. Skips files it can't parse with a warning.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS = join(ROOT, 'public', 'THE-LEXICON-ASSETS');
const OUT    = join(ROOT, 'content', 'image-dimensions.json');

function jpegDims(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xFF) return null;
    let marker = buf[i + 1];
    // Skip fill bytes
    while (marker === 0xFF && i + 2 < buf.length) { i++; marker = buf[i + 1]; }
    // SOF markers (Start of Frame) carry dimensions. Skip non-SOF and stand-alone markers.
    const isSOF = (marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isSOF) {
      if (i + 8 >= buf.length) return null;
      const h = (buf[i + 5] << 8) | buf[i + 6];
      const w = (buf[i + 7] << 8) | buf[i + 8];
      return { w, h };
    }
    // SOI (D8), EOI (D9), and RSTn (D0-D7) have no length field
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
    if (i + 3 >= buf.length) return null;
    const segLen = (buf[i + 2] << 8) | buf[i + 3];
    if (segLen < 2) return null;
    i += 2 + segLen;
  }
  return null;
}

function pngDims(buf) {
  if (buf.length < 24) return null;
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A, then IHDR chunk (length=13 at 8, type='IHDR' at 12, data starts at 16)
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function webpDims(buf) {
  // RIFF....WEBP, then a chunk. Support VP8, VP8L, VP8X.
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    // Lossy: at offset 26, 2 bytes width & height (with scale flags in top 2 bits)
    const w = buf.readUInt16LE(26) & 0x3FFF;
    const h = buf.readUInt16LE(28) & 0x3FFF;
    return { w, h };
  }
  if (chunk === 'VP8L') {
    // Lossless: 14-bit width-1 and height-1, packed
    const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
    const w = 1 + (((b1 & 0x3F) << 8) | b0);
    const h = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
    return { w, h };
  }
  if (chunk === 'VP8X') {
    // Extended: 24-bit width-1 and height-1 at offset 24
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { w, h };
  }
  return null;
}

function dimsFor(filePath) {
  const buf = readFileSync(filePath);
  return jpegDims(buf) || pngDims(buf) || webpDims(buf);
}

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else if (/\.(jpe?g|png|webp)$/i.test(name)) out.push(p);
  }
  return out;
}

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const files = walk(ASSETS);

let measured = 0, skipped = 0, failed = 0;
for (const filePath of files) {
  const rel = 'THE-LEXICON-ASSETS/' + filePath.slice(ASSETS.length + 1).replace(/\\/g, '/');
  const mtime = statSync(filePath).mtimeMs;
  if (existing[rel] && existing[rel].mtime === mtime) { skipped++; continue; }
  try {
    const d = dimsFor(filePath);
    if (!d || !d.w || !d.h) { console.warn('  WARN: could not parse ' + rel); failed++; continue; }
    existing[rel] = { w: d.w, h: d.h, mtime };
    measured++;
  } catch (e) {
    console.warn('  WARN: ' + rel + ' — ' + e.message);
    failed++;
  }
}

// Drop entries whose files no longer exist on disk
const fileSet = new Set(files.map(f => 'THE-LEXICON-ASSETS/' + f.slice(ASSETS.length + 1).replace(/\\/g, '/')));
let pruned = 0;
for (const k of Object.keys(existing)) {
  if (!fileSet.has(k)) { delete existing[k]; pruned++; }
}

writeFileSync(OUT, JSON.stringify(existing, null, 2) + '\n', 'utf8');

// Also emit a JS module for browser import — strip mtime (build-internal only).
const browserDims = {};
for (const [k, v] of Object.entries(existing)) browserDims[k] = { w: v.w, h: v.h };
const jsOut = join(ROOT, 'js', 'modules', 'image-dimensions.js');
const banner = `/**
 * AUTO-GENERATED by .github/scripts/measure-images.mjs.
 * Edit nothing here — re-run \`npm run measure-images\` to regenerate.
 * Used by render code to set width/height on <img> tags so the browser
 * can reserve space and avoid layout shift.
 */
`;
writeFileSync(jsOut, banner + 'export const imageDimensions = ' + JSON.stringify(browserDims, null, 2) + ';\n', 'utf8');

console.log(`LEXICON_MEASURE_IMAGES ok (${measured} measured, ${skipped} cached, ${failed} failed, ${pruned} pruned; total ${Object.keys(existing).length})`);
