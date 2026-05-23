# THE LEXICON — Code & UX Review v2

*A structural audit of thelexicon.xyz extended to cover the brutalist Index View, inverted metadata hierarchy, fluid typography, command palette, Nexus architecture, and the broader research-instrument UX.*

---

## 1. Position

The Lexicon is a research instrument, not a fashion blog. Every architectural decision below treats it as such. The aesthetic stays; the inaccessibility doesn't.

---

## 2. The three structural moves, in code

### 2.1 Brutalist Index Toggle

A persistent control in the archive header that switches the grid into a text-first index.

**Behaviour:**
- Two adjacent buttons, equal weight: `[ VISUAL ] [ INDEX ]`
- Keyboard: `V` and `I`
- Mode preference persists in `localStorage` keyed `lexicon.view-mode`
- The active mode is filled white-on-black; inactive is bordered

**Markup contract (Index View):**

```html
<section aria-label="Archive entries, text-only index view">
  <table role="table">
    <thead>
      <tr>
        <th scope="col" aria-sort="descending">Year</th>
        <th scope="col">Designer</th>
        <th scope="col">Analytical tag</th>
        <th scope="col">Provenance</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr tabindex="0" role="link"
          aria-label="N-0142, Alexander McQueen, 1999, Corporeal Intervention, 47 citations"
          data-href="/entry/mcqueen-ss99-13">
        ...
      </tr>
    </tbody>
  </table>
</section>
```

**Keyboard contract:**

| Key | Action |
|---|---|
| `j` / `↓` | Next row |
| `k` / `↑` | Previous row |
| `Enter` | Open entry |
| `/` | Focus search |
| `S` | Save to folder |
| `C` | Cite entry |
| `V` / `I` | Switch mode |
| `?` | Open shortcut help |
| `Esc` | Clear search → exit if already empty |

**Screen reader behaviour:** every row announces ID, designer, year, analytical tag, citation count, in that order. The accent colour on tags is purely visual; the same information is announced as plain text. Colour is never the sole carrier of meaning.

### 2.2 Inverted Metadata Hierarchy

Every card in the visual grid follows the same structure, regardless of context.

**HTML contract:**

```html
<article class="card" data-tag="corporeal">
  <header class="card-tag-strip">
    <a href="/tag/corporeal-intervention" class="tag-label">
      Corporeal Intervention
    </a>
    <span class="entry-id" aria-hidden="true">N-0142</span>
  </header>
  <a href="/entry/mcqueen-ss99-13" class="card-link">
    <figure>
      <img src="..." alt="Shalom Harlow on rotating disc, McQueen SS99" />
    </figure>
    <div class="card-body">
      <p class="card-meta">Alexander McQueen · SS99 · "No.13"</p>
      <h3 class="card-hook">
        A single show rewrote the grammar of fashion spectacle.
      </h3>
    </div>
  </a>
</article>
```

**Accent palette:**

```css
:root {
  --c-corporeal:  #e2a4a0;
  --c-semiotic:   #d4c4a0;
  --c-subculture: #b08fc4;
  --c-critique:   #d96b6b;
  --c-strategy:   #7fb3a3;
  --c-provenance: #c4a87a;
}

.card[data-tag="corporeal"]  .tag-label { color: var(--c-corporeal); }
.card[data-tag="critique"]   .tag-label { color: var(--c-critique); }
/* etc. */
```

**Rule:** the tag is never hidden in a hover state, never below the fold, never smaller than the designer's name. The argument is the lens, and the design must show it.

### 2.3 Fluid Typographic Scaling

All sizes via `clamp()` and CSS variables. No media query ever sets a `font-size`.

```css
:root {
  --t-mono-xs:   clamp(0.625rem, 0.55rem + 0.18vw, 0.75rem);
  --t-mono-sm:   clamp(0.6875rem, 0.6rem + 0.2vw, 0.8125rem);
  --t-mono-base: clamp(0.75rem, 0.65rem + 0.25vw, 0.9375rem);
  --t-body:      clamp(0.95rem, 0.85rem + 0.3vw, 1.0625rem);
  --t-lead:      clamp(1rem, 0.85rem + 0.55vw, 1.25rem);
  --t-h3:        clamp(1.25rem, 1rem + 0.9vw, 1.75rem);
  --t-h2:        clamp(1.5rem, 1.1rem + 1.4vw, 2.25rem);
  --t-h1:        clamp(2rem, 1.2rem + 3.2vw, 4.5rem);
  --t-display:   clamp(3rem, 1.5rem + 6vw, 7rem);
  --measure:     clamp(54ch, 56vw, 68ch);
}
```

**Rules of use:**
- Never declare a static `font-size` outside the variables.
- Pair each scale step with a fixed line-height (display: 0.95, h1/h2: 1.05–1.15, body: 1.55–1.65).
- Letter-spacing is set per-style, never inline.

The full type system is rendered in mockup **`06-typography.png`**, including a viewport-comparison plot of how each step interpolates between 360px and 1440px.

---

## 3. Architecture

### 3.1 From SPA-with-modals to real routes

Move from the current single-page architecture to:

```
/                           – homepage
/archive                    – grid + index modes
/archive?tag=...&y=...      – filtered archive (URL-encoded, sharable)
/entry/{slug}               – individual entry, server-rendered
/tag/{slug}                 – taxonomy page
/brand/{slug}               – brand page
/movement/{slug}            – movement page
/essays                     – essay index
/essays/{slug}              – individual essay
/nexus/{slug}               – sharable Nexus view
/folders/{user}/{folder}    – saved collections (authenticated)
/methodology, /about,
/contact, /privacy, /terms  – content pages, not modals
```

This unlocks SEO, sharing, and proper indexing of every entry in the archive — the long-term moat for a research tool.

### 3.2 Per-entry document head

Every entry needs:

```html
<title>McQueen SS99 "No.13" — Corporeal Intervention | THE LEXICON</title>
<link rel="canonical" href="https://thelexicon.xyz/entry/mcqueen-ss99-13" />

<meta name="description" content="..." />
<meta property="og:image" content="/public/.../mcqueen-ss99-01.jpg" />
<meta property="og:type" content="article" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How a single show rewrote the grammar of fashion spectacle.",
  "datePublished": "2024-09-12",
  "dateModified": "2026-05-22",
  "author": { "@type": "Organization", "name": "The Lexicon" },
  "publisher": { "@type": "Organization", "name": "The Lexicon" },
  "about": [
    { "@type": "Thing", "name": "Alexander McQueen" },
    { "@type": "Thing", "name": "Corporeal Intervention" }
  ],
  "image": "https://thelexicon.xyz/public/.../mcqueen-ss99-01.jpg",
  "isPartOf": { "@type": "Collection", "name": "Corporeal Intervention" },
  "citation": [...]
}
</script>
```

JSON-LD `Article` schema with `citation` arrays is how academic-grade indexing happens.

---

## 4. The reading layout (entry page)

A three-column desktop layout collapsing cleanly to one column on mobile. Rendered in mockup **`03-entry-page.png`**.

**Left rail — sticky metadata:**
- Accent tag (large, coloured, clickable to filter)
- Entry ID (small)
- Section heading: "How a single show rewrote the grammar of fashion spectacle."
- Designer, House, Year, Season, City, Model, Photographer, Source, Citations, Updated
- Action buttons: Save (S), Open Nexus (N), Cite (C), Share (P)

**Centre — editorial prose:**
- Hero image with caption overlay (photographer credit visible)
- Reading toolbar: word count, time-to-read, footnote count, font-size controls, reader-mode, print
- Three labeled sections — **01 Provenance · 02 Critique · 03 Strategy** — each with anchored heading and per-section time-to-read
- Pull-quotes break the column rhythm; blockquotes carry source citation
- Footnotes inline-expandable

**Right rail — sticky aids:**
- Table of contents with active-section indicator
- Nexus preview (mini force-directed graph) with list of top relations and "Open full Nexus" CTA

**Reader mode (`R`):** hides both rails, presents the prose at the full `--measure` line length, three font-size presets persistent in localStorage.

**Print stylesheet:**
- No chrome
- URLs printed inline next to anchor text
- Footnotes printed at the bottom of each page
- Garamond at 11pt, line-height 1.4
- Source citations and permalink printed at the top

---

## 5. The Nexus

Rendered in mockup **`05-nexus.png`**.

**Three modes, one URL family:**
- `/nexus/{slug}` — defaults to Graph view, depth 2, all relations
- `?view=graph|timeline|list` — explicit mode
- `?depth=1|2|3` — relationship depth
- `?filter=influences,references` — relationship types

**Graph view:**
- D3 force-directed (or `react-force-graph` for convenience)
- Nodes coloured by analytical tag (the same accent palette)
- Edges typed: REFERENCES · INFLUENCES · RESPONDS TO · APPROPRIATES · CITES
- Hover reveals tooltip with title, metadata, and relation type
- Selected node populates the right detail panel
- Keyboard: `+/-` zoom, arrow keys pan, `F` fit, `R` reset, `L/T` switch to List/Timeline, `Enter` open node
- Respects `prefers-reduced-motion` (static force layout when set)

**Timeline view:**
- Same data, plotted by year on a horizontal axis
- Edges drawn as connecting curves between dots
- Particularly useful for showing lineage across decades

**List view:**
- Plain, accessible default — the same data as a flat list of relations, grouped by type
- This is what screen readers, the Index View, and JS-disabled clients see
- Each relation links to both endpoint entries

The Nexus is the single most marketable feature. It is also the one most worth investing engineering rigor into.

---

## 6. The command palette

Rendered in mockup **`04-command-palette.png`**.

**Trigger:** `⌘K` / `Ctrl+K` from anywhere.

**Capabilities:**
- Type-ahead across entries, analytical tags, designers, brands, movements, essays, folders
- Boolean operators: `AND`, `OR`, `NOT`, `"exact phrase"`
- Field operators: `tag:`, `year:`, `designer:`, `brand:`, `movement:`
- Direct command lines: "Filter archive by tag: Corporeal" or "Open Nexus for…"
- Recent searches and saved searches under each user account

**Markup contract:**

```html
<div role="dialog" aria-modal="true" aria-label="Command palette">
  <input type="search" aria-label="Search archive"
         aria-autocomplete="list" aria-controls="cmd-results" />
  <ul id="cmd-results" role="listbox">
    <li role="option" aria-selected="true">...</li>
  </ul>
</div>
```

Focus trap, escape closes, focus returns to the trigger. This is non-negotiable for accessibility.

---

## 7. Search & filter — URL-encoded, shareable

Every filtered view is a real URL. A tutor can share:

```
/archive?tag=corporeal-intervention,semiotic-sabotage&y=1990-2005&sort=year-desc&view=index
```

**Filter primitives:**
- Multi-select chips for analytical tags, brands, designers, movements
- Range slider for year (1850 → present)
- View mode (visual | index)
- Sort key

**Mobile:** bottom-sheet pattern instead of dropdowns. Apply / Clear / Save buttons fixed at the bottom. Rendered in mockup **`07-mobile.png`** (third panel).

**Saved searches:** authenticated users can name and save a filter combination. Stored against the user, surfaced in the command palette under "Saved searches."

---

## 8. Microcopy diff (carried forward, condensed)

| Location | Current | Replace with |
|---|---|---|
| Top bar | `CONNECTION_MATRIX_ALPHA · v0.9.2` | `2,847 ENTRIES · 412 BRANDS · 38 MOVEMENTS · LAST UPDATE: {date}` |
| Hero panel | `ARCHIVE STATUS: STABLE` | (move to archive route; homepage replaces with hero featured entry) |
| Nav | `FOLDERS · ACCESS · LANGUAGES ▾ · THEME` | `BROWSE · RESEARCH TERMINAL · ESSAYS · METHODOLOGY · ABOUT` |
| Mode toggle | — | `[ VISUAL ] [ INDEX ]` |
| Filter | `[ CLEAR_FILTER ]` | `Clear` |
| Grid label | `ARCHIVE_GRID` | remove |
| Sign in | `Terminal Access · Send Link` | `Sign in · Send sign-in link` |
| Sign in sent | `Link transmitted. Check your inbox to complete initialization.` | `Sign-in link sent. Check your email.` |
| Empty folder | `0 Folders Initialized` | `Save your first entry to start a folder.` |
| Cookie | `…persistent local storage…terminal state…` + `Privacy / Terms / Accept` | `We use cookies to keep your archive state and folders between visits.` + `Privacy / Reject / Accept` |
| Orientation modal | "forensic audit of visual culture" | "A research archive for fashion history and visual culture. We map how ideas move — references, garments, subcultures, and back again." |
| Nexus desc | "visualize connections between disparate artifacts" | "See how this entry connects to others — references, influences, lineage." |

Keep, with tooltip on first encounter: **Nexus · Provenance · Critique · Strategy · Folder**. These are load-bearing IP.

---

## 9. Accessibility — WCAG 2.2 AA as the floor

| Area | Requirement |
|---|---|
| Contrast | Body ≥4.5:1, large text ≥3:1. Decorative greys allowed only on truly non-essential metadata. |
| Focus rings | 2px white outline (no `outline:none` without a replacement). |
| Icon-only controls | Every `★`, `◈`, `▦`, `◉` gets `aria-label`. |
| Skip links | Skip to archive, skip to search, skip to footer. |
| Modals | Focus trap, `aria-modal="true"`, `Esc` closes, focus returns to trigger. |
| Forms | Real `<label>` for every input; `aria-describedby` for help text. |
| Tables | Real `<table>` markup with `<thead>` / `<tbody>` / `scope="col"`. |
| Reduced motion | Respect `prefers-reduced-motion` (Nexus static layout, no auto-rotate hero). |
| Keyboard parity | Every action achievable without a mouse, including Nexus and lightbox. |
| Language | `lang="en"` on `<html>`; per-locale routes for translations. |
| Colour as carrier | Never the sole signal — accent colour always accompanied by text or icon. |
| Print stylesheet | Required for entries (researchers print). |

The Index View is itself an accessibility feature — but it does not replace the obligation to make the Visual view accessible too.

---

## 10. Performance

| Concern | Recommendation |
|---|---|
| Imagery | `<picture>` with `srcset`/`sizes`; AVIF + WebP + JPEG fallback |
| Below-fold | `loading="lazy"` and `decoding="async"` on all `<img>` |
| Placeholders | BlurHash or LQIP — never empty boxes |
| Grids over ~200 items | Virtualised list (react-window or similar) |
| Fonts | Subset Latin range only; preload two weights above fold |
| Caching | Hashed filenames under `/public/THE-LEXICON-ASSETS/*` with long `max-age` |
| Service worker | Offline reading of saved entries (a high-perceived-value feature for researchers on trains) |
| Layout shift | Explicit `width` / `height` on every `<img>` |

---

## 11. Editorial pipeline

For sustainable content velocity:
- MDX or Markdown + frontmatter for entries (slug, designer, year, tag, movement, sources)
- Headless CMS layer (Sanity, Contentful, or Tina) for non-technical contributors
- Preview URLs for unpublished drafts
- Source-of-truth in Git — the prose is the asset, treat it like code
- Citations stored as structured arrays, rendered into Chicago / MLA / APA / Harvard / BibTeX at build time, not parsed at runtime

---

## 12. Monetization architecture

The redesign anticipates a tiered business model:

- **Free.** Browse, read first paragraph, see Nexus list view.
- **Member (~£8/mo).** Full entries, folders, full Nexus graph, citation export, command palette, Index View, PDF/print export.
- **Institution (~£600+/yr).** Multi-seat, IP-range auth, branded folders, usage analytics, API read access. Sold to design schools (CSM, Parsons, RCA) and brand archives.
- **B2B research consultancy.** Brand archaeology, lineage reports, costume-team research. The methodology page is the marketing.
- **Print quarterly.** Anchored in archive material; cover price + sponsorship + Patron tier.
- **Education & events.** Workshops, archive talks, partnerships with design schools.
- **Licensing & exhibitions.** Curated Nexus views or methodology IP to museums.

Engineering only needs to plant the seeds now: a `members-only` flag on entries, magic-link auth that extends to Stripe later, a read API on the same data layer.

---

## 13. Phased implementation

**Phase 1 — Front door (2–3 weeks):**
- Hero rewrite + featured strip
- Inverted metadata hierarchy across all cards
- Fluid type system implemented across the codebase
- Microcopy diff applied
- Cookie reject button (GDPR)
- Keyboard shortcuts: `?`, `/`, `V`, `I`

**Phase 2 — Research instrument (4–6 weeks):**
- Brutalist Index View
- Command palette
- Multi-select filters with URL encoding
- WCAG 2.2 AA audit pass
- Mobile bottom-sheet filters
- Saved searches

**Phase 3 — Entry architecture (6–8 weeks):**
- Per-entry routes with SSR + JSON-LD
- Three-column reading layout + reader mode
- Print stylesheet
- Citation export inline
- Nexus graph + Timeline + List views

**Phase 4 — Editorial & business (ongoing):**
- MDX/CMS pipeline
- Subscription tiers + Stripe
- Print product
- Institutional licensing

---

## 14. Mockups produced (v2)

Eight visual mockups accompany this review:

| File | Subject |
|---|---|
| `01-homepage.png` | Full homepage with mode toggle, inverted card hierarchy |
| `02-index-view.png` | Brutalist text-only Index View with sortable table, keyboard shortcuts, accent-coded tags |
| `03-entry-page.png` | Three-column entry layout with Provenance · Critique · Strategy, sticky metadata rail, Nexus preview |
| `04-command-palette.png` | `⌘K` overlay with grouped results (tags · entries · essays · commands) |
| `05-nexus.png` | Force-directed Nexus with relationship filtering, mode toggle, tooltip, detail panel |
| `06-typography.png` | Full fluid type system specimens, viewport comparison, interpolation curves |
| `07-mobile.png` | Three mobile screens: homepage, index mode, bottom-sheet filters |
| `08-hierarchy-inversion.png` | Direct before/after of the metadata hierarchy inversion |

The HTML source files are included so a developer can open them in a browser, inspect the CSS variables and layouts, and treat them as visual specs.

---

## 15. Success metrics

Track from the day Phase 1 ships:

- **Bounce rate** on `/` — substantial drop expected, especially mobile.
- **Click-through** to first entry from homepage.
- **Time on entry pages** — proxy for whether prose is actually read.
- **Sign-up conversion** — anonymous → authenticated.
- **Returning visitor rate** at 7 / 30 / 90 days.
- **Command palette adoption** — % of sessions invoking `⌘K`. A serious-tool signal.
- **Index View adoption** — % of sessions toggling to text mode. A serious-audience signal.
- **Citation copy events** by format — MLA/Chicago dominance validates the academic hypothesis.
- **Nexus opens per entry** — the signal that the relational IP is doing work.

The clearest sign the strategy is working: **Index View usage rises among returning visitors.** That is the moment the casual browsers have converted into researchers — and the moment a paid tier becomes defensible.

---

*End of code & UX review v2.*
