-- ═══════════════════════════════════════════════════════════════════════════
-- THE LEXICON :: Supabase Schema
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Core entries ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entries (
  id           TEXT        PRIMARY KEY,
  title        TEXT        NOT NULL,
  subtitle     TEXT,
  year         INTEGER     NOT NULL,
  season       TEXT        NOT NULL
                           CHECK (season IN ('SS','AW','Resort','Pre-Fall','Couture')),
  volume       INTEGER     NOT NULL DEFAULT 1,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'published'
                           CHECK (status IN ('published','draft','placeholder')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tags (one row per entry, mirrors the tags{} block in JSON) ──────────────
CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id   TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  format     TEXT,
  gender     TEXT,
  geography  TEXT,
  decade     TEXT,
  politics   TEXT,
  subculture TEXT,
  silhouette TEXT,
  textile    TEXT,
  archival   TEXT
);

-- ── Editorial notes (one row per entry) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS entry_notes (
  entry_id   TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
  provenance TEXT,
  strategy   TEXT,
  critique   TEXT
);

-- ── Images (ordered by sort_order) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entry_images (
  id         SERIAL  PRIMARY KEY,
  entry_id   TEXT    NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  src        TEXT    NOT NULL,
  alt        TEXT,
  width      INTEGER,
  height     INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── Hotspots ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_hotspots (
  id          SERIAL  PRIMARY KEY,
  image_id    INTEGER NOT NULL REFERENCES entry_images(id) ON DELETE CASCADE,
  x           NUMERIC(5,2) NOT NULL,
  y           NUMERIC(5,2) NOT NULL,
  label       TEXT    NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_entries_volume
  ON entries (volume);

CREATE INDEX IF NOT EXISTS idx_entries_year
  ON entries (year);

CREATE INDEX IF NOT EXISTS idx_entries_sort
  ON entries (sort_order);

CREATE INDEX IF NOT EXISTS idx_entry_images_entry
  ON entry_images (entry_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_hotspots_image
  ON image_hotspots (image_id, sort_order);

-- ── updated_at auto-stamp ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entries_updated_at ON entries;
CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
