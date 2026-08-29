CREATE TABLE IF NOT EXISTS wall_displays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Hassoun Wall Display',
  device_token TEXT NOT NULL UNIQUE,
  pairing_code TEXT,
  pairing_expires_at TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  settings_version INTEGER NOT NULL DEFAULT 0,
  command_json TEXT,
  command_version INTEGER NOT NULL DEFAULT 0,
  status_json TEXT NOT NULL DEFAULT '{}',
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wall_displays_pairing_code
  ON wall_displays(pairing_code);

CREATE TABLE IF NOT EXISTS wall_controllers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id INTEGER NOT NULL,
  controller_installation_id TEXT NOT NULL,
  controller_token TEXT NOT NULL UNIQUE,
  controller_name TEXT NOT NULL DEFAULT 'Hassoun Controller',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  FOREIGN KEY(display_id) REFERENCES wall_displays(id) ON DELETE CASCADE,
  UNIQUE(display_id, controller_installation_id)
);

CREATE INDEX IF NOT EXISTS idx_wall_controllers_display
  ON wall_controllers(display_id);
