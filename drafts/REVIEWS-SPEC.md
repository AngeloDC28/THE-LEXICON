# Spec: add a `reviews` content type to THE LEXICON

Feed this file to Claude Code in the repo. It follows the conventions already
in CLAUDE.md — JSON source of truth, generated artifact, zero-dep build script
in `.github/scripts/`, wired into `preflight`.

Drafts for the first five reviews are in `drafts/reviews/*.md`.

---

## Why a new content type (and not a new entry)

`content/entry.schema.json` describes a runway collection: image stack,
per-image hotspots with x/y coords, three structured notes, nine tag axes.
`additionalProperties: false`.

A film review is not that shape. Forcing one into the entry schema means either
loosening a strict schema that is currently doing real work, or lying in the
data model. Neither is worth it.

Add a parallel content type instead. It reuses the tag taxonomy and the build
pattern, and touches nothing that already works.

---

## The load-bearing decision: these pages must be static HTML

**This is the part that actually matters, and it is a change to how the site serves.**

`vercel.json` currently rewrites everything except a short allowlist to
`/index.html`. Content renders client-side. That is correct for the archive —
it's an interactive research terminal and it needs the JS.

It is wrong for reviews, for three reasons:

1. **Press accreditation.** These URLs get pasted into a BFI application form
   and read by someone who is assessing whether this is a real publication. A
   page that renders after a JS round-trip, or shows nothing if a module 404s,
   fails that test in a way you never get to explain.
2. **Publicists.** Same problem, all year. A press officer clicking a link from
   a cold email gives it about four seconds.
3. **Link previews and crawlers.** Shared on any platform, an SPA shell
   produces a blank card. Reviews are the part of the site meant to travel.

So: **pre-render each review to a real static HTML file at build time**, and
exclude `/reviews` from the SPA rewrite. The archive stays an SPA. Reviews
become documents.

---

## Files to add

| Path | Purpose |
|---|---|
| `content/review.schema.json` | Canonical review shape, `additionalProperties: false` |
| `content/reviews/*.json` | Source of truth, one per review |
| `reviews.js` | Generated artifact — **never hand-edit** |
| `.github/scripts/build-reviews.mjs` | `content/reviews/` → `reviews.js` |
| `.github/scripts/build-review-pages.mjs` | `content/reviews/` → `reviews/<slug>/index.html` |
| `.github/scripts/validate-reviews.mjs` | Schema + asset + rights check |
| `reviews/index.html` | Generated index of all reviews |

---

## Schema

```jsonc
{
  "slug": "the-cook-the-thief",           // kebab, stable, becomes the URL
  "title": "The Cook, the Thief, His Wife & Her Lover",
  "dek": "One sentence standfirst. This is the verdict, compressed.",
  "rating": 5,                             // 0–5, halves allowed
  "byline": "Angelo Sanchez Dela Cruz",
  "publishedAt": "2026-09-08",             // ISO date
  "updatedAt": "2026-09-08",

  "film": {
    "director": "Peter Greenaway",
    "year": 1989,
    "runtimeMinutes": 124,
    "costumeDesigner": "Jean Paul Gaultier",
    "cinematographer": "Sacha Vierny",
    "composer": "Michael Nyman",
    "distributor": "Palace Pictures"
  },

  "body": [
    { "type": "p", "text": "..." },
    { "type": "h2", "text": "..." },
    { "type": "pullquote", "text": "..." },
    { "type": "image", "ref": "cook-thief-01" }
  ],

  "images": [
    {
      "id": "cook-thief-01",
      "src": "public/THE-LEXICON-ASSETS/reviews/cook-thief-01.jpg",
      "alt": "Helen Mirren in the red dining room",
      "caption": "Georgina in the dining room. The corset is scarlet.",
      "credit": "Peter Greenaway, The Cook, the Thief, His Wife & Her Lover, 1989. Palace Pictures.",
      "rights": "fair-dealing",            // public-domain | fair-dealing | licensed
      "sourceUrl": null
    }
  ],

  "worksCited": [
    "Laura U. Marks, The Skin of the Film (Duke University Press, 2000)"
  ],

  "relatedEntries": ["gaultier-ss94"],     // must exist in content/entries/
  "tags": { }                              // reuse the existing 9-axis taxonomy
}
```

**Validation rules** for `validate-reviews.mjs`:

- `slug` unique, matches `^[a-z0-9-]+$`, equals the filename stem
- `rating` in `[0, 5]`, multiples of 0.5
- every `body[].ref` of type `image` resolves to an `images[].id`
- every `images[].src` exists on disk
- **every image has a non-empty `credit` and a valid `rights` value** — this is
  a legal check, not a style one; fail the build if it's missing
- every `relatedEntries` slug exists in `content/entries/`
- `publishedAt` parses as a date and is not in the future

---

## Static page generation

`build-review-pages.mjs` emits `reviews/<slug>/index.html` per review, plus
`reviews/index.html`. Zero dependencies — template literals and `fs`.

Each page must contain, server-side, with no JS required to read it:

- Full article text as semantic HTML (`<article>`, `<h1>`, `<p>`, `<figure>`,
  `<figcaption>`, `<blockquote>`)
- `<title>` — `{title} — review — THE LEXICON`
- `<meta name="description">` from `dek`
- `<link rel="canonical">` to the absolute URL
- Open Graph + Twitter card tags (`og:title`, `og:description`, `og:image`,
  `og:type=article`, `twitter:card=summary_large_image`)
- JSON-LD `schema.org/Review` with `itemReviewed` (`Movie`), `reviewRating`,
  `author`, `datePublished`, `publisher`
- `<time datetime>` on the published date
- Existing `index.css` for the house style — acid yellow `#CCFF00`, monospace,
  hard borders. Reviews should look like they belong to the archive, not like a
  blog bolted on.
- A link back to `/` and to any `relatedEntries`

The `reviews/index.html` listing shows title, dek, rating, date, in reverse
chronological order.

---

## Config changes

**`vercel.json`** — add `reviews` to the rewrite exclusion:

```jsonc
"source": "/((?!public|js|reviews|index\\.css|database\\.js|favicon|apple-touch-icon|manifest).*)"
```

**`package.json`** — new scripts, and extend the pipeline:

```jsonc
"build-reviews": "node .github/scripts/build-reviews.mjs && node .github/scripts/build-review-pages.mjs",
"new-review": "node .github/scripts/new-review.mjs",
```

Add `build-reviews` to `preflight` and `prebuild`, after `build-data`.
Add `validate-reviews.mjs` to the `check` chain.

**CI** — the existing workflow diffs generated artifacts against sources. Add
`reviews.js` and the `reviews/` HTML to that staleness check, same pattern.

---

## Also add: a press page

Static, at `/press/`. Needed for accreditation and for every publicist email
from here on. Contents:

- One-line remit: what THE LEXICON covers and who reads it
- Editor name and a contact email that is not a personal Gmail
- Link to `/reviews/`
- A line stating that film stills are reproduced under s.30 CDPA 1988 for
  criticism and review, with acknowledgement

---

## Order of work

1. `review.schema.json` + one review JSON hand-written from `drafts/reviews/05-cook-thief-review.md`
2. `build-reviews.mjs` → `reviews.js`
3. `build-review-pages.mjs` → static page for that one review, checked in a browser
4. `validate-reviews.mjs`, wired into `check`
5. `vercel.json` rewrite exclusion — verify a hard refresh on `/reviews/<slug>` serves the static file, not the SPA shell
6. Convert the remaining four drafts
7. `reviews/index.html` and `/press/`
8. `npm run preflight`, then commit

Ship step 5 before step 6. If the rewrite exclusion doesn't work, everything
after it is wasted effort.
