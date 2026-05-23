# THE LEXICON
## Accessibility, UX & Homepage Redesign Brief — v2

*Updated to incorporate the brutalist index toggle, inverted metadata hierarchy, fluid typographic scaling, and deeper UX research across entry, search, and the Nexus.*

---

## 0. Position

The Lexicon is not a fashion blog and shouldn't behave like one. It is a *research terminal* — closer in spirit to JSTOR, the Warburg Institute's iconography database, or a Bloomberg Terminal than to a Pinterest board. The redesign holds that position while removing the unnecessary friction that was keeping civilians out.

The guiding principle is **two doors, one archive**. The visual front door (the new homepage) invites; the research terminal (the existing aesthetic, now sharpened) is where the actual work happens.

---

## 1. Diagnosis (carried forward from v1)

**Preserve:**
- The terminal / forensic / database aesthetic — it is the IP.
- The Provenance / Critique / Strategy editorial triad.
- The Nexus as a feature, name, and structural concept.
- The Cite This Entry academic-grade export.
- The London anchor and editorial voice inside entries.

**Fix:**
- Jargon density at first touch.
- Zero visible content above the fold.
- Status-signal copy that signals nothing useful.
- No alternative to the image-grid for screen-reader or low-bandwidth users.
- Cards that hide the institutional critique behind hover states.
- Static font sizes that break alignment between viewports.

---

## 2. The three new structural moves

### 2.1 The Brutalist Index Toggle

The image grid is a powerful seduction tool but a poor research tool. A serious archive needs a **stark, undeniable UI toggle** that switches the entire grid into a text-first Index View — dense, sortable, fully keyboard- and screen-reader-navigable.

**Specification:**

- **Placement.** Top-right of the archive header, always visible. Two adjacent buttons, equal visual weight:
  `[ VISUAL ]  [ INDEX ]`
  The active mode is filled white-on-black; the inactive is black-on-black with a 1px border. No icons — just words. Keyboard shortcut: `V` for Visual, `I` for Index.
- **Index View behaviour.** A monospaced data table. One row per entry. Columns: `ID · DESIGNER · YEAR · SEASON · SUBCULTURAL TAG · PROVENANCE · STATUS`. Sortable by any column. Filterable from the same control row as the grid. Each row is a focusable, clickable element with a visible focus ring.
- **Keyboard navigation.** `j`/`k` or arrow keys to move between rows. `Enter` opens the entry. `/` focuses search. `?` opens shortcut help. `Esc` exits search/filter back to row navigation.
- **Screen reader.** The table is marked up as a real `<table>` with `<thead>` / `<tbody>`, `scope="col"` on headers, and each row as a navigable `<tr>` with `role="link"` and `aria-label` summarising the entry.
- **Persistence.** Mode preference is stored in `localStorage` so a returning researcher lands in their preferred view.

This is the move that makes The Lexicon defensible as an academic instrument, not just a beautifully designed website.

### 2.2 Inverted Metadata Hierarchy

Traditional fashion media leads with the designer and the season. The Lexicon's editorial premise is that *the analytical category is the lens* — Corporeal Intervention, Semiotic Sabotage, Institutional Critique, Subcultural Codification. The card design must reflect this.

**Specification:**

- On every garment card, the **subcultural / analytical tag is visually equal to (or greater than) the designer's name.** No hover required. Both are present from first paint.
- Card layout, top to bottom:
  1. **Subcultural Tag** (large, eyebrow weight, accented colour) — e.g. *Corporeal Intervention*
  2. **Image** (4:5 ratio)
  3. **Designer · Year · Season** (small, monospace metadata)
  4. **Editorial hook** (one line, serif, the analytical claim of the entry)
- The accent colour used for the tag is part of a small, controlled palette mapped to category families (Provenance / Critique / Strategy each get a hue; subcategories share within). This creates instant visual scannability of the analytical landscape.
- Tags are clickable and act as filters: clicking *Semiotic Sabotage* filters the archive to all entries under that taxonomy.

This single change converts the archive from "pretty fashion grid" to "visible map of an editorial argument."

### 2.3 Fluid Typographic Scaling

Static `font-size: 16px` declarations break the strict grid alignment that gives The Lexicon its precision. Every text size in the system uses `clamp()`.

**Specification:**

A fluid type scale defined in CSS variables, used everywhere:

```css
:root {
  /* mono — UI chrome, metadata, IDs */
  --t-mono-xs:   clamp(0.625rem, 0.55rem + 0.18vw, 0.75rem);
  --t-mono-sm:   clamp(0.6875rem, 0.6rem + 0.2vw, 0.8125rem);
  --t-mono-base: clamp(0.75rem, 0.65rem + 0.25vw, 0.9375rem);

  /* serif — editorial prose, headlines */
  --t-body:      clamp(0.95rem, 0.85rem + 0.3vw, 1.0625rem);
  --t-lead:      clamp(1rem, 0.85rem + 0.55vw, 1.25rem);
  --t-h3:        clamp(1.25rem, 1rem + 0.9vw, 1.75rem);
  --t-h2:        clamp(1.5rem, 1.1rem + 1.4vw, 2.25rem);
  --t-h1:        clamp(2rem, 1.2rem + 3.2vw, 4.5rem);

  /* line lengths follow the scale */
  --measure:     clamp(54ch, 56vw, 68ch);
}
```

**Rules of use:**
- Headlines use `--t-h1` through `--t-h3` — no other sizes.
- Body prose uses `--t-body`; never inline `font-size`.
- The mono scale only ever appears on uppercase metadata, IDs, status bars, and UI chrome.
- Line-height pairs with the scale: tighter (1.05–1.15) for display, looser (1.5–1.6) for prose.
- Letter-spacing is set per-style, not inline.

Result: the typography flexes mathematically between a 360px phone and a 1920px display without a single media-query font-size override. The grid never breaks.

---

## 3. Homepage redesign (unchanged in shape, refined in detail)

The seven-change structure from v1 holds. The card updates apply the new metadata hierarchy. The hero uses fluid type. The footer carries a `[ VISUAL ] [ INDEX ]` mode toggle even on the homepage so researchers can jump straight to the index from the front door.

---

## 4. Entry pages — the real surface area

Most of the user's time will be spent inside a single entry, and the entry page is where the academic value either lands or evaporates. The current implementation puts all entries behind state toggles on one URL. **This must change.**

### 4.1 Architecture

Move from SPA-with-modals to:
- `/entry/{slug}` — each entry server-rendered, with its own `<title>`, OG image, canonical URL, JSON-LD (`CreativeWork` schema), and full body prose available to Google and to copy/paste citation.
- `/essays/{slug}` — long-form editorial.
- `/tag/{slug}` — every subcultural tag is its own page, listing entries.
- `/brand/{slug}`, `/year/{slug}`, `/movement/{slug}` — same pattern, every facet indexable.

This is the single most impactful technical change for long-term reach. Every entry becomes a Google-indexable destination for serious fashion-research queries.

### 4.2 Reading layout

A three-column layout at desktop, collapsing cleanly to one on mobile:

- **Left rail:** sticky metadata. Subcultural tag (large, accent colour), designer, year, season, location, photographer credit, source citations, contextual movements. A small `★ Save` and `Cite` button block lives at the bottom of the rail.
- **Centre:** the editorial. Reads in serif at a `--measure` line length. Three labeled sections — *Provenance · Critique · Strategy* — each with a sticky section anchor. Footnotes inline-expandable. Inline images are clickable into a lightbox with caption + photographer credit.
- **Right rail:** the Nexus preview. A miniature force-directed graph of this entry's connections, with a "Open full Nexus" button.

### 4.3 Reading affordances

- Reader-mode toggle (`R` on keyboard) hides both rails and presents the prose at full measure.
- Adjustable text size in reader mode (3 sizes, persistent).
- Sticky table-of-contents inside long entries.
- Print stylesheet (students will print these): clean typography, source URLs printed inline, no chrome.
- "Cite this entry" expands inline rather than opening a modal, with copy-to-clipboard buttons for Chicago, MLA, APA, Harvard, BibTeX, and Permalink.

### 4.4 The Nexus

The Nexus is the IP. It deserves its own treatment.

- A **force-directed graph** rendered with D3 (or a wrapper like react-force-graph). Nodes are entries; edges are relationships typed as *references / influences / responds to / appropriates / cites*.
- **Three views toggleable:** Graph (visual), Timeline (chronological), List (accessible default). The list view is what screen readers and the brutalist Index View use.
- Filterable by relationship type and by entry category.
- Zoom + pan with keyboard equivalents (`+` / `-` / arrow keys).
- Sharable URL — a Nexus view is a real page, e.g. `/nexus/mcqueen-ss99-13?depth=2&filter=influences`.

This is also the feature you can build a brand around: an annual "Nexus Map of [Year]" published as a print poster or interactive web essay is genuinely marketable.

---

## 5. Search & command palette

A research archive lives or dies by its search. Currently the site offers dropdown filters; this is necessary but insufficient.

**Add a command palette** invoked by `⌘K` / `Ctrl+K`:

- Type-ahead search across entries, designers, tags, movements, essays.
- Boolean operators for power users: `AND`, `OR`, `NOT`, `"exact phrase"`, `year:1999`, `tag:semiotic-sabotage`.
- Recent searches and saved searches.
- Direct jumps: "Go to ↗ McQueen SS99" / "Open Nexus ↗ Punk subculture".
- Keyboard-only, fully navigable with arrow keys + Enter.

The command palette is the single highest-impact UX addition for the research audience. It also signals "this is a serious tool" the moment someone discovers it.

---

## 6. Filtering — multi-select, range, shareable

The current single-select dropdowns are insufficient for the kind of cross-cutting queries researchers actually run. Replace with:

- **Multi-select chips** for brand, designer, tag, movement.
- **Range slider** for year (1850 → present, decade tick marks).
- **Combinable** — filters AND across categories, OR within a category.
- **Saved presets** — "My research: Margiela + deconstruction + 1990s" saved as a named filter.
- **URL-encoded** — every filtered view has a permalink, so a tutor can share *"these are the entries you should read this week"* as a single link.
- **Bottom-sheet on mobile** instead of dropdowns. Apply / Clear / Save buttons at the bottom.

---

## 7. The microcopy diff (carried forward, expanded)

| Location | Current | Replace with |
|---|---|---|
| Hero status | `ARCHIVE STATUS: STABLE` | (moved to archive route; homepage uses live counts) |
| Top bar | `CONNECTION_MATRIX_ALPHA` | `2,847 ENTRIES · 412 BRANDS · 38 MOVEMENTS` |
| Top bar | `v0.9.2` | `LAST UPDATE: {date}` |
| Nav | `FOLDERS` | keep + tooltip: *Your saved collections* |
| Nav | `ACCESS` | `SIGN IN` |
| Nav | `LANGUAGES ▾` | `EN ▾` |
| Filter clear | `[ CLEAR_FILTER ]` | `Clear` |
| Grid label | `ARCHIVE_GRID` | remove |
| Sort | `SORT: DEFAULT` | `Sort: Newest` |
| Mode toggle | (does not exist) | `[ VISUAL ] [ INDEX ]` |
| Orientation modal | "forensic audit of visual culture" para | "A research archive for fashion history and visual culture. We map how ideas move — references, garments, subcultures, and back again." |
| Nexus desc | "visualize connections between disparate artifacts" | "See how this entry connects to others — references, influences, lineage." |
| Sign in | `Terminal Access` | `Sign in` |
| Sign in | `Authenticate via 'Access'…` | `Sign in to save entries to your own folders.` |
| Sign in | `Link transmitted…` | `Sign-in link sent. Check your email.` |
| Empty | `0 Folders Initialized` | `Save your first entry to start a folder.` |
| Cookie | "persistent local storage… terminal state" | "We use cookies to keep your archive state and folders between visits." |
| Cookie | `Privacy · Terms · Accept` | `Privacy · Reject · Accept` (GDPR requires reject) |

---

## 8. Accessibility — WCAG 2.2 AA as the minimum

A research instrument with accessibility as an afterthought fails its own brief. The standard is WCAG 2.2 AA across the entire surface.

- **Contrast.** Body text minimum 4.5:1, large text 3:1. Decorative greys (`#666` and below) only on non-essential metadata. All interactive elements ≥3:1 against background.
- **Focus states.** Visible 2px white outline on every focusable element. Never `outline:none` without a replacement.
- **Icon-only controls** (`★ ◈ ▦ ◉`) all carry `aria-label`. Never icon-only without a text equivalent for screen readers.
- **Skip links.** Skip to archive, skip to search, skip to footer.
- **Reduced motion.** Respect `prefers-reduced-motion`. The Nexus graph defaults to a static layout when set.
- **Keyboard parity.** Every action achievable without a mouse, including the Nexus and image lightbox.
- **Forms.** Real `<label>` for every input. `aria-describedby` for help text. Error messages associated with fields.
- **Modals.** Focus trap, `aria-modal="true"`, escape closes, focus returns to the trigger.
- **Language.** `lang="en"` on `<html>`; locale-specific routes for translations.
- **Print stylesheet.** Entries print cleanly with URLs visible and chrome removed.

---

## 9. Performance — the archive is media-heavy by nature

- **Responsive images.** `<picture>` with `srcset` and `sizes`. AVIF first, WebP fallback, JPEG last.
- **Blur-up placeholders.** Use LQIP or BlurHash so the grid never shows hollow boxes.
- **Lazy-load** all below-fold imagery with `loading="lazy"` and `decoding="async"`.
- **Virtualised grid** once the archive exceeds ~200 entries on a single view (react-window or similar).
- **Subset webfonts** to Latin range; preload only the two weights used above the fold.
- **HTTP caching.** Long max-age on `/public/THE-LEXICON-ASSETS/*` with hashed filenames.
- **Service worker** for offline reading of saved entries — a high-perceived-value feature for researchers on trains and planes.

---

## 10. Internationalisation

The `LANGUAGES ▾` affordance indicates intent. Make it real:

- Locale-prefixed routes: `/`, `/fr/`, `/ja/`.
- `<link rel="alternate" hreflang="...">` in every head.
- `lang` attribute on every text block (a French quote inside an English entry should announce as French).
- The Lexicon's editorial register translates better than typical fashion-press prose, but allow per-locale editorial review before publishing translated entries.

---

## 11. Editorial pipeline

For sustainable content velocity:

- Source entries in **MDX or Markdown with frontmatter** for metadata (slug, designer, year, tag, movement, references, sources).
- A **headless CMS** layer (Sanity, Contentful, or Tina) for the writers who aren't going to learn Markdown.
- **Preview mode** so editors can read unpublished drafts at staging URLs.
- Source-of-truth in Git — the archive's prose is the asset, treat it like code.

---

## 12. Monetization architecture (extending v1)

The redesign should anticipate the business model, not retrofit it.

### 12.1 Subscription tiers

- **Free.** Browse all entries, read first paragraph of each, see full Nexus list view.
- **Member (£8/mo or £80/yr).** Read full entries, save folders, full Nexus graph view, citation export, command-palette search, Index View access, PDF/print export.
- **Institution (£600+/yr).** Multiple seats, IP-range authentication, branded folders, usage analytics, API read access. Sold to design schools (CSM, Parsons, RCA) and brand archives.
- **Patron (£500+).** Crediting on the site, early access to print products, an annual physical issue.

### 12.2 B2B research

A paid consultancy arm: brand archaeology, lineage reports, reference audits, costume-team research. The site's Methodology page is the marketing.

### 12.3 Print

A biannual print quarterly anchored in archive material. Production is expensive; cover price + advertising + Patron tier subsidise it. The physical object is also the most credible signal of editorial seriousness.

### 12.4 Events & education

Workshops on fashion research methodology, archive talks, in-person Nexus drawing nights. Partner with CSM/Parsons/RCA on student licences in exchange for guest lectureship.

### 12.5 Licensing & exhibitions

Once authority is established, museums and exhibitions pay to license curated Nexus views or methodology IP.

The redesign supports all of this without committing to it yet — the gate is a `members-only` flag on entries, the auth is a magic link that can extend to Stripe later, the API is a future read endpoint on the same data layer.

---

## 13. Phased implementation

**Phase 1 — Front door (2–3 weeks):**
- Hero rewrite, featured strip, microcopy diff
- Inverted metadata hierarchy on cards
- Cookie reject button
- Fluid typography variables across the stack
- Keyboard shortcuts: `?`, `/`, `V`, `I`

**Phase 2 — Research instrument (4–6 weeks):**
- Brutalist Index View
- Command palette (`⌘K`)
- Multi-select filters with URL encoding
- A11y audit pass to WCAG 2.2 AA
- Mobile bottom-sheet filters

**Phase 3 — Entry architecture (6–8 weeks):**
- Per-entry routes with SSR + JSON-LD
- Reading layout (three-column, reader mode, print CSS)
- Citation export inline
- Nexus graph (force-directed) + List + Timeline views

**Phase 4 — Editorial & business (ongoing):**
- MDX/CMS pipeline
- Subscription tiers + Stripe
- Print product
- Institutional licensing

---

## 14. Implementation prompt (updated)

*Paste into Cursor / Claude Code / v0 / hand to a developer.*

---

> **Project:** The Lexicon — accessibility, UX, and homepage refactor (v2).
>
> **Stack assumed:** Next.js (App Router), TypeScript, Tailwind or vanilla CSS with CSS variables, MDX for content, D3 (or react-force-graph) for the Nexus.
>
> **Core principle:** Two doors, one archive. Preserve the terminal/research aesthetic; add a welcoming homepage and a brutalist text-only Index View for academic use.
>
> **Typography system.** Implement the fluid type scale via CSS variables using `clamp()` (mono and serif scales, see brief §2.3). Never declare a static `font-size` outside the variables.
>
> **Homepage requirements:**
> 1. Hero with the headline *"See where every fashion idea actually came from"*, subhead, two CTAs (`Browse the Archive` primary, `Enter Research Terminal` secondary). Hero rotates 4–5 featured entries with image + editorial caption.
> 2. Featured Entries strip — 4 cards using the inverted metadata hierarchy: subcultural tag at top in accent colour, image, mono metadata, serif editorial hook.
> 3. "How The Lexicon Works" — three steps (Research / Connect / Archive), each defining one piece of terminology.
> 4. "Who It's For" — designers, students, stylists, costume, critics.
> 5. Recent Essays row.
> 6. Footer with brand, archive nav, account nav, newsletter, `[ VISUAL ] [ INDEX ]` toggle.
>
> **Archive view requirements:**
> 1. Mode toggle prominent top-right: `[ VISUAL ] [ INDEX ]`. Keyboard `V` and `I`. Persists in localStorage.
> 2. Multi-select chip filters: brand, designer, tag, movement, year-range. URL-encoded. Mobile: bottom sheet.
> 3. **Visual mode:** card grid using inverted metadata hierarchy (tag first, accent colour, image, mono metadata, serif hook).
> 4. **Index mode:** monospace data table. Columns: ID, Designer, Year, Season, Subcultural Tag, Provenance, Status. Sortable. Each row focusable, `j/k` navigation, `Enter` opens, `/` focuses search. Real `<table>` markup for screen readers.
>
> **Entry pages:**
> 1. Real routes `/entry/{slug}`, server-rendered.
> 2. JSON-LD `CreativeWork` schema in head.
> 3. Per-entry OG image.
> 4. Three-column reading layout: sticky metadata rail / serif prose centre / Nexus preview rail. Collapses to one column on mobile.
> 5. Reader mode (`R`) toggle, 3-step font size adjustment, sticky TOC.
> 6. Citation export inline (Chicago, MLA, APA, Harvard, BibTeX, permalink) with copy buttons.
> 7. Print stylesheet — clean prose, URLs visible, no chrome.
>
> **Nexus:**
> 1. Force-directed graph (D3 or react-force-graph). Nodes = entries, edges typed (references / influences / responds-to / appropriates / cites).
> 2. Three views: Graph / Timeline / List. List is the accessibility-first default.
> 3. Filterable by relationship type and category.
> 4. Sharable URL: `/nexus/{slug}?depth=2&filter=influences`.
> 5. Respects `prefers-reduced-motion` (static layout when set).
>
> **Command palette:** `⌘K` / `Ctrl+K` opens an overlay. Type-ahead across entries, tags, designers, movements. Boolean operators (`AND`, `OR`, `NOT`, `"phrase"`, `year:`, `tag:`). Keyboard-only navigable. Recent and saved searches.
>
> **Accessibility:** WCAG 2.2 AA minimum. Visible 2px focus rings. `aria-label` on every icon-only control. Skip links. Real labels on forms. Focus trap in modals. `prefers-reduced-motion` respected. Body text minimum 4.5:1 contrast.
>
> **Performance:** Responsive `<picture>` (AVIF/WebP/JPEG). `loading="lazy"` below fold. BlurHash/LQIP placeholders. Virtualise grids over ~200 items. Subset webfonts; preload only above-fold weights. Service worker for offline reading of saved entries.
>
> **Microcopy:** Apply the full diff in §7 of the brief.
>
> **Cookie banner:** Add a `Reject` button (GDPR/PECR compliance).
>
> **Preserve:** name, wordmark, black palette, monospace as a *mode* (UI chrome and Index View), Nexus as a feature and a name, the Provenance/Critique/Strategy triad, the editorial voice inside entries.
>
> **Phasing:** Front door → Research instrument → Entry architecture → Editorial & business pipeline. Ship Phase 1 in isolation; measure bounce and session length before committing to Phase 2.
>
> **Deliverables:** Updated homepage, archive view with mode toggle, entry route + reading layout, Nexus visualisation, command palette, multi-select filter system, accessibility audit pass, performance audit pass.

---

## 15. Success metrics

Track from the day Phase 1 ships:

- **Bounce rate** on `/` (target: substantial drop, especially mobile).
- **Click-through to first entry** from `/`.
- **Time on entry pages** (proxy for whether prose is read).
- **Sign-up conversion** anonymous → authenticated.
- **Returning visitor rate** at 7 / 30 / 90 days.
- **Search adoption** — % of sessions that invoke the command palette.
- **Index View adoption** — % of sessions that toggle to text mode (the proxy for whether the academic audience is using the tool).
- **Citation copy events** — by format. A high MLA/Chicago rate validates the academic audience hypothesis.

The clearest signal that the strategy is working: **Index View usage rises among returning visitors.** That's the moment the casual browsers have converted into researchers.

---

*End of brief v2.*
