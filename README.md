# THE LEXICON

A forensic research archive of landmark runway collections — created by
Angelo Sanchez Dela Cruz for the rigorous audit of visual culture and
subcultural theory.

THE LEXICON is a high-density, relational digital archive mapping fashion,
politics, and media systems. Utilising an Acid Brutalist aesthetic, it
deconstructs runway moments into taxonomic nodes. Each entry catalogues a
single show across 9 taxonomy axes (brand, era, politics, theories,
gender, materials, geography, anatomy, format), with per-image annotated
hotspots and three structured critical notes (provenance, critique,
strategy). The project prioritises systemic clarity and archival
longevity — a clinical inquiry into subcultural history and visual syntax.

**Live site:** [thelexicon.xyz](https://thelexicon.xyz) (deployed via
GitHub Pages from `main`).

---

## Architecture in one paragraph

Static site. Vanilla ES modules + Tailwind via CDN. JSON files in
`content/` are the source of truth; small Node scripts in
`.github/scripts/` regenerate committed JS artifacts (`database.js`,
`js/modules/translations.js`, `js/modules/image-dimensions.js`) from
them. CI guards the build by re-generating and diffing — a stale
artifact blocks merge. No bundler at runtime; the browser loads the
modules directly.

## Local setup

```bash
git clone https://github.com/AngeloDC28/THE-LEXICON.git
cd THE-LEXICON
npm install                    # only needed for sharp (image optimizer) + vite
bash .githooks/install.sh      # one-time: enable repo git hooks (Windows: use Git Bash)
npm run dev                    # vite dev server with hot reload
```

No `npm install` is required just to *view* the site —
`python -m http.server 8000` in the repo root works too, since the
runtime is dependency-free.

## Adding a new entry

```bash
npm run new-entry galliano-dior-aw00    # scaffolds JSON + folder + order entry
# drop images into public/THE-LEXICON-ASSETS/galliano-dior-aw00/
# edit content/entries/galliano-dior-aw00.json (title, tags, notes, hotspots)
npm run optimize-images                  # resize >2400px + write WebP siblings
npm run preflight                        # sync keys + build + validate (always run before commit)
git add . && git commit -m "entry: ..."
```

See **REPORT.md** for the full workflow including translation and PR opening.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run preflight` | Full build + validation chain — run before every commit |
| `npm run check` | Schema + asset + translation validation only |
| `npm run new-entry <slug>` | Scaffold a new entry (JSON + folder + order) |
| `npm run optimize-images` | Resize huge images + generate WebP siblings |
| `npm run translate-content` | Fill missing translations via Anthropic or Gemini API |

## Further reading

- **[CLAUDE.md](CLAUDE.md)** — context for AI assistants (Claude Code, Cursor, etc.)
- **[REPORT.md](REPORT.md)** — current state, the full add-entry workflow, what's still rough
- **[content/entry.schema.json](content/entry.schema.json)** — canonical entry shape

---

## Ethical framework & licensing

THE LEXICON operates under a **Custom Archival License**.

This system is built on the principle of **Open Access for Humanity** — it
is free for researchers, students, and subcultural historians to access
and study. However, it explicitly **resists commercial extraction**.

- **Academic use**: Fully supported and encouraged.
- **Commercial use**: Requires a specific Commercial Protocol (Commercial
  License). Unauthorized use for trend forecasting, corporate strategy,
  or commercial AI training is strictly prohibited.

For more information on the systemic ethics of this archive, see the
[LICENSE](LICENSE) file.
