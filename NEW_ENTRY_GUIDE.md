# New Entry Guide

Everything you need to research, write, and source before running `npm run new-entry`.  
Fill every section below before opening the JSON file. A half-filled entry is worse than no entry — the archive rewards density.

---

## 1. Identify the show

Answer these before anything else:

| Field | What you need |
|---|---|
| **Designer / creative director** | Full name as they were credited at the time |
| **House / label** | Official brand name (e.g. "Christian Dior", not "Dior") |
| **Season** | SS (Spring/Summer) or AW (Autumn/Winter) |
| **Year** | Calendar year the show was presented (not the retail season) |
| **Show title / subtitle** | If the show had a named theme or subtitle (e.g. "Clochard", "Bumsters") — optional |
| **Presentation date** | Exact date if known |
| **Venue** | City + specific location (e.g. "Palais Royal, Paris") |
| **City / fashion week** | Paris, Milan, London, New York, Tokyo, or independent |
| **Format** | Was it a catwalk, a film, an installation, a performance, a lookbook? |

**Slug rule:** `<house>-<season><year>` in lowercase, hyphens only.  
Examples: `galliano-dior-ss00`, `mcqueen-ss99`, `owens-ss14`  
If the designer is the brand: `mcqueen-ss99` (not `alexander-mcqueen-ss99`).

---

## 2. Research the provenance

The **provenance note** is the factual record: what happened, who was involved, where, why it matters historically. Minimum 50 words. Aim for 120–200.

Gather:
- Biographical context for the designer at that moment (what career stage, what critical moment, what was their brief?)
- Key collaborators credited for this show (stylist, set designer, music, hair, makeup)
- Industry context (was this the designer's debut, their last collection, a turning point?)
- Reception — how was it received at the time? Press quotes if available
- Any documented narrative or stated intention from the designer

Primary sources preferred: contemporaneous reviews (Vogue, i-D, The Face, Dazed, WWD), documentaries, designer interviews from the period.

---

## 3. Write the critique

The **critique note** is the theoretical / cultural reading: what does the work *do* and what does it *mean*? Minimum 50 words. Aim for 120–200.

This is not a review — it's an analysis. Connect the collection to:
- The political / social moment it emerged from
- Relevant cultural theory (body politics, gender performance, post-colonialism, technology, etc.)
- How it deconstructs or extends fashion conventions
- What subcultural or art movements it draws on or responds to

Write in the register of cultural criticism. No hedging. Make an argument.

---

## 4. Write the strategy

The **strategy note** is the designer's structural / process logic: how was it made, and why those choices? Minimum 50 words. Aim for 100–150.

Cover:
- Construction techniques (tailoring methods, deconstruction, draping, etc.)
- Material experiments (what fabrics, finishes, found objects)
- The silhouette thesis — what body shape is being proposed and why
- Any explicit conceptual or craft departures from convention

---

## 5. Tags — fill all 9 axes

Every tag is a **free-text string**. Be specific. Look at existing entries for register and granularity.

| Tag | What it captures | Example values |
|---|---|---|
| `brand` | House name as credited | `"John Galliano for Christian Dior"`, `"Comme des Garçons"` |
| `era` | Decade range + descriptor | `"1990–2000; Anti-Fashion Decade"`, `"2010–2020; Post-Digital Baroque"` |
| `politics` | The political body of the work | `"Body Politics & Corporeal Interventions"`, `"Post-Colonial Dress Codes"` |
| `theories` | Primary critical lens | `"Abjection Theory"`, `"Queer Phenomenology"`, `"Cyborg Feminism"` |
| `gender` | Gendered address of the garments | `"Womenswear"`, `"Non-Binary Spectrum"`, `"Menswear as Fetish Object"` |
| `materials` | Dominant fabric / material logic | `"Bias-Cut Silk & Vintage Textile"`, `"Industrial Neoprene"`, `"Biological Ephemera"` |
| `geography` | City of presentation + fashion week body | `"Paris (Chambre Syndicale)"`, `"London (BFC)"`, `"Tokyo (independent)"` |
| `anatomy` | How the collection relates to the body | `"Prosthetic Extension"`, `"Exposed Spine"`, `"Dissolved Silhouette"` |
| `format` | Type of presentation | `"Catwalk"`, `"Theatrical Stage Performance"`, `"Film / Video Release"` |

---

## 6. Images

### How many
- Minimum: 5 images
- Ideal: 8–12 images
- Maximum: 16 images
- Cover a range of looks — opening look, key looks, closing look, any viral or defining moment

### Quality
- Minimum 1200px on the long edge (the optimiser will handle anything larger)
- Runway photography (not editorial, not campaign) preferred — archival documentary images
- If sourcing from archives or press: confirm the image shows this specific show, not a different season
- No watermarks, no agency branding overlays if avoidable

### Naming
Sequential, zero-padded, matching the slug:
```
<slug>-01.jpg
<slug>-02.jpg
...
<slug>-14.jpg
```
Two-digit padding. JPG or PNG. The optimiser writes `.webp` siblings automatically.

### Where to source
- Firstview (firstview.com) — the definitive runway archive
- Vogue Runway (vogue.com/fashion-shows)
- Style.com archive (accessible via Wayback Machine)
- Getty Images / Rex / Shutterstock (for editorial use — check your licence)
- Museum and gallery digital collections (often open-access for research)
- Scanned from print: Dazed, i-D, Vogue, Purple, Tank, Arena Homme+

### What makes a good selection
- Each image should show something different — silhouette, detail, fabric, styling, context
- At least one image where the model is at full length
- At least one close-up or detail shot if available
- Avoid: near-identical poses of different looks (prefer one strong image of each look over ten weak ones)

---

## 7. Hotspots

Each image should have **3 hotspots** (the validator doesn't enforce a minimum per image, but 3 is the editorial standard).

### What a hotspot is
A pinned annotation on a specific point in the image. It has:
- `x` / `y` — percentage coordinates from top-left (0–100)
- `label` — 3–10 words, the name of what you're pointing to
- `description` — 30+ characters, analytical reading of that specific detail

### What makes a good hotspot
- Point at something **specific and visible**: a seam, a fabric texture, a silhouette edge, a construction detail, a styling choice
- The description should add something the image alone doesn't tell you — a material reading, a theoretical frame, a historical reference
- Vary what you annotate across images: don't annotate "exposed spine" on every image if you can annotate construction, material, and silhouette across three different images
- Avoid annotating the background or set unless the environment is architecturally significant to the concept

### Label examples
`"Bias-cut bodice"`, `"Deconstructed hem"`, `"Prosthetic hip form"`, `"Raw selvedge edge"`, `"Inverted seam allowance"`

### Description examples
> "The bias cut redistributes fabric weight to follow the body's own gravity rather than imposing structural shape — a technique Vionnet codified in the 1930s that Galliano here destabilises with deliberate diagonal grain misalignment."

> "Neoprene panels sewn with exposed topstitch reference technical sportswear fabrication, collapsing the boundary between protective gear and couture structure."

---

## 8. The command sequence (once you have everything)

```bash
# 1. Scaffold
npm run new-entry <slug>

# 2. Drop images in
#    public/THE-LEXICON-ASSETS/<slug>/

# 3. Fill the JSON
#    content/entries/<slug>.json
#    (your editor will autocomplete from the $schema)

# 4. Optimise images
npm run optimize-images

# 5. Preflight (validates + builds all artifacts)
npm run preflight

# 6. Check stats
npm run stats

# 7. Commit
git add . && git commit -m "entry: <slug>"
```

---

## Quick reference: minimum viable entry

| Field | Minimum |
|---|---|
| Images | 5 |
| Hotspots | 3 per image (convention; not hard-enforced) |
| Notes | 50 words each (provenance, critique, strategy) |
| Tags | All 9 axes filled |
| ID | Matches filename, matches order.json |

An entry that meets these minimums is publishable. An entry that exceeds them is archival.
