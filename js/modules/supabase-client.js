/**
 * js/modules/supabase-client.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches the full archive from Supabase and returns it in the same shape
 * as the local `archiveData` array built by build-data.mjs.
 *
 * app.js calls fetchArchiveData() on boot. If USE_SUPABASE is false (no env
 * vars configured) or if the request fails, app.js falls back to the static
 * database.js import — so local dev and emergency offline mode both work
 * without any Supabase credentials.
 *
 * The anon key is intentionally public: RLS (supabase/rls.sql) restricts all
 * writes, so the worst a bad actor can do with it is read the same data the
 * site already shows.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_SUPABASE } from '../env.js';

/**
 * Fetches all archive entries from Supabase.
 * @returns {Promise<Array|null>} archiveData-shaped array, or null if Supabase
 *   is not configured (caller falls back to database.js).
 */
export async function fetchArchiveData() {
  if (!USE_SUPABASE) return null;

  const url =
    `${SUPABASE_URL}/rest/v1/entries` +
    `?select=*,entry_tags(*),entry_notes(*),entry_images(*,image_hotspots(*))` +
    `&order=sort_order.asc` +
    `&status=eq.published`;          // exclude placeholders from public view

  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Accept':        'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`[LEXICON] Supabase returned ${res.status} for entries fetch`);
  }

  const rows = await res.json();
  return rows.map(normalise);
}

// ── Shape normaliser ──────────────────────────────────────────────────────────
/**
 * Transforms a Supabase REST row (with nested relations) back into the flat
 * shape that every LEXICON module expects:
 *   { id, title, subtitle?, year, season, volume, images[], tags{}, notes{} }
 */
function normalise(row) {
  // Images, sorted, with their hotspots sorted
  const images = (row.entry_images || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(img => {
      const hotspots = (img.image_hotspots || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(h => ({
          x:           h.x,
          y:           h.y,
          label:       h.label,
          ...(h.description ? { description: h.description } : {}),
        }));

      return {
        src:    img.src,
        ...(img.alt    ? { alt:    img.alt    } : {}),
        ...(img.width  ? { width:  img.width  } : {}),
        ...(img.height ? { height: img.height } : {}),
        ...(hotspots.length ? { hotspots } : {}),
      };
    });

  // Tags — strip the join key, drop nulls so downstream code sees the same
  // shape as the JSON entry files
  const tags = {};
  if (row.entry_tags) {
    for (const [k, v] of Object.entries(row.entry_tags)) {
      if (k === 'entry_id' || v == null) continue;
      tags[k] = v;
    }
  }

  // Notes — same treatment
  const notes = {};
  if (row.entry_notes) {
    for (const [k, v] of Object.entries(row.entry_notes)) {
      if (k === 'entry_id' || v == null) continue;
      notes[k] = v;
    }
  }

  return {
    id:       row.id,
    title:    row.title,
    ...(row.subtitle ? { subtitle: row.subtitle } : {}),
    year:     row.year,
    season:   row.season,
    volume:   row.volume,
    images,
    tags,
    notes,
  };
}
