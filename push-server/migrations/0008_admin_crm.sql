PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  description TEXT,
  updated_by_admin_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO app_settings (setting_key, value_json, description) VALUES
  ('maintenance_mode', 'false', 'Temporarily place public clients into maintenance mode.'),
  ('minimum_android_version', '"1.0.0"', 'Minimum supported Android app version.'),
  ('minimum_ios_version', '"1.0.0"', 'Minimum supported iOS app version.'),
  ('force_update_android', 'false', 'Require Android users below the minimum version to update.'),
  ('force_update_ios', 'false', 'Require iOS users below the minimum version to update.'),
  ('quran_enabled', 'true', 'Master switch for Quran features.'),
  ('games_enabled', 'true', 'Master switch for games and quizzes.'),
  ('email_enabled', 'true', 'Master switch for subscriber email features.'),
  ('community_content_enabled', 'true', 'Master switch for community content.'),
  ('system_banner', '{"enabled":false,"title":"","message":""}', 'Optional app-wide banner message.');

CREATE TABLE IF NOT EXISTS app_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('ayah', 'hadith', 'dua', 'announcement', 'event', 'quran_source', 'reciter', 'quiz')),
  title_en TEXT NOT NULL,
  title_ar TEXT,
  body_en TEXT,
  body_ar TEXT,
  source_text TEXT,
  metadata_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  starts_at TEXT,
  ends_at TEXT,
  created_by_admin_id INTEGER,
  updated_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_content_type_status ON app_content(content_type, status, featured);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_user_id, created_at DESC);
