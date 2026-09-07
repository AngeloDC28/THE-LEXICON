# Paste this into Claude Code, in the THE-LEXICON repo

---

You are working in THE LEXICON repo. Read `CLAUDE.md` and `drafts/REVIEWS-SPEC.md` in full before writing any code. The spec is the design document for this task; CLAUDE.md governs conventions and you follow it exactly.

## What we are building

A second content type: **reviews**. Long-form film reviews that use costume and dress as the critical lens. Five drafts already exist as markdown in `drafts/reviews/`. They need to become a proper content type with source-of-truth JSON, a generated artifact, validation, and — critically — **statically pre-rendered HTML pages**.

This is not a blog bolted onto the archive. It is a second surface of the same publication, in the same brutalist / forensic-archive design language. Acid yellow `#CCFF00`, monospace, hard borders. Do not soften the aesthetic.

## Why this matters (context that should shape your judgement)

These review URLs are going into a BFI London Film Festival press accreditation application before **12pm on 2 October**, and afterwards into cold emails to film publicists. The person opening the link is deciding whether this is a real publication. That means:

- The article text must be in the HTML source, readable with JavaScript disabled
- Meta tags and link previews must work
- Nothing may depend on a client-side render succeeding

That requirement is the reason for the whole approach. If a decision is ever ambiguous, resolve it in favour of "a static document that always renders."

## Hard constraints

- **Never hand-edit generated artifacts.** `database.js`, `js/modules/translations.js`, `js/modules/image-dimensions.js`, and the new `reviews.js` are all build outputs.
- **Zero npm dependencies** for build scripts. Template literals and `node:fs` only. If you think you need a markdown parser or a templating library, you don't — write the 50 lines.
- **Do not touch the existing entry pipeline.** `content/entries/`, `entry.schema.json`, `build-data.mjs`, the SPA render modules — all out of scope. If a change appears to require modifying them, stop and ask.
- **Match the existing script style** in `.github/scripts/` — header comment explaining purpose, zero deps, idempotent, resumable.
- Run `npm run check` before every commit. Never `--no-verify`. Never force-push to main.
- Commit at logical break points with real messages. No end-of-session megacommit.

## Work in phases. Stop at each gate.

---

### PHASE 1 — Foundation and the deployment gate

Build only:

1. `content/review.schema.json` — per the spec, `additionalProperties: false`
2. `content/reviews/the-cook-the-thief.json` — convert `drafts/reviews/05-cook-thief-review.md` by hand into the schema. Preserve the prose exactly; do not rewrite, summarise, or "improve" the copy. Body blocks are `p`, `h2`, `pullquote`, `image`.
3. `.github/scripts/build-reviews.mjs` — `content/reviews/*.json` → `reviews.js`
4. `.github/scripts/build-review-pages.mjs` — `content/reviews/*.json` → `reviews/<slug>/index.html`
5. `.github/scripts/validate-reviews.mjs` — schema, asset existence, and the rights check
6. `vercel.json` — add `reviews` to the rewrite negative lookahead
7. `package.json` — `build-reviews` and `new-review` scripts; wire `build-reviews` into `preflight` and `prebuild` after `build-data`; add `validate-reviews.mjs` to the `check` chain

Images are not ready yet. Reference them in the JSON with the paths from the spec and let `validate-reviews.mjs` fail loudly on missing files — then add a `--allow-missing-assets` flag for local iteration only, off by default and never used in CI.

**The static page must contain, server-rendered:** full article text in semantic HTML (`<article>`, `<h1>`, `<p>`, `<figure>`, `<figcaption>`, `<blockquote>`, `<time datetime>`); `<title>` as `{title} — review — THE LEXICON`; meta description from `dek`; canonical link; Open Graph and Twitter card tags; and JSON-LD `schema.org/Review` with `itemReviewed` as a `Movie`, plus `reviewRating`, `author`, `datePublished`, `publisher`.

**⛔ STOP HERE. Do not continue to Phase 2 until the gate passes.**

**The gate:** `npm run dev` uses Vite and will *not* apply `vercel.json` rewrites, so local testing cannot verify this. Push the branch, get a Vercel preview deployment, and confirm on the preview URL:

```
curl -s <preview-url>/reviews/the-cook-the-thief/ | grep -c "Greenaway"
```

This must return a non-zero count. Then open the page in a browser with JavaScript disabled and confirm the full review is readable.

If the rewrite exclusion does not work, fix it before doing anything else. Every subsequent phase is wasted effort until this passes. Tell me the result rather than assuming it worked.

---

### PHASE 2 — The remaining four reviews

Only after the gate passes. Convert, preserving prose exactly:

- `drafts/reviews/01-lady-blue-shanghai-review.md` → `lady-blue-shanghai`
- `drafts/reviews/02-marie-antoinette-review.md` → `marie-antoinette`
- `drafts/reviews/03-duke-of-burgundy-review.md` → `the-duke-of-burgundy`
- `drafts/reviews/04-mean-girls-review.md` → `mean-girls`

Each markdown file has a star rating under the title — map it to the numeric `rating` field. Each has a bolded credits line at the foot — map those into `film`. Each has a works-cited italic line — map to `worksCited`. The `> **IMAGE n**` blocks are image placeholders: create the `images[]` entries with the caption and credit text given, and place an `image` body block at that position.

Set `relatedEntries` where a genuine link exists. `the-cook-the-thief` should link to `gaultier-ss94`, which is already in `content/entries/`.

Set `publishedAt` staggered rather than all on one date — reviews landing on five consecutive timestamps looks like a bulk import.

---

### PHASE 3 — Index and press page

1. `reviews/index.html`, generated by `build-review-pages.mjs`. Title, dek, rating, date, reverse chronological. This is the page that gets linked as the publication.
2. A static `/press/` page. Contents: the publication's one-line remit, editor name, a contact address that is not a personal Gmail, a link to `/reviews/`, and a line stating that film stills are reproduced under s.30 of the Copyright, Designs and Patents Act 1988 for the purposes of criticism and review, with acknowledgement.
3. Add navigation to `/reviews/` from the main site, in keeping with the existing nav treatment.

---

### PHASE 4 — Ship

1. `npm run preflight`
2. Confirm CI's stale-artifact diff covers `reviews.js` and the generated `reviews/` HTML; extend the workflow with the same pattern used for `database.js` if not
3. Commit in logical chunks, push to main
4. Verify the five live URLs on production, with JavaScript disabled

---

## Validation rules that are not optional

`validate-reviews.mjs` must fail the build when:

- Any image lacks a non-empty `credit`, or has a `rights` value outside `public-domain` | `fair-dealing` | `licensed`
- Any `body[]` image block's `ref` does not resolve to an `images[].id`
- Any `relatedEntries` slug is not present in `content/entries/`
- `slug` does not match the filename stem, or is not `^[a-z0-9-]+$`
- `rating` is outside 0–5 or not a multiple of 0.5
- `publishedAt` is unparseable or in the future

The credit and rights check is a legal requirement, not a style preference — the fair-dealing exception depends on sufficient acknowledgement. It must be enforced in CI, not by discipline.

## Ask me before

- Modifying anything under `content/entries/`, `entry.schema.json`, or the existing SPA render modules
- Adding any npm dependency
- Changing the visual language
- Any change to `vercel.json` beyond the single rewrite exclusion

Start with Phase 1. Tell me when you hit the gate.
