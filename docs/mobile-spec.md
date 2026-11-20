# THE LEXICON — Mobile Experience Spec (sections 4–8)

Copied from the maintainer's doc "THE LEXICON — Mobile Experience Spec & Claude
Code Build Plan" so Claude Code can read the spec instead of guessing. The doc
is the original; if they disagree, ask.

Every screen follows one rule: **picture first, one plain sentence second,
controls last.** Below 768px the desktop sidebar, filter strip and view toggles
disappear and are replaced by a bottom bar and sheets.

## 4. Screen-by-screen spec (below 768px)

### 4.1 Global frame

- **Top bar (56px):** ☰ menu · THE LEXICON (link to /) · search icon. Nothing
  else. On a show page it becomes ← back · show name (truncated) · share.
- **Bottom bar (56px + safe area), browse screens only:** Home · Shows · Search ·
  Saved. Icon + label, active tab in acid yellow. Hidden on show pages, where
  the show toolbar takes its place.
- **The page scrolls, not an inner panel.** Use the document scroll so Safari's
  address bar collapses, pull-to-refresh works and tap-the-clock scrolls to top.
- **Remove on mobile:** the Brand/Year/Season/Entry strip, Visual/Index toggle,
  Grid View/Evolution Matrix buttons, Sort button, floating FILTER button.
  Their jobs move into the Filter sheet (4.7).

### 4.2 Home

| Order | Block | Spec |
|---|---|---|
| 1 | Hero | One full-width runway image (4:5), headline "See where every fashion idea actually came from", one plain line, button "Start exploring" |
| 2 | Start here | Horizontal swipe row of the 8 "Start here" shows (cards 70% of screen width, so the next one peeks in) |
| 3 | Six big ideas | 2×3 grid of tiles: plain name, 1-line explainer, show count |
| 4 | Show of the week | Image, name, plain summary, "Read in 2 min" |
| 5 | All shows | Link to the Shows tab |
| 6 | How it works | Three lines with icons |

No intro overlay, no boot text, no reload bar. The hero is the introduction.

### 4.3 Shows (the grid)

- Two columns at 360–599px, one column below 360px.
- Card: cover image (4:5, 480px thumbnail), designer name (bold),
  "Spring/Summer 1999", big-idea chip. No excerpt on the card; it makes cards
  uneven.
- Above the grid: one sticky row: "45 shows" · [Filter] · [Sort ▾]. That's it.
- Placeholder: blurred 20px version or a solid colour from the image while the
  thumbnail loads; never an empty grey box.

### 4.4 Show page

Top to bottom, in normal page scroll:

1. **Image viewer** (full width, 4:5): swipe left/right between looks, pinch to
   zoom, double-tap to zoom. Counter "3 / 16" in the corner instead of dots.
   Hotspot crosshairs on top.
2. **Title block:** "Alexander McQueen" / "Spring/Summer 1999 · No. 13" /
   big-idea chip / content note if the look has nudity.
3. **Plain summary** (the 25–40 word `summary_plain` field), in 18px Garamond.
4. **Analysis**, three collapsible sections, first one open: What happened
   (Provenance) · How it was made (Strategy) · What it means (Critique).
   Reading time on each.
5. **Quick facts** (era, place, materials), as a two-column list.
6. **Sources** with links.
7. **Shows like this:** horizontal swipe row.
8. **Cite this show** button, opening the Cite sheet.

**Show toolbar (fixed bottom):** Back · Notes · Look closer · Connections ·
Save. "Notes" scrolls to the Analysis; "Look closer" starts the hotspot tour
(4.5). Move the Provenance / Critique / Strategy squares off the photo; on
mobile they're replaced by the three collapsible sections.

### 4.5 Hotspots on a phone

- Tap a crosshair → a small sheet slides up (40% height) with the note title
  and text, and "Next note ›".
- **Look closer** mode: steps through every hotspot on every look in order,
  zooming the image to each one. Exit with ✕ or swipe down.
- The crosshair the sheet is about stays highlighted; others dim.

### 4.6 Search

- Full-screen, keyboard opens immediately.
- Before typing: suggested searches as chips ("punk", "robots", "climate",
  "Met Gala") and recent searches.
- Results grouped: Shows · Designers · Big ideas · Glossary words.
- The command syntax (`tag:` `year:`) still works but isn't shown on mobile.

### 4.7 Filter sheet

Bottom sheet, 85% height, drag handle, sticky "Show 12 results" button at the
bottom. Sections: Big idea (chips) · Decade (chips: 80s, 90s, 00s, 10s, 20s) ·
Designer (searchable list) · Sort (Start here / Newest / Oldest). "Clear all"
top right. Advanced categories (politics, theories, materials, geography, form,
format) under "More filters".

### 4.8 Glossary

Own page (/glossary). A–Z jump bar on the right edge, search at the top.
Tapping a defined word inside notes opens a small sheet with the definition and
"See in glossary ›", not a full-page jump.

### 4.9 Connections (Nexus)

- Default to the List view on phones (the graph is unreadable at 375px):
  "Influenced by", "Shares ideas with", "Led to", each a list of show cards.
- Timeline second; Graph last, full-screen, pinch to zoom.
- Full names, never cut to 14 characters.

### 4.10 Save, Cite, Share

- **Save:** one tap saves to "Saved" on the device, no sign-in needed.
  Long-press for folders. Sign-in only to sync.
- **Cite:** bottom sheet, one format shown (Harvard by default), a "Copy"
  button that turns into "Copied ✓", other formats in a dropdown.
- **Share:** uses the phone's own share sheet (`navigator.share`), with the
  plain summary as text.

### 4.11 Menu drawer (☰)

About · Glossary · Start here · Six big ideas · Language · Theme · Sign in ·
Contact. No show list in the drawer: that's what the Shows tab is for.

## 5. Interaction rules

These apply on every mobile screen. Treat them as constraints, not suggestions.

| Area | Rule |
|---|---|
| Touch targets | Every tappable thing at least 44×44px, with 8px between neighbours. Small visuals (dots, tags) get a larger invisible tap area |
| Hover | Nothing depends on hover. Tooltips become tap-to-open sheets |
| Keyboard shortcuts | Not shown on touch devices. Keep them working for hardware keyboards |
| Gestures | Swipe left/right = next/previous look. Pinch and double-tap = zoom. Swipe down on a sheet = close. No other custom gestures |
| Sheets | Slide up from the bottom, with a drag handle, a title and a ✕. Close on swipe down, ✕, Back button or tapping the dimmed area. Open within 150ms of the tap (show the sheet immediately, then fill it) |
| Only one sheet at a time | Opening a new sheet closes the current one. Never stack dialogs |
| Back button | Android Back and iOS swipe-back must do the expected thing: close an open sheet first, then leave the show page, then go back through filters. Use `history.pushState` for each sheet and show |
| URLs | Every state worth sharing has a URL: `/entry/mcqueen-ss99?look=3`, `/shows?idea=changing-the-body&decade=1990s`, `/glossary#camp`. Drop the trailing `/0` |
| Scroll position | Returning from a show to the grid restores the exact scroll position |
| Safe areas | Bottom bars and sheets use `padding-bottom: env(safe-area-inset-bottom)`; nothing sits under the iPhone home indicator or notch |
| Viewport height | Use `100dvh`, not `100vh`, so layouts don't jump when Safari's bars show or hide |
| Text input | Search field `type="search"`, `enterkeyhint="search"`, 16px font minimum (anything smaller makes iOS zoom in on focus) |
| Feedback | Every tap gets a visible response within 100ms: pressed state, spinner or skeleton |
| Orientation | Portrait first. In landscape, the image viewer goes full-screen; everything else just reflows |
| Cookie / notice banners | Never cover the bottom bar or toolbar; sit above it, or be dismissible in one tap |

## 6. Performance budget for phones

Target: the first runway picture on screen in under 2.5 seconds on a normal 4G
connection.

| Measure | Target | How to check |
|---|---|---|
| Largest Contentful Paint (first big image) | < 2.5s on mid-range Android, 4G | Lighthouse mobile / PageSpeed Insights |
| Layout shift (CLS) | < 0.1 | Lighthouse; images need width/height set (image-dimensions.js) |
| Tap responsiveness (INP) | < 200ms | Chrome DevTools Performance panel |
| Data + JS before first image | < 200KB compressed | DevTools Network, "Disable cache", Fast 4G |
| Total for a show page | < 1MB on first visit | DevTools Network |

| Item | Now | Change to |
|---|---|---|
| Show data | One ~1,034KB database.js on every page | Build step writes index.json (id, title, year, season, idea, summary, cover; aim < 60KB) + one entries/<id>.json per show, fetched when opened |
| JS modules | 22 modules loaded up front | Load only grid + detail + navigation first. Lazy-load connection-matrix, command-palette, render-index-view, auth, glossary, translations on first use with `import()` |
| Grid images | `*.t480.webp` (good) | Keep; add `loading="lazy"` below the first 4 cards and `fetchpriority="high"` on the first 2 |
| Show images | Original 1920×2880 file on phones | Generate 640 / 960 / 1440px widths. `srcset` + `sizes="100vw"` on mobile. Preload only look 1 |
| Next look | Loaded when swiped | Preload the next look after the current one finishes |
| Fonts | Google Fonts (EB Garamond + mono) | Self-host, subset to Latin, `font-display: swap`, preload the one used above the fold |
| Translations | All languages shipped to everyone | Load the chosen language file only |
| Offline | Service worker caches images | Also cache the last 10 shows opened, so they read on the Tube |

Loading states: grid gets a blurred placeholder per card, never a blank grey
box. Show page: title and summary appear first (they're small), image fades in.
Notes sheet opens instantly with a skeleton, text fills in.

## 7. Mobile accessibility

Most phone users who rely on assistive technology use VoiceOver (iPhone) or
TalkBack (Android) with swipe-to-move, plus large text settings.

| Area | Requirement |
|---|---|
| Screen reader order | Show page reads: show name → summary → image (with alt text) → analysis → facts → sources. The grid behind it is inert while a show is open |
| One heading per screen | One `<h1>` (show name, or "All shows"), section `<h2>`s, nothing hidden that duplicates them |
| Sheets | Announced as dialogs with a name ("Notes: Alexander McQueen SS 1999"); focus moves into the sheet and returns to the button that opened it |
| Swipe alternatives | Every gesture also has a button: ‹ › for looks, + − for zoom, ✕ for sheets |
| Image counter | "Look 3 of 16" announced on change (`aria-live="polite"`) |
| Hotspots | Listed as buttons after the image ("Note 1 of 2: Low Rise Trouser Waist"), so screen-reader users can reach them in order |
| Large text | Layout survives the phone's largest text setting and 200% zoom: no clipped buttons, no overlapping text. Use rem units and let rows wrap |
| Pinch zoom | Never disabled (`user-scalable=no` must not be added) |
| Reduced motion | Already respected; also turn off the sheet slide and image zoom animation |
| Contrast | 4.5:1 for text in both themes; 3:1 for icons and the yellow focus ring on light backgrounds |
| Colour alone | Big-idea chips carry a word, not just a colour |
| Language | `lang` attribute matches the language shown; untranslated English blocks marked `lang="en"` |

## 8. Acceptance checklist

A mobile change is done only when every box below is ticked on a real iPhone
(Safari) and a real Android phone (Chrome), not just in desktop emulation.

**First visit**
- [ ] Opening thelexicon.xyz shows a runway image and the headline within 3 seconds on 4G, with nothing to dismiss first
- [ ] Opening a shared show link shows the show's name and plain summary without scrolling more than one screen
- [ ] No reload bar, overlay or boot text on a first visit

**Browsing**
- [ ] Grid shows 2 columns at 375px and 1 at 320px; no sideways scroll at either
- [ ] First grid image appears in under 2.5s; no empty grey boxes
- [ ] Filter sheet opens, filters, shows a result count, and closes with Back
- [ ] Returning from a show restores the grid scroll position

**Show page**
- [ ] Swipe changes look; "3 / 16" counter updates; pinch zoom works
- [ ] Tapping a hotspot opens its note sheet; "Next note" steps through
- [ ] Notes / analysis readable at 18px without zooming
- [ ] Phone Back closes a sheet before leaving the page
- [ ] Page scroll (not an inner panel) moves the content; Safari's address bar collapses on scroll
- [ ] Nothing hidden under the home indicator or the cookie banner

**Quality bars**
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95
- [ ] All tap targets ≥ 44×44px (automated: `npm run test:mobile`)
- [ ] VoiceOver: a full show can be read top to bottom with swipes alone
- [ ] Largest phone text size: no clipped or overlapping text
- [ ] `npm run preflight` passes
