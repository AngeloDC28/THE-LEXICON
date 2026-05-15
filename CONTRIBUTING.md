# Contributing to THE LEXICON

## How to Add a New Archive Entry

The Lexicon's archive lives entirely in `database.js`. Every collection is a JavaScript object. Adding a new entry means adding one object to the `archiveData` array.

### Step 1 — Add the images

Create a subfolder inside `public/THE-LEXICON-ASSETS/` named after the entry ID (all lowercase, hyphens only):

```
public/THE-LEXICON-ASSETS/
  └── brand-seasonXX/
        ├── brand-seasonXX-01.jpg
        ├── brand-seasonXX-02.jpg
        └── NOTES.md        ← optional research notes
```

Image naming convention: `{entry-id}-{zero-padded-number}.jpg`  
Example: `mcqueen-aw01-01.jpg`, `mcqueen-aw01-02.jpg`

### Step 2 — Add the entry to `database.js`

Open `database.js` and add a new object inside the `archiveData` array. Copy the template below and fill in every field:

```js
{
  id: "brand-seasonXX",           // Unique ID. Must match your folder name exactly.
  brand: "Alexander McQueen",     // Must match a value from taxonomyData.brand in core-state.js
  title: "Collection Title",      // Short display title
  year: 2001,                     // Four-digit year (number, not string)
  season: "AW",                   // "SS" (Spring/Summer) or "AW" (Autumn/Winter)
  era: "2000 to 2009; The Global Conglomerate Era",  // Must match a value from taxonomyData.era
  politics: [                     // Array — choose from taxonomyData.politics
    "Queer Theory & Subcultural Systems"
  ],
  theories: [                     // Array — choose from taxonomyData.theories
    "Post-Human & Cyborg Theory"
  ],
  gender: [                       // Array — choose from taxonomyData.gender
    "Androgyny"
  ],
  materials: [                    // Array — choose from taxonomyData.materials
    "Leather"
  ],
  geography: [],                  // Array — choose from taxonomyData.geography
  format: [],                     // Array — choose from taxonomyData.format
  anatomy: [],                    // Array — choose from taxonomyData.anatomy
  description: "Your research text here. No character limit. Write forensically.",
  images: [
    { src: "/THE-LEXICON-ASSETS/brand-seasonXX/brand-seasonXX-01.jpg", caption: "Look 1 caption" },
    { src: "/THE-LEXICON-ASSETS/brand-seasonXX/brand-seasonXX-02.jpg", caption: "Look 2 caption" }
  ]
}
```

> ⚠️ **Image path rule**: All `src` values must start with `/THE-LEXICON-ASSETS/`. This is an absolute path from the site root. Do not use relative paths (`./`) or omit the leading slash — they will break.

### Step 3 — Valid taxonomy values

All filter fields must use values that exist in `taxonomyData` inside `js/modules/core-state.js`. Using a value not in the list means the entry won't appear when that filter is selected.

To add a brand not yet in the list: open `js/modules/core-state.js` and add it to `taxonomyData.brand` alphabetically, then add the same string to the relevant translation entries in `js/modules/translations.js`.

### Step 4 — Commit

```bash
git add public/THE-LEXICON-ASSETS/brand-seasonXX/ database.js
git commit -m "feat: add brand-seasonXX to archive"
git push origin main
```

GitHub Pages will deploy automatically within ~1 minute.

---

## Future Scalability Notes

As the archive grows past ~100 entries, consider splitting `database.js` into per-collection files:

```
js/data/
  mcqueen-ss99.js
  mcqueen-aw01.js
  ...
```

Each file exports a single entry object. A central `index.js` lazy-loads them:

```js
// js/data/index.js
export async function loadEntry(id) {
  const mod = await import(`./${id}.js`);
  return mod.default;
}
```

This reduces initial page load time significantly. A migration script can be written to split the current `database.js` automatically when ready.

---

## Checklist Before Pushing

- [ ] Entry `id` is unique (search `database.js` for duplicates)
- [ ] Folder name matches `id` exactly (case-sensitive)
- [ ] All image `src` values start with `/THE-LEXICON-ASSETS/`
- [ ] All taxonomy values match entries in `core-state.js`
- [ ] Images are JPG, ideally under 600KB each (run through [Squoosh](https://squoosh.app/) if needed)
- [ ] `brand` field matches the taxonomy list exactly (spelling, accents, capitalisation)
