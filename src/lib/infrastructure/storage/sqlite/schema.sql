-- RV Reservation Demo – SQLite Schema v1
-- Date columns store ISO 8601 local calendar dates (YYYY-MM-DD).
-- All TEXT columns use UTF-8 encoding (SQLite default).

-- Tracks applied schema migrations for safe upgrades.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version  INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Parking location names (row order preserved by sort_order).
CREATE TABLE IF NOT EXISTS parking_locations (
  name       TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL
);

-- Guest reservations. One row per booking.
CREATE TABLE IF NOT EXISTS reservations (
  id                INTEGER PRIMARY KEY,  -- matches Reservation.index
  name              TEXT    NOT NULL,
  phone_number      TEXT    NOT NULL DEFAULT '',
  notes             TEXT    NOT NULL DEFAULT '',
  start_date        TEXT    NOT NULL,      -- YYYY-MM-DD
  end_date          TEXT    NOT NULL,      -- YYYY-MM-DD (exclusive)
  parking_location  TEXT    NOT NULL REFERENCES parking_locations(name),
  color             TEXT    NOT NULL DEFAULT 'blue',
  CHECK (start_date < end_date),
  CHECK (color IN ('red','green','blue','yellow','pink','orange','purple'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_location_dates
  ON reservations(parking_location, start_date, end_date);

-- Application-level counters and metadata.
CREATE TABLE IF NOT EXISTS app_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Expected keys: 'next_reservation_index', 'last_saved_at'

-- Site-wide settings (admin passcode, display name, etc.).
CREATE TABLE IF NOT EXISTS admin_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Expected keys: 'site_name', 'admin_passcode'
