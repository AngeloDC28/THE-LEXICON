#!/usr/bin/env node
/**
 * resize-images.mjs
 *
 * Two jobs for every JPEG/PNG under public/THE-LEXICON-ASSETS:
 *
 *  1. Cap the full image at MAX_W × MAX_H (fit inside, never enlarge) and
 *     regenerate its .webp sibling to match. The archive used to serve
 *     1280×1920 originals; the Terms promise images "at a scale and
 *     resolution appropriate to critical analysis", which is part of the
 *     s.30 fair-dealing position, so the files have to actually match.
 *
 *  2. Write a THUMB_W-wide WebP thumbnail next to it (foo-01.jpg →
 *     foo-01.t480.webp). The grid, sidebar list, timeline, related entries
 *     and recently-viewed strip all load these instead of the full file.
 *
 * Idempotent by inspection, not by a manifest: an image already within the
 * cap is left byte-for-byte alone, and a thumbnail is only rewritten when it
 * is missing or older than its source. (The old mtime manifest in
 * optimize-images.mjs drifted every time git touched a file and re-encoded
 * hundreds of untouched images.)
 *
 *   node .github/scripts/resize-images.mjs           # resize + thumbnail
 *   node .github/scripts/resize-images.mjs --check   # verify only; exit 1 on
 *                                                    # a missing thumbnail or
 *                                                    # an oversized image
 *
 * --check runs in `npm run check` (and therefore in Vercel's build), so a
 * deploy can never reference a thumbnail that isn't there — a <picture>
 * <source> that 404s does not fall back to the <img>, it just shows nothing.
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS  = join(ROOT, 'public', 'THE-LEXICON-ASSETS');
const MAX_W   = 1000;
const MAX_H   = 1500;
const THUMB_W = 480;
const CHECK   = process.argv.includes('--check');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jpe?g|png)$/i.test(name)) out.push(p);
    // A .webp with no JPEG/PNG sibling is itself a source image (an entry can
    // reference one directly), so it needs capping and a thumbnail too.
    else if (/\.webp$/i.test(name) && !/\.t480\.webp$/i.test(name)
      && !['.jpg', '.jpeg', '.png'].some(ext => existsSync(p.replace(/\.webp$/i, ext)))) out.push(p);
  }
  return out;
}

const thumbOf = (p) => p.replace(/\.(jpe?g|png|webp)$/i, '.t480.webp');
const webpOf  = (p) => p.replace(/\.(jpe?g|png|webp)$/i, '.webp');
const isWebp  = (p) => /\.webp$/i.test(p);

const files = walk(ASSETS);
let sharp;
const problems = [];
let resized = 0, thumbs = 0, failed = 0;

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const thumb = thumbOf(file);

  if (CHECK) {
    if (!existsSync(thumb)) problems.push(`missing thumbnail: ${rel}`);
    continue;
  }

  if (!sharp) {
    sharp = (await import('sharp')).default;
    // libvips' cache keeps source files open; on Windows that makes
    // overwriting them fail with EPERM. Decode from memory instead.
    sharp.cache(false);
  }
  try {
    const input = readFileSync(file);
    const meta = await sharp(input, { failOn: 'none' }).metadata();
    if ((meta.width || 0) > MAX_W || (meta.height || 0) > MAX_H) {
      const pipeline = sharp(input, { failOn: 'none' }).rotate().resize({ width: MAX_W, height: MAX_H, fit: 'inside', withoutEnlargement: true });
      const out = isWebp(file)
        ? await pipeline.webp({ quality: 78, effort: 4 }).toBuffer()
        : /\.png$/i.test(file)
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
          : await pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer();
      writeFileSync(file, out);
      if (!isWebp(file)) writeFileSync(webpOf(file), await sharp(out).webp({ quality: 78, effort: 4 }).toBuffer());
      resized++;
    } else if (!existsSync(webpOf(file))) {
      writeFileSync(webpOf(file), await sharp(input, { failOn: 'none' }).webp({ quality: 78, effort: 4 }).toBuffer());
    }
    if (!existsSync(thumb) || statSync(thumb).mtimeMs < statSync(file).mtimeMs) {
      const src = readFileSync(file);
      writeFileSync(thumb, await sharp(src, { failOn: 'none' }).rotate().resize({ width: THUMB_W, withoutEnlargement: true }).webp({ quality: 72, effort: 4 }).toBuffer());
      thumbs++;
    }
  } catch (e) {
    failed++;
    problems.push(`could not process ${rel}: ${e.message}`);
  }
}

if (CHECK) {
  // Size cap: verify from the dimensions cache rather than decoding 600 files.
  const dims = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'content', 'image-dimensions.json'), 'utf8'));
  for (const [k, d] of Object.entries(dims)) {
    if (/\.t480\.webp$/.test(k)) continue;
    if (d.w > MAX_W || d.h > MAX_H) problems.push(`over ${MAX_W}×${MAX_H}: ${k} (${d.w}×${d.h})`);
  }
  if (problems.length) {
    console.error(`\nIMAGES: ${problems.length} problem(s):`);
    problems.slice(0, 30).forEach(p => console.error('  ' + p));
    if (problems.length > 30) console.error(`  … and ${problems.length - 30} more`);
    console.error('\nRun: node .github/scripts/resize-images.mjs  (then npm run measure-images)\n');
    process.exit(1);
  }
  console.log(`LEXICON_IMAGES ok (${files.length} images capped at ${MAX_W}×${MAX_H}, all with thumbnails)`);
} else {
  problems.forEach(p => console.warn('  ' + p));
  console.log(`LEXICON_RESIZE_IMAGES ok (${files.length} images: ${resized} resized, ${thumbs} thumbnails written, ${failed} failed)`);
  if (failed) process.exit(1);
}
