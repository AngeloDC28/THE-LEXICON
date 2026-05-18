import sharp from 'sharp';
import { renameSync, unlinkSync } from 'node:fs';
const ROOT = 'C:/Users/angel/THE-LEXICON/public/THE-LEXICON-ASSETS/';
const files = [
  'westwood-aw81/westwood-aw81-01.jpg',
  'westwood-aw81/westwood-aw81-02.jpg',
  'westwood-aw81/westwood-aw81-03.jpg',
  'westwood-aw81/westwood-aw81-04.jpg',
  'westwood-aw81/westwood-aw81-05.jpg',
  'mugler-aw95/mugler-aw95-12.jpg',
  'van-herpen-aw11/van-herpen-aw11-02.jpg',
];
for (const rel of files) {
  const f = ROOT + rel;
  const tmp = f + '.fixed.jpg';
  try {
    await sharp(f, { failOn: 'none' })
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toFile(tmp);
    renameSync(tmp, f);
    console.log('OK  ' + rel);
  } catch (e) {
    console.log('FAIL ' + rel + ': ' + e.message);
    try { unlinkSync(tmp); } catch {}
  }
}
