PRAGMA foreign_keys = ON;

-- Generic remote configuration used by both the mobile app and the Admin CRM.
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  group_name TEXT NOT NULL DEFAULT 'general',
  label TEXT NOT NULL,
  value_json TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  description TEXT,
  updated_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_settings_group
  ON app_settings(group_name, setting_key);

INSERT OR IGNORE INTO app_settings(setting_key, group_name, label, value_json, is_public, description)
VALUES
  ('feature_flags', 'app', 'Feature flags',
   '{"prayerTimes":true,"adhan":true,"quran":true,"quranRadio":true,"memorize":true,"quiz":true,"multiplayerGames":true,"islamicEvents":true,"widgets":true,"emailAlerts":true,"support":true}',
   1, 'Master switches for user-facing Hassoun features.'),
  ('app_ui', 'app', 'App UI',
   '{"maintenanceMode":false,"maintenanceMessageEn":"Hassoun is temporarily under maintenance.","maintenanceMessageAr":"تطبيق Hassoun تحت الصيانة مؤقتاً.","homeAnnouncementEnabled":false,"homeAnnouncementEn":"","homeAnnouncementAr":""}',
   1, 'Remote app UI and maintenance controls.'),
  ('prayer_config', 'prayer', 'Prayer configuration',
   '{"mode":"windsor_official","locationLabel":"Windsor, Ontario","sourceLabel":"Windsor Islamic Association","timezone":"America/Toronto","allowLocationDetection":false}',
   1, 'Prayer source and location behavior.'),
  ('quran_config', 'quran', 'Quran configuration',
   '{"readerEnabled":true,"audioEnabled":true,"radioEnabled":true,"memorizeEnabled":true,"defaultReciterId":"ar.alafasy","defaultBitrate":128}',
   1, 'Quran reader, audio and memorization controls.'),
  ('store_release', 'release', 'Store release',
   '{"marketingVersion":"1.0.0","androidMinimumVersion":"1.0.0","iosMinimumVersion":"1.0.0","forceUpdate":false,"androidStoreUrl":"","iosStoreUrl":""}',
   1, 'Minimum versions and optional force-update controls.'),
  ('admin_release_notes', 'release', 'Internal release notes',
   '{"current":"Hassoun 1.0 store hardening and Admin CRM development."}',
   0, 'Internal-only release notes for administrators.');

-- CMS content that can be published without rebuilding the app.
CREATE TABLE IF NOT EXISTS app_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  content_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'announcement' CHECK (
    content_type IN ('announcement', 'banner', 'daily_inspiration', 'islamic_event', 'help', 'legal_notice', 'custom')
  ),
  locale TEXT NOT NULL DEFAULT 'both' CHECK (locale IN ('en', 'ar', 'both')),
  title TEXT,
  body TEXT,
  image_url TEXT,
  deep_link TEXT,
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  starts_at TEXT,
  ends_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_admin_id INTEGER,
  updated_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_content_publish
  ON app_content(status, content_type, starts_at, ends_at, sort_order);
CREATE INDEX IF NOT EXISTS idx_app_content_key
  ON app_content(content_key, locale);

-- Admin overrides are merged on top of the official Windsor schedule at runtime.
CREATE TABLE IF NOT EXISTS prayer_time_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_key TEXT NOT NULL,
  prayer TEXT NOT NULL CHECK (prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  time_value TEXT NOT NULL,
  reason TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date_key, prayer),
  FOREIGN KEY(updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prayer_time_overrides_date
  ON prayer_time_overrides(date_key, enabled);

-- Support requests become CRM tickets instead of existing only as emails.
CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  platform TEXT,
  app_version TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_admin_id INTEGER,
  internal_note TEXT,
  email_delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_delivery_status IN ('pending', 'sent', 'failed', 'not_configured')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY(assigned_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status, priority, created_at);

-- Store/release readiness is visible in the CRM without exposing secrets.
CREATE TABLE IF NOT EXISTS release_checks (
  check_key TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'shared')),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pass', 'fail', 'not_applicable')),
  details TEXT,
  evidence_url TEXT,
  updated_by_admin_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO release_checks(check_key, platform, label, status, details) VALUES
  ('android_exact_alarm', 'android', 'Play-safe exact alarm permission', 'pass', 'Store branch uses SCHEDULE_EXACT_ALARM and rejects USE_EXACT_ALARM.'),
  ('android_target_api_36', 'android', 'Target Android API 36', 'pending', 'Validated by clean store CI before submission.'),
  ('android_aab', 'android', 'Signed Play Store AAB', 'pending', 'Production EAS build required.'),
  ('android_fgs', 'android', 'Foreground service declaration', 'pending', 'Media playback declaration and Play Console explanation/video required.'),
  ('ios_audio', 'ios', 'Background Quran audio', 'pending', 'Native iOS playback parity and lock-screen controls require validation.'),
  ('ios_speech', 'ios', 'Quran recitation speech', 'pending', 'Speech framework parity or feature-gated iOS release required.'),
  ('ios_widgets', 'ios', 'WidgetKit widgets', 'pending', 'iOS widget extension still required for parity.'),
  ('ios_privacy_manifest', 'ios', 'Privacy manifest', 'pending', 'PrivacyInfo.xcprivacy audit required.'),
  ('privacy_policy', 'shared', 'Public privacy policy', 'pass', 'Hassoun privacy policy is already published in the PWA.'),
  ('store_metadata', 'shared', 'Store metadata and screenshots', 'pending', 'Final copy, screenshots and declarations required before submission.');
