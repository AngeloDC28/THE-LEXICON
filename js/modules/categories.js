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
