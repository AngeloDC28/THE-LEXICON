#!/usr/bin/env node
/**
 * Optimise every JPEG/PNG under public/THE-LEXICON-ASSETS in-place:
 *   - Resize to max 2400px wide (preserves aspect ratio; smaller untouched).
 *   - Re-encode JPGs with mozjpeg @ quality 82, progressive scan, chroma sub-
 *     sampling 4:2:0 — visually lossless at this size, typically 30–50% smaller.
 *   - Re-encode PNGs with zlib compression level 9, no metadata.
 * Also writes a sibling .webp at quality 78 for future <picture>/srcset use.
 *
 * Idempotent via a manifest at .image-optimize-manifest.json tracking each
 * file's mtime — already-optimised files are skipped unless they've changed.
 * Run `npm run optimize-images` (separate from prebuild; this is a one-shot
 * heavy pass). After running, remember to re-run measure-images so the
 * dimensions cache reflects the resized files.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT     = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS   = join(ROOT, 'public', 'THE-LEXICON-ASSETS');
const MANIFEST = join(ROOT, '.image-optimize-manifest.json');

const MAX_WIDTH = 2400;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 78;

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jpe?g|png)$/i.test(name)) out.push(p);
  }
  return out;
}

const files = walk(ASSETS);
console.log(`Scanning ${files.length} images...\n`);

let totalBefore = 0, totalAfter = 0, optimised = 0, skipped = 0, failed = 0;

for (const filePath of files) {
  const rel = filePath.slice(ASSETS.length + 1).replace(/\\/g, '/');
  const mtime = statSync(filePath).mtimeMs;
  if (manifest[rel] && manifest[rel].mtime === mtime) { skipped++; continue; }

  const sizeBefore = statSync(filePath).size;
  const ext = extname(filePath).toLowerCase();
  const webpPath = filePath.replace(/\.(jpe?g|png)$/i, '.webp');
  const tmpPath = filePath + '.tmp';

  try {
    const img = sharp(filePath, { failOn: 'none' });
    const meta = await img.metadata();
    const needsResize = meta.width && meta.width > MAX_WIDTH;
    const pipeline = needsResize
      ? sharp(filePath, { failOn: 'none' }).resize({ width: MAX_WIDTH, withoutEnlargement: true })
      : sharp(filePath, { failOn: 'none' });

    if (ext === '.png') {
      await pipeline.png({ compressionLevel: 9, palette: true }).toFile(tmpPath);
    } else {
      await pipeline.jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true, chromaSubsampling: '4:2:0' }).toFile(tmpPath);
    }

    // Only replace original if the new file is actually smaller — otherwise keep original.
    const sizeAfter = statSync(tmpPath).size;
    if (sizeAfter < sizeBefore) {
      renameSync(tmpPath, filePath);
    } else {
      unlinkSync(tmpPath);
    }

    // Sibling WebP — always written, since browsers prefer it when offered via <picture>.
    await (needsResize
      ? sharp(filePath, { failOn: 'none' }).resize({ width: MAX_WIDTH, withoutEnlargement: true })
      : sharp(filePath, { failOn: 'none' })
    ).webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(webpPath);

    const finalSize = statSync(filePath).size;
    const webpSize  = statSync(webpPath).size;
    totalBefore += sizeBefore;
    totalAfter  += finalSize;
    optimised++;

    const savedPct = Math.round((1 - finalSize / sizeBefore) * 100);
    const webpPct  = Math.round((1 - webpSize / sizeBefore) * 100);
    console.log(`  ${rel}  ${(sizeBefore/1024).toFixed(0)}K → ${(finalSize/1024).toFixed(0)}K (${savedPct >= 0 ? '-' : '+'}${Math.abs(savedPct)}%) + webp ${(webpSize/1024).toFixed(0)}K (-${webpPct}%)`);

    manifest[rel] = { mtime: statSync(filePath).mtimeMs, sizeOriginal: sizeBefore, sizeOptimized: finalSize, sizeWebp: webpSize };
  } catch (e) {
    console.warn(`  FAIL ${rel}: ${e.message}`);
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
    failed++;
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const totalSaved = totalBefore - totalAfter;
console.log(`\nLEXICON_OPTIMIZE_IMAGES ok (${optimised} optimised, ${skipped} cached, ${failed} failed)`);
console.log(`  before: ${(totalBefore/1024/1024).toFixed(1)} MB`);
console.log(`  after:  ${(totalAfter/1024/1024).toFixed(1)} MB`);
console.log(`  saved:  ${(totalSaved/1024/1024).toFixed(1)} MB (${Math.round(totalSaved/totalBefore*100)}%)`);
console.log(`  note: re-run \`npm run measure-images\` to refresh dimensions cache for resized files.`);
