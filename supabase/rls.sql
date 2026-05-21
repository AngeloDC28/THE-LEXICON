-- ═══════════════════════════════════════════════════════════════════════════
-- THE LEXICON :: Row Level Security
-- Run after schema.sql.
--
-- Policy: anonymous visitors can read everything. Nobody can write via the
-- public API — all mutations go through the service-role key (migration
-- script only, never exposed client-side).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_hotspots ENABLE ROW LEVEL SECURITY;

-- Drop then recreate so this file is safe to re-run.
DROP POLICY IF EXISTS "public_read_entries"        ON entries;
DROP POLICY IF EXISTS "public_read_entry_tags"     ON entry_tags;
DROP POLICY IF EXISTS "public_read_entry_notes"    ON entry_notes;
DROP POLICY IF EXISTS "public_read_entry_images"   ON entry_images;
DROP POLICY IF EXISTS "public_read_image_hotspots" ON image_hotspots;

CREATE POLICY "public_read_entries"
  ON entries        FOR SELECT TO anon USING (true);

CREATE POLICY "public_read_entry_tags"
  ON entry_tags     FOR SELECT TO anon USING (true);

CREATE POLICY "public_read_entry_notes"
  ON entry_notes    FOR SELECT TO anon USING (true);

CREATE POLICY "public_read_entry_images"
  ON entry_images   FOR SELECT TO anon USING (true);

CREATE POLICY "public_read_image_hotspots"
  ON image_hotspots FOR SELECT TO anon USING (true);

-- ── Future: authenticated user folders ──────────────────────────────────────
-- When you add user_folders / bookmarks tables, add policies here.
-- Pattern:
--   CREATE POLICY "owner_all_folders"
--     ON user_folders FOR ALL
--     USING  (auth.uid() = user_id)
--     WITH CHECK (auth.uid() = user_id);
