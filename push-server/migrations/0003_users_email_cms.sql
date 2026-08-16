PRAGMA foreign_keys = ON;

-- Regular WOPT users do not have accounts or passwords. They subscribe by email
-- and manage preferences through secure email links. GPS coordinates + timezone
-- are the source of truth; city/country are auto-resolved metadata.
CREATE TABLE IF NOT EXISTS email_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timezone TEXT NOT NULL,
  country_code TEXT,
  country_name TEXT,
  region TEXT,
  city TEXT,
  calculation_method INTEGER,
  madhab TEXT NOT NULL DEFAULT 'standard' CHECK (madhab IN ('standard', 'hanafi')),
  location_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed', 'bounced', 'disabled')),
  verification_token_hash TEXT,
  verification_expires_at TEXT,
  manage_token_hash TEXT NOT NULL UNIQUE,
  verified_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_subscribers_location_status
  ON email_subscribers(status, timezone, country_code, city);

CREATE TABLE IF NOT EXISTS subscriber_email_preferences (
  subscriber_id INTEGER PRIMARY KEY,
  prayer_alerts INTEGER NOT NULL DEFAULT 1 CHECK (prayer_alerts IN (0, 1)),
  daily_prayer_schedule INTEGER NOT NULL DEFAULT 0 CHECK (daily_prayer_schedule IN (0, 1)),
  religious_occasions INTEGER NOT NULL DEFAULT 1 CHECK (religious_occasions IN (0, 1)),
  daily_content INTEGER NOT NULL DEFAULT 0 CHECK (daily_content IN (0, 1)),
  announcements INTEGER NOT NULL DEFAULT 1 CHECK (announcements IN (0, 1)),
  community_events INTEGER NOT NULL DEFAULT 1 CHECK (community_events IN (0, 1)),
  marketing INTEGER NOT NULL DEFAULT 0 CHECK (marketing IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(subscriber_id) REFERENCES email_subscribers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriber_prayer_preferences (
  subscriber_id INTEGER NOT NULL,
  prayer TEXT NOT NULL CHECK (prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  email_twenty INTEGER NOT NULL DEFAULT 0 CHECK (email_twenty IN (0, 1)),
  email_ten INTEGER NOT NULL DEFAULT 0 CHECK (email_ten IN (0, 1)),
  email_athan INTEGER NOT NULL DEFAULT 1 CHECK (email_athan IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(subscriber_id, prayer),
  FOREIGN KEY(subscriber_id) REFERENCES email_subscribers(id) ON DELETE CASCADE
);

-- Admin-only authentication. Regular subscribers never use this table.
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'editor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_signed_in_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_active
  ON admin_sessions(admin_user_id, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS admin_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'announcement' CHECK (
    category IN ('prayer', 'daily_schedule', 'religious_occasion', 'daily_content', 'announcement', 'community_event', 'marketing', 'system')
  ),
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
  category TEXT NOT NULL DEFAULT 'announcement' CHECK (
    category IN ('religious_occasion', 'daily_content', 'announcement', 'community_event', 'marketing', 'system')
  ),
  audience TEXT NOT NULL DEFAULT 'all_subscribers' CHECK (audience IN ('all_subscribers', 'custom')),
  target_locale TEXT NOT NULL DEFAULT 'all' CHECK (target_locale IN ('all', 'en', 'ar')),
  target_country_code TEXT,
  target_city TEXT,
  target_timezone TEXT,
  target_filter_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  scheduled_at TEXT,
  started_at TEXT,
  sent_at TEXT,
  created_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(template_key) REFERENCES email_templates(template_key) ON DELETE SET NULL,
  FOREIGN KEY(created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status_scheduled
  ON email_campaigns(status, scheduled_at);

CREATE TABLE IF NOT EXISTS email_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT,
  campaign_id INTEGER,
  subscriber_id INTEGER,
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
  FOREIGN KEY(subscriber_id) REFERENCES email_subscribers(id) ON DELETE SET NULL,
  FOREIGN KEY(template_key) REFERENCES email_templates(template_key) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_status_created
  ON email_deliveries(status, created_at);

-- A device can optionally be linked to the email subscriber who signed up on it.
ALTER TABLE subscriptions ADD COLUMN subscriber_id INTEGER REFERENCES email_subscribers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_enabled
  ON subscriptions(subscriber_id, enabled);
