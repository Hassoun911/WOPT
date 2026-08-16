PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_signed_in_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_status_email
  ON users(status, email);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  user_id INTEGER,
  purpose TEXT NOT NULL CHECK (purpose IN ('sign_in', 'verify_email', 'change_email')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_email_purpose
  ON auth_challenges(email, purpose, expires_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  platform TEXT CHECK (platform IN ('android', 'ios', 'web')),
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON user_sessions(user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id INTEGER PRIMARY KEY,
  email_enabled INTEGER NOT NULL DEFAULT 1 CHECK (email_enabled IN (0, 1)),
  push_enabled INTEGER NOT NULL DEFAULT 1 CHECK (push_enabled IN (0, 1)),
  religious_occasions_email INTEGER NOT NULL DEFAULT 1 CHECK (religious_occasions_email IN (0, 1)),
  religious_occasions_push INTEGER NOT NULL DEFAULT 1 CHECK (religious_occasions_push IN (0, 1)),
  daily_content_email INTEGER NOT NULL DEFAULT 0 CHECK (daily_content_email IN (0, 1)),
  marketing_email INTEGER NOT NULL DEFAULT 0 CHECK (marketing_email IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_prayer_preferences (
  user_id INTEGER NOT NULL,
  prayer TEXT NOT NULL CHECK (prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  push_twenty INTEGER NOT NULL DEFAULT 1 CHECK (push_twenty IN (0, 1)),
  push_ten INTEGER NOT NULL DEFAULT 1 CHECK (push_ten IN (0, 1)),
  push_athan INTEGER NOT NULL DEFAULT 1 CHECK (push_athan IN (0, 1)),
  email_twenty INTEGER NOT NULL DEFAULT 0 CHECK (email_twenty IN (0, 1)),
  email_ten INTEGER NOT NULL DEFAULT 0 CHECK (email_ten IN (0, 1)),
  email_athan INTEGER NOT NULL DEFAULT 0 CHECK (email_athan IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, prayer),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject_en TEXT NOT NULL,
  subject_ar TEXT,
  html_en TEXT NOT NULL,
  html_ar TEXT,
  text_en TEXT,
  text_ar TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  template_key TEXT,
  audience TEXT NOT NULL DEFAULT 'all_users',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at TEXT,
  sent_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(template_key) REFERENCES email_templates(template_key) ON DELETE SET NULL,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT,
  campaign_id INTEGER,
  user_id INTEGER,
  recipient_email TEXT NOT NULL COLLATE NOCASE,
  template_key TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'unsubscribed')),
  error_code TEXT,
  error_message TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(campaign_id) REFERENCES email_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(template_key) REFERENCES email_templates(template_key) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_status_created
  ON email_deliveries(status, created_at);

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  scope TEXT NOT NULL DEFAULT 'marketing' CHECK (scope IN ('marketing', 'daily_content', 'religious_occasions', 'all_email')),
  token TEXT NOT NULL UNIQUE,
  unsubscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email, scope)
);

ALTER TABLE subscriptions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_enabled
  ON subscriptions(user_id, enabled);
