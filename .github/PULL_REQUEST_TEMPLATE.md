## What this PR does

<!-- One sentence. New entry / bug fix / feature / infrastructure. -->

---

## Checklist

### For every PR
- [ ] `npm run preflight` ran clean (or pre-commit hook passed)
- [ ] No hand-edits to `database.js`, `translations.js`, or `image-dimensions.js`
- [ ] No secrets, API keys, or `.env` files committed
- [ ] No force-push to `main`

### New entry PRs
- [ ] Entry JSON passes `npm run check` with zero errors
- [ ] All 9 taxonomy tags filled (`brand`, `era`, `politics`, `theories`, `gender`, `materials`, `geography`, `anatomy`, `format`)
- [ ] All 3 notes written (`provenance`, `critique`, `strategy`) — minimum 50 words each
- [ ] Every image has at least 3 hotspots with label + description
- [ ] Images optimised via `npm run optimize-images` (no source file > 2400px wide)
- [ ] WebP siblings present for every JPG/PNG (`<slug>-NN.webp`)
- [ ] Entry appears in `content/order.json` in the intended position
- [ ] `content/translations/en.json` updated (run `npm run sync-content-keys`)

### Bug fix / feature PRs
- [ ] Scope is tight — no unrelated cleanup bundled in
- [ ] If JS changed: tested in Chrome + Firefox (at minimum)
- [ ] If CSS changed: tested at mobile (375px) and desktop (1280px+)

---

## Screenshots / evidence

<!-- Delete if not applicable. Paste before/after or a quick screen recording. -->
