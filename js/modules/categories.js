/**
 * categories.js
 * The six analytical axes: how an entry's politics tag maps to an axis, and
 * the one display name for each. No imports and no DOM access, so the build
 * scripts (static entry pages, designer/decade pages) use exactly the same
 * mapping as the browser.
 */

// Map politics tag text → analytical axis. Falls back to 'provenance'.
const TAG_CATEGORY_MAP = [
  { match: /corporeal|body politic|displaced anatomy|prosthetic/i, key: 'corporeal' },
  { match: /institutional critique|anti-consumer|class dynamics|labour politic/i, key: 'critique' },
  { match: /subcultur|queer theory|punk|gender deconstruction/i, key: 'subculture' },
  { match: /post-colonial|globalisation|cultural hybrid|racial identity/i, key: 'strategy' },
  { match: /techno-politic|surveillance|digital ident|ecological/i, key: 'semiotic' },
  { match: /feminist|the subverted gaze|censorship|activism/i, key: 'provenance' },
];

export function getTagCategory(politicsTag = '') {
  for (const { match, key } of TAG_CATEGORY_MAP) {
    if (match.test(politicsTag)) return key;
  }
  return 'provenance';
}

// The one name for each analytical axis. Every surface that labels an axis
// reads from here — previously the grid said "CORPOREAL" / "PROVENANCE" while
// the entry page said "Corporeal Intervention" / "Historical Lineage".
export const CATEGORY_LABELS = {
  corporeal: 'Corporeal Intervention',
  critique: 'Institutional Critique',
  subculture: 'Subcultural Codification',
  strategy: 'Strategic Appropriation',
  semiotic: 'Semiotic Sabotage',
  provenance: 'Historical Lineage',
};

export function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || 'Analytical Record';
}

// Plain-English names for readers new to fashion theory. The theory name
// (CATEGORY_LABELS) stays as the subtitle so nothing is lost for experts.
// Titles describe what is actually filed under each axis by
// TAG_CATEGORY_MAP above: 'semiotic' collects techno-politics, surveillance
// and ecology, and 'provenance' is the fallback that holds the gaze and
// identity entries, so the plain names follow the contents, not the
// theory names.
export const CATEGORY_PLAIN = {
  corporeal:  { title: 'Changing the body',         blurb: 'Clothes that reshape, exaggerate or question what a "normal" body looks like.' },
  critique:   { title: 'Fashion vs. fashion',       blurb: 'Shows that mock, or protest against, the fashion industry itself.' },
  subculture: { title: 'Street to runway',          blurb: 'Youth culture, queer scenes and protest turned into designer clothes.' },
  strategy:   { title: 'Borders and belonging',     blurb: 'Migration, home and identity: what you carry with you, and who decides.' },
  semiotic:   { title: 'Technology and the future', blurb: 'Machines, screens and the planet: the body in a high-tech world.' },
  provenance: { title: 'Who is looking',            blurb: 'The gaze and identity: who clothes are made to be seen by.' },
};

export function categoryPlain(cat) {
  return CATEGORY_PLAIN[cat]?.title || 'Featured show';
}

// "SS" and "AW" are trade shorthand a newcomer won't know. Spell them out
// wherever a reader (not a table) sees them.
const SEASON_NAMES = { SS: 'Spring/Summer', AW: 'Autumn/Winter', FW: 'Autumn/Winter' };
export function seasonName(season = '') {
  const key = String(season).trim().toUpperCase();
  return SEASON_NAMES[key] || String(season).trim();
}

// The image to show when a look stands in for the whole show (backgrounds,
// thumbnails, link previews, feeds): the first look without a content note.
export function safeCover(entry) {
  const imgs = Array.isArray(entry?.images) ? entry.images : [];
  return imgs.find(im => im && !im.content_note) || imgs[0] || null;
}
