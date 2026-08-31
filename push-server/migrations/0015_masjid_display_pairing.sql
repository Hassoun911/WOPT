CREATE TABLE IF NOT EXISTS masjid_displays (
  device_id TEXT PRIMARY KEY,
  pair_code TEXT NOT NULL UNIQUE,
  device_secret TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Masjid Display',
  settings_json TEXT NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS masjid_display_controllers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  controller_token TEXT NOT NULL UNIQUE,
  controller_name TEXT NOT NULL DEFAULT 'Hassoun Browser',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES masjid_displays(device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_masjid_display_pair_code ON masjid_displays(pair_code);
CREATE INDEX IF NOT EXISTS idx_masjid_display_controller_device ON masjid_display_controllers(device_id);
