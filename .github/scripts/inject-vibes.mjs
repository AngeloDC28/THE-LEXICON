#!/usr/bin/env node
/**
 * inject-vibes.mjs
 * Adds a top-level "vibes" array to every entry JSON file.
 * Run once: node .github/scripts/inject-vibes.mjs
 * Idempotent — skips entries that already have vibes.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENTRIES = join(ROOT, 'content', 'entries');

// Hand-curated vibe tags per entry.
// Keys match JSON filenames (without .json).
const VIBES = {
  'ackermann-aw14':      ['gender fluidity', 'body as architecture', 'dark minimalism', 'queer elegance', 'sculpted silhouette'],
  'adrover-aw00':        ['dumpster couture', 'anti-fashion', 'camp maximalism', 'reclaimed luxury', 'queer provocation'],
  'anderson-aw22':       ['surreal objects', 'gender bending', 'art-fashion crossover', 'body horror chic', 'conceptual weird'],
  'balenciaga-ss07':     ['techno future', 'cyborg glamour', 'sleek dystopia', 'digital body', 'speed dressing'],
  'bottega-veneta-aw19': ['quiet luxury', 'stealth wealth', 'armour dressing', 'old money minimalism', 'power dressing'],
  'browne-aw12':         ['dark academia', 'gothic tailoring', 'the uncanny', 'macabre prep', 'deconstructed classic'],
  'celine-ss10':         ['minimalist chic', 'quiet luxury', 'power dressing', 'intellectual cool', 'effortless restraint'],
  'chalayan-aw00':       ['cultural diaspora', 'identity in cloth', 'political fashion', 'wearable concept', 'heritage tension'],
  'chanel-aw14':         ['feminist protest', 'power suiting', 'logo maximalism', 'chanel irony', 'political runway'],
  'chromat-ss20':        ['body positivity', 'inclusive glamour', 'queer celebration', 'sport meets couture', 'activist fashion'],
  'coperni-ss23':        ['viral moment', 'spray-on fashion', 'techno spectacle', 'body meets material', 'live performance fashion'],
  'galliano-dior-ss00':  ['poverty chic', 'theatrical excess', 'romantic decay', 'beggar couture', 'operatic drama'],
  'garcons-ss97':        ['body horror', 'anti-beauty', 'lumps and bumps', 'grotesque chic', 'deconstructed form'],
  'gaultier-ss94':       ['global mash-up', 'multicultural camp', 'corsetry as outerwear', 'gender play', 'carnival fashion'],
  'givenchy-aw15':       ['riccardo tisci gothic', 'street meets couture', 'religious imagery', 'dark romance', 'urban tribe'],
  'green-ss15':          ['raw menswear', 'vulnerable masculinity', 'workwear deconstructed', 'emotional tailoring', 'bare minimum'],
  'gucci-aw18':          ['maximalist chaos', 'geek chic', 'cyborg kitsch', 'aesthetic overload', 'postmodern mix'],
  'hood-by-air-ss14':    ['ballroom culture', 'streetwear elevated', 'queer underground', 'logo subversion', 'ghe20goth1k'],
  'klein-aw17':          ['activist runway', 'black excellence', 'intersectional fashion', 'protest dressing', 'community as model'],
  'lang-aw98':           ['quiet luxury', 'intellectual minimalism', 'anti-fashion fashion', 'stealth wealth', 'cerebral cool'],
  'loewe-ss23':          ['trompe loeil', 'hyperrealism', 'internet brain', 'glitch aesthetic', 'absurdist surrealism'],
  'margiela-aw00':       ['deconstructed tailoring', 'anti-fashion', 'found material', 'artisan concept', 'invisible brand'],
  'mcqueen-ss99':        ['cyborg body', 'post-human spectacle', 'dark theatrics', 'armour as skin', 'body as sculpture'],
  'miu-miu-ss22':        ['bimbo aesthetic', 'micro skirt', 'underdressed luxury', 'subversive femininity', 'sexy minimalism'],
  'miyake-ss99':         ['tech textiles', 'futurism in fabric', 'industrial poetics', 'body architecture', 'wearable engineering'],
  'moschino-aw14':       ['fast food camp', 'logo irony', 'consumer critique', 'fashion meme', 'kitsch maximalism'],
  'mugler-aw95':         ['cyborg glamour', 'armour dressing', 'body modification fashion', 'sci-fi couture', 'power silhouette'],
  'owens-ss14':          ['step dressing', 'human backpack', 'community runway', 'dark romanticism', 'anti-fashion spectacle'],
  'prada-ss96':          ['ugly beautiful', 'anti-pretty', 'intellectual camp', 'subverted feminine', 'retro-futurism'],
  'pugh-aw06':           ['sculptural excess', 'fantasy fashion', 'queer camp', 'wearable art', 'theatrical grotesque'],
  'saint-laurent-aw13':  ['rock and roll', 'hedi slimane skinny', 'androgyny', 'french cool', 'dark glam'],
  'sander-ss11':         ['radical minimalism', 'colour blocking', 'clean lines', 'intellectual simplicity', 'power dressing'],
  'schiaparelli-ss21':   ['surreal couture', 'trompe loeil', 'art fashion', 'body illusion', 'maximalist surrealism'],
  'serre-ss20':          ['eco dystopia', 'upcycled future', 'climate anxiety fashion', 'patchwork survival', 'apocalypse chic'],
  'simons-aw01':         ['rave culture', 'teen rebellion', 'hauntology fashion', 'subculture elevated', 'nineties nostalgia'],
  'undercover-ss03':     ['anti-war statement', 'punk deconstruction', 'political protest', 'dark romanticism', 'subculture chaos'],
  'valentino-aw22':      ['pink maximalism', 'inclusive couture', 'gender fluid glamour', 'monochrome statement', 'fashion as joy'],
  'van-herpen-aw11':     ['3d printed couture', 'biomimicry', 'techno organic', 'wearable science', 'cyborg nature'],
  'van-noten-ss15':      ['textile maximalism', 'print clash', 'artisanal luxury', 'global textile', 'painterly fashion'],
  'vetements-aw15':      ['demna irony', 'logo fatigue', 'normcore subverted', 'fashion meme', 'anti-fashion fashion'],
  'viktor-rolf-aw99':    ['conceptual couture', 'art installation fashion', 'wearable sculpture', 'labour of making', 'slowness as statement'],
  'vuitton-ss08':        ['marc jacobs camp', 'pop art fashion', 'luxury streetwear', 'logo maximalism', 'art collaboration'],
  'watanabe-aw15':       ['mathematical fashion', 'geometric precision', 'op art dressing', 'techno couture', 'structure over drape'],
  'westwood-aw81':       ['punk royalty', 'pirate chic', 'tartans and bondage', 'british subversion', 'dressing up as protest'],
  'yamamoto-aw98':       ['wabi-sabi fashion', 'imperfect beauty', 'japanese minimalism', 'dark romance', 'anti-fit'],
};

let updated = 0;
let skipped = 0;

for (const [slug, vibes] of Object.entries(VIBES)) {
  const path = join(ENTRIES, `${slug}.json`);
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.warn(`WARN: ${slug}.json not found — skipping`);
    continue;
  }

  const entry = JSON.parse(raw);
  if (entry.vibes) {
    skipped++;
    continue;
  }

  entry.vibes = vibes;
  writeFileSync(path, JSON.stringify(entry, null, 2) + '\n', 'utf8');
  updated++;
  console.log(`  + ${slug}: [${vibes.join(', ')}]`);
}

console.log(`\nINJECT_VIBES ok — updated ${updated}, skipped ${skipped} (already had vibes)`);
