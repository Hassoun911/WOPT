PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS voice_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_login_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('oauth','manage')),
  request_json TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES voice_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_voice_login_codes_lookup ON voice_login_codes(account_id,purpose,consumed_at,expires_at);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES voice_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_oauth_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES voice_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  access_expires_at TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES voice_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timezone TEXT NOT NULL,
  calculation_method INTEGER,
  madhab TEXT NOT NULL DEFAULT 'standard' CHECK (madhab IN ('standard','hanafi')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES voice_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_voice_locations_account ON voice_locations(account_id,is_default);

CREATE TABLE IF NOT EXISTS alexa_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL,
  alexa_user_hash TEXT NOT NULL,
  alexa_device_hash TEXT NOT NULL,
  label TEXT,
  location_id INTEGER,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES voice_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY(location_id) REFERENCES voice_locations(id) ON DELETE SET NULL,
  UNIQUE(account_id, alexa_device_hash)
);
CREATE INDEX IF NOT EXISTS idx_alexa_devices_account ON alexa_devices(account_id,last_seen_at);
