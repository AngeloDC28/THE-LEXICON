# THE LEXICON — Maintainability Report

A practical assessment of how the project is currently structured, where it breaks under change, and how to ingest new entries safely.

The recommendations are grouped by impact. Each one ends with a "do this" line so you can act on it without re-reading the whole document.

---

## 1. What's painful right now

Concrete failures observed in this codebase, in order of how badly they slow you down:

### 1.1 One ~4,800-line `database.js` holds every entry
All 15 entries live in a single `export const archiveData = [...]`. Adding entry #16 means:
- Edit the same file two contributors touched yesterday → merge conflict every time.
- Reviewing a PR shows a 200-line diff of new content + accidental whitespace shifts in unrelated entries.
- A single trailing comma or unescaped quote (we hit exactly this on `translations.js:1238` earlier) takes down the entire app — there's no per-entry isolation.
- Git blame becomes useless: every entry was "added in commit X that touched 4 entries".

### 1.2 No schema validation
An entry can ship with `year: "1999"` (string) instead of `1999` (number), a missing `tags.brand`, or an image path with a typo, and nothing complains until the page renders blank. There's no canonical definition of what fields are required.

### 1.3 Translations are a wall of text
`translations.js` is 1,500+ lines of 12-language key/value pairs in one file. We already hit one bug here (unescaped `"` inside a Chinese string crashed the whole module). Maintaining 12 languages by hand is unsustainable — most edits to English never propagate.

### 1.4 No automated check before deploy
Until I added `npm run check` this session, nothing ran `node --check` on the source. Both prior bugs (duplicate import in `search-engine.js`, broken quote in `translations.js`) would have been caught by a 5-second script.

### 1.5 No CI
GitHub Pages auto-deploys from `main`. If you push broken code, the live site breaks. No build step verifies anything first.

### 1.6 Asset workflow is ad-hoc
Images live at `public/THE-LEXICON-ASSETS/<entry-id>/<entry-id>-NN.jpg`. The pattern is right, but there's no:
- Image optimization (each JPG ships at its source resolution).
- Width/height generation (causes layout shift).
- Sanity check that every `images[].src` in `database.js` actually exists on disk.

### 1.7 Data redundancy in entries
Each entry has both `images[0].src` AND a top-level `imageUrl` (always the same value), plus a top-level `hotspots: []` (always empty — real hotspots live inside `images[]`). New entries copy this redundancy because they're copy-pasted from old ones.

---

## 2. Recommended workflow changes

These are ordered by **effort vs. payoff**. The top three give you 80% of the safety with under an hour of work.

### 2.1 ✅ DONE: `npm run check` (parse + duplicate-import scan)
Already wired up — runs in `prebuild`. Treat it as the minimum bar.

### 2.2 Add CI on every PR (15 minutes)
Create `.github/workflows/check.yml`:
```yaml
name: check
on: [pull_request, push]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci || npm install --no-audit
      - run: npm run check
      - run: node .github/scripts/validate-entries.mjs   # see §3.3
      - run: node .github/scripts/check-assets.mjs       # see §3.4
```
**Do this**: any PR that fails the checks is blocked from merging. The deploy workflow only fires after green.

### 2.3 Split `database.js` into per-entry files (30 minutes — biggest single win)
Move to:
```
content/
  entries/
    mcqueen-ss99.json
    mugler-aw95.json
    ...
  index.js              ← imports every JSON and re-exports archiveData
```
Then `database.js` becomes:
```js
export { archiveData } from './content/index.js';
```
Benefits:
- One entry = one file = one PR. Zero merge conflicts.
- `git log content/entries/mcqueen-ss99.json` tells the actual history of that entry.
- Per-entry schema validation is trivial (next item).
- Each file is JSON, not JS — eliminates entire classes of bugs (no quote escaping, no trailing commas with Node parsing).

**Do this** even if you do nothing else from this report.

### 2.4 Add a JSON schema + validator (`content/entry.schema.json`)
Define the shape of an entry once. Run `ajv` or similar to validate every file in `content/entries/` during `npm run check`. A first cut:
```json
{
  "type": "object",
  "required": ["id", "title", "year", "season", "images", "tags", "notes"],
  "properties": {
    "id":       { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "title":    { "type": "string", "minLength": 3 },
    "subtitle": { "type": "string" },
    "year":     { "type": "integer", "minimum": 1800, "maximum": 2100 },
    "season":   { "enum": ["SS", "AW", "Cruise", "Pre-Fall", "Couture-SS", "Couture-AW"] },
    "images": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["src"],
        "properties": {
          "src":      { "type": "string", "pattern": "^THE-LEXICON-ASSETS/" },
          "hotspots": { "type": "array", "items": { "$ref": "#/definitions/hotspot" } }
        }
      }
    },
    "tags": {
      "type": "object",
      "required": ["brand", "era", "politics", "theories", "gender", "materials", "geography", "anatomy", "format"],
      "additionalProperties": false,
      "properties": { /* enum each one against your taxonomy values */ }
    },
    "notes": {
      "type": "object",
      "required": ["provenance", "strategy", "critique"],
      "properties": {
        "provenance": { "type": "string", "minLength": 50 },
        "strategy":   { "type": "string", "minLength": 50 },
        "critique":   { "type": "string", "minLength": 50 }
      }
    }
  },
  "definitions": {
    "hotspot": {
      "type": "object",
      "required": ["x", "y", "label", "description"],
      "properties": {
        "x":           { "type": "number", "minimum": 0, "maximum": 100 },
        "y":           { "type": "number", "minimum": 0, "maximum": 100 },
        "label":       { "type": "string", "minLength": 3 },
        "description": { "type": "string", "minLength": 30 }
      }
    }
  }
}
```
**Do this**: every PR fails fast if the entry shape is wrong, with a clear error pointing at the field.

### 2.5 Drop the redundant fields from the entry shape
`imageUrl` and the top-level `hotspots: []` can both be removed. Render code already prefers `images[0]` and per-image hotspots. Tightening the schema prevents new entries from copying them.

**Do this** in the same PR as §2.3 — much easier to do when entries are individual files.

### 2.6 Move translations to one file per language
`content/translations/en.json`, `fr.json`, etc. Plus a `keys.schema.json` that every language file must satisfy. A missing key in `ja.json` fails CI instead of silently rendering `undefined`. The bug we hit (a quote inside `zh`) would have been impossible because JSON parsing rejects it before commit.

### 2.7 Asset pipeline (one prebuild script)
`.github/scripts/build-assets.mjs`:
1. For each entry, ensure `public/THE-LEXICON-ASSETS/<id>/` exists and every `images[].src` resolves to a file (already partly checked in §3.4 below).
2. Generate WebP siblings + a `.dimensions.json` for each image (width/height) so `<img>` can ship with explicit dimensions → no layout shift.
3. If a source image is over (say) 2400px wide, write a downscaled version.

Optional but high-impact: a single `sharp` call per image is the whole script.

---

## 3. The "add a new entry" workflow

Here's the **best method**, end to end. Pick the path that fits your skill level.

### Path A (for non-developers / curators) — Web form
Build a small static HTML form (no backend needed) that:
1. Lets the curator fill out the schema fields, drop images, click hotspots on each image preview (saves x/y as percentages).
2. Emits a single `.json` file matching the schema.
3. They commit that file to a branch and open a PR. CI validates.

This is realistic — the form is one HTML page + ~300 lines of JS. Worth building once when you cross 50 entries.

### Path B (for developers) — Direct PR
Today, this is the path. Tightened up:

```bash
# 1. Create branch
git checkout -b entry/galliano-dior-aw00

# 2. Drop images into the right folder
mkdir public/THE-LEXICON-ASSETS/galliano-dior-aw00
# copy galliano-dior-aw00-{01..16}.jpg into that folder

# 3. Create the entry JSON
cp content/entries/_template.json content/entries/galliano-dior-aw00.json
# edit the new file

# 4. Local validation (fails fast, ~3 seconds)
npm run check
npm run validate              # ajv against entry.schema.json
npm run check-assets          # every images[].src exists on disk

# 5. Local visual check
npm run dev                   # or python -m http.server
# open localhost, confirm new entry shows in grid and detail

# 6. Push + open PR
git push -u origin entry/galliano-dior-aw00
gh pr create --title "entry: Galliano for Dior AW00" --body "Adds entry #16. Six hotspots across 12 images."
```

CI runs `npm run check`, schema validation, asset existence check, and (if you want) a Playwright smoke test that loads the page and visits the new entry's detail. PR review focuses on the *content* (is the critique well-written?), not on the *shape* (the schema enforced that).

### Path C (bulk / migration) — Scripted
If a researcher delivers a CSV/spreadsheet of 30 entries at once, write a one-off `.github/scripts/import-batch.mjs` that converts rows → JSON files and runs validation on each. Don't try to bulk-edit `database.js` by hand.

---

## 4. Concrete next steps (suggested order, ~half a day total)

1. **`content/entries/_template.json`** — copy from `mcqueen-ss99` with empty fields. Anyone adding an entry starts from this file.
2. **Split `database.js`** into one JSON file per entry under `content/entries/`. The dynamic loader (`content/index.js`) is ~10 lines.
3. **`entry.schema.json`** + `validate-entries.mjs` — using `ajv`. Add `npm run validate` to `prebuild` alongside `check`.
4. **`check-assets.mjs`** — walk every `images[].src` in every entry file, assert the file exists. Five lines of Node.
5. **GitHub Actions workflow** (§2.2) — block merge if any of the above fails.
6. **Drop `imageUrl` + top-level `hotspots: []`** from the schema and entry files in the same PR. Refactor render code to stop referencing them.
7. **Split translations** into per-language JSON. Optional but pays dividends fast as translations drift.
8. (Later, if entry volume grows) build Path A's web form.

---

## 5. What I'm explicitly NOT recommending

A few "improvements" that look tempting but aren't worth the disruption right now:
- **Don't introduce a framework** (React/Vue/Svelte). The vanilla ES-modules + Tailwind CDN setup loads in <1s and is easy to onboard to. Tooling pain is more than tooling gain at this size.
- **Don't move to a CMS** (Contentful / Sanity) until you have 50+ entries AND multiple non-technical contributors. JSON in git is more durable and faster to query than any hosted CMS.
- **Don't rewrite `database.js` as a generated artifact from a separate source of truth (e.g. Airtable)** unless you have a strong reason. Git-as-database is fine here.
- **Don't add ESLint/Prettier yet.** The `npm run check` script catches the bugs that have actually bitten you. ESLint adds a config-bikeshed; revisit only if you grow past three contributors.

---

## 6. Summary table

| Risk today | Fix | Effort | Where |
|---|---|---|---|
| One file = all entries → merge conflicts | Split into `content/entries/*.json` | 30 min | §2.3 |
| No schema → typos render broken | `entry.schema.json` + ajv | 1 hr | §2.4 |
| Broken JS deploys live | `npm run check` (DONE) + GH Actions | 15 min | §2.1, §2.2 |
| Asset paths can rot | `check-assets.mjs` in CI | 10 min | §3.4 (in template above) |
| Translations rot silently | Per-language JSON + schema | 1 hr | §2.6 |
| Curators can't contribute | Web form generating JSON | 1 day (later) | Path A |

The first three rows alone, combined, turn "you can break prod with a typo in a translation string" into "CI catches it in 30 seconds and you fix the PR." That's the whole goal.
