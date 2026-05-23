# CLAUDE.md

Context for AI assistants (Claude Code, Cursor, etc.) working on THE LEXICON.
Read this first. It will save you 10 minutes of orientation and prevent whole
classes of dumb suggestions.

## What this project is

THE LEXICON is a static research archive of landmark runway collections,
annotated for forensic visual / cultural analysis. Each entry has:
- a stack of images (5–16 per show)
- per-image **hotspots** with `x/y` percentage coords + label + analytical
  description (typically 3 per image)
- three structured **notes** (provenance, critique, strategy) per entry
- a **tags** object across 9 taxonomy axes (brand, era, politics, theories,
  gender, materials, geography, anatomy, format)

Hosted on GitHub Pages. Vanilla ES modules + Tailwind via CDN. No build
step required for runtime — the browser loads the JS directly. Built
artifacts are committed (see below) so deploys are zero-config.

## Source-of-truth rules (LOAD-BEARING — read carefully)

JSON files in `content/` are the source of truth. The JS files they
generate are committed alongside them but **NEVER hand-edit**:

| Source (edit this)                     | Built artifact (DO NOT edit)           |
|---|---|
| `content/entries/*.json`               | `database.js`                          |
| `content/translations/<lang>.json`     | `js/modules/translations.js`           |
| (image headers via measure-images)     | `js/modules/image-dimensions.js`       |
| `content/order.json`                   | (controls grid display order)          |

If you change a JSON source, regenerate via `npm run build-data` /
`build-translations` / `measure-images` — or just `npm run preflight`
which runs them all in order.

## Commands you need to know

| Command                       | What it does                                                    |
|---|---|
| `npm run check`               | Parse + duplicate-import + schema + asset + translation checks  |
| `npm run preflight`           | sync-content-keys → build-data → build-translations → measure-images → check (run before every commit) |
| `npm run new-entry <slug>`    | Scaffold a new entry JSON + folder + order registration         |
| `npm run sync-content-keys`   | Walk entries → add new English strings as keys in en.json       |
| `npm run translate-content`   | Fill missing keys in <lang>.json via Anthropic or Gemini API    |
| `npm run optimize-images`     | Resize >2400px + write WebP siblings + re-measure dimensions    |
| `npm run build-data`          | Regenerate database.js from content/entries/                    |
| `npm run build-translations`  | Regenerate translations.js from content/translations/           |
| `npm run measure-images`      | Refresh image dimensions cache (header-parse, zero-dep)         |
| `npm run dev`                 | Vite dev server (hot reload — preferred over python http.server) |

## Conventions

- **Editorial English string === translation key.** Hotspot labels, hotspot
  descriptions, note paragraphs, entry titles — all of them are looked up
  via `getTranslation(rawEnglishString, lang)`. Falls back to English if
  no translation exists. Don't invent intermediate keys for editorial text.
- **UI strings use semantic keys** (`btn_save_folder`, `nav_about`, etc.) —
  short, namespaced by surface.
- **Schema is strict.** `entry.schema.json` has `additionalProperties: false`.
  Don't add fields without updating the schema.
- **Browser auto-translate is the primary path for editorial content** in
  non-English locales. `<html lang="en">` is set so browsers offer
  translation. The per-language JSON files cover UI strings and any
  editorial strings that have been pre-translated.
- **Zero npm dependencies for build scripts** by default. `sharp` and
  `firebase` are exceptions justified by their use case. Don't reach for
  npm packages when 50 lines of vanilla Node will do.
- **CI guards stale builds.** GitHub Actions runs `npm run check` and
  also diffs `database.js` and `translations.js` against their sources —
  a stale artifact fails the build. Always run `preflight` before committing.
- **Image naming**: `<entry-slug>-<NN>.jpg` (or .png), two-digit zero-padded.
  The optimizer writes `.webp` siblings; render code prefers WebP via
  `<picture>` with JPG fallback.

## Never do these

- Hand-edit `database.js`, `js/modules/translations.js`, or
  `js/modules/image-dimensions.js` — they're auto-generated.
- Skip `npm run check` (or `preflight`) before committing.
- Add a heavy npm dependency without flagging the trade-off first.
- Commit `.image-optimize-manifest.json` (it's gitignored — local cache only).
- Commit secrets / API keys. The translate-content script reads keys from
  env vars only; never inline them in source or commit messages.
- Force-push to `main`.
- Bypass git hooks (`--no-verify`) without explaining why.
- Use `npm run build` (it invokes vite build for the SPA path — only used
  if/when we move to a bundled deploy; not the primary path today).

## Style notes (from past sessions with the maintainer)

- The maintainer prefers terse, opinionated answers. Pick a path; don't
  enumerate options unless asked.
- Match scope to what was requested. A bug fix doesn't need surrounding
  cleanup; one-shot operations don't need helpers.
- Commit at logical break points and push to main. Don't batch giant
  end-of-session megacommits.
- The site uses brutalist / forensic-archive design language — acid
  yellow `#CCFF00` is the accent, monospace fonts, harsh borders. Don't
  soften the aesthetic without asking.
- Use the existing scripts in `.github/scripts/` as a style template
  when adding new ones — frontmatter comment explaining purpose, zero
  deps when possible, idempotent, resumable.

## Redesign roadmap

THE LEXICON is undergoing a major redesign to position it as a **research terminal** rather than a fashion blog. Full strategy documented in `thelexicon-code-review-v2.md` and visual mockups in `*.png` files.

### Phase 1: Front door redesign (2–3 weeks, current)
- [ ] Fluid type system: CSS `clamp()` variables for all `font-size` declarations
- [ ] Inverted metadata hierarchy: Analytical tag → designer → year/season → hook on all cards
- [ ] Microcopy audit: Update labels, headers, error messages per spec
- [ ] GDPR cookie control: Add Reject button to consent banner
- [ ] Keyboard shortcuts: `?` (help), `/` (search), `V` (visual mode), `I` (index mode)

### Phase 2: Research instrument (4–6 weeks)
- Brutalist Index View: Text-only sortable table mode with keyboard navigation
- Command palette: `⌘K` / `Ctrl+K` with type-ahead and boolean operators
- Multi-select filters: URL-encoded, shareable filter combinations
- WCAG 2.2 AA accessibility audit and fixes
- Mobile bottom-sheet filters
- Saved searches (authenticated)

### Phase 3: Entry architecture (6–8 weeks)
- Per-entry routes: Move from SPA modals to `/entry/{slug}` with SSR + JSON-LD
- Three-column reading layout: Sticky metadata rail | prose | Nexus preview
- Print stylesheet: Reader-friendly PDF output
- Citation export (Chicago, MLA, APA, Harvard, BibTeX)
- Nexus graph visualization: D3 force-directed with Timeline and List views

### Phase 4: Editorial & business (ongoing)
- MDX/CMS editorial pipeline
- Subscription tiers + Stripe
- Print quarterly product
- Institutional licensing

**Reference:** See `thelexicon-code-review-v2.md` for complete specifications, HTML contracts, and accessibility requirements. Each mockup HTML file (01–08) can be opened in a browser to see the proposed design.

## Where to learn more

- **REPORT.md** — current state of the site, what's done, what's still rough,
  the full "add a new entry" workflow with every step.
- **content/entry.schema.json** — canonical entry shape.
- **content/translations/en.json** — every translatable string in the app.
- **.github/scripts/** — all the build/check scripts, each with a header
  comment explaining its purpose.
- **thelexicon-code-review-v2.md** — full redesign specification with phase roadmap
- **01–08 mockups** — visual reference for each major view and feature
