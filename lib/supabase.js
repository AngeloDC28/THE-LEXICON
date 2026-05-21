/**
 * lib/supabase.js
 * Supabase client for the Next.js app.
 *
 * Server components use this directly — the anon key is safe to expose
 * since RLS policies restrict all writes. For server-only operations
 * (admin/migration) use the service key in a separate server-only client.
 *
 * Environment variables (set in Vercel for the nextjs branch):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('[LEXICON] Supabase env vars not set — data fetching will fail.');
}

export const supabase = createClient(url || '', key || '');

/**
 * Fetch all published entries ordered by sort_order.
 * Returns the full normalised shape used by all components.
 */
export async function fetchAllEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select(`
      id, title, subtitle, year, season, volume, sort_order,
      entry_tags ( brand, era, format, gender, geography, materials, politics, theories, anatomy ),
      entry_notes ( provenance, strategy, critique ),
      entry_images (
        id, src, alt, width, height, sort_order,
        image_hotspots ( x, y, label, description, sort_order )
      )
    `)
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`fetchAllEntries: ${error.message}`);
  return data.map(normalise);
}

/**
 * Fetch a single entry by slug (id).
 */
export async function fetchEntry(slug) {
  const { data, error } = await supabase
    .from('entries')
    .select(`
      id, title, subtitle, year, season, volume, sort_order,
      entry_tags ( brand, era, format, gender, geography, materials, politics, theories, anatomy ),
      entry_notes ( provenance, strategy, critique ),
      entry_images (
        id, src, alt, width, height, sort_order,
        image_hotspots ( x, y, label, description, sort_order )
      )
    `)
    .eq('id', slug)
    .eq('status', 'published')
    .single();

  if (error) return null;
  return normalise(data);
}

// ── Shape normaliser ──────────────────────────────────────────────────────────
function normalise(row) {
  const images = (row.entry_images || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(img => ({
      src:      img.src,
      alt:      img.alt    || null,
      width:    img.width  || null,
      height:   img.height || null,
      hotspots: (img.image_hotspots || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(h => ({ x: h.x, y: h.y, label: h.label, description: h.description || null })),
    }));

  const tags = {};
  if (row.entry_tags) {
    for (const [k, v] of Object.entries(row.entry_tags)) {
      if (v != null) tags[k] = v;
    }
  }

  const notes = {};
  if (row.entry_notes) {
    for (const [k, v] of Object.entries(row.entry_notes)) {
      if (v != null) notes[k] = v;
    }
  }

  return {
    id:       row.id,
    title:    row.title,
    subtitle: row.subtitle || null,
    year:     row.year,
    season:   row.season,
    volume:   row.volume,
    images,
    tags,
    notes,
  };
}
