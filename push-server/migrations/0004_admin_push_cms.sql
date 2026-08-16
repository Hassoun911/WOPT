PRAGMA foreign_keys = ON;

ALTER TABLE user_notification_preferences
  ADD COLUMN announcements_push INTEGER NOT NULL DEFAULT 1 CHECK (announcements_push IN (0, 1));

ALTER TABLE user_notification_preferences
  ADD COLUMN community_events_push INTEGER NOT NULL DEFAULT 1 CHECK (community_events_push IN (0, 1));

ALTER TABLE user_notification_preferences
  ADD COLUMN marketing_push INTEGER NOT NULL DEFAULT 0 CHECK (marketing_push IN (0, 1));

CREATE TABLE IF NOT EXISTS push_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'announcement' CHECK (
    category IN ('announcement', 'religious_occasion', 'community_event', 'daily_content', 'marketing', 'system')
  ),
  title_en TEXT NOT NULL,
  title_ar TEXT,
  body_en TEXT NOT NULL,
  body_ar TEXT,
  deep_link TEXT,
  image_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  template_key TEXT,
  category TEXT NOT NULL DEFAULT 'announcement' CHECK (
    category IN ('announcement', 'religious_occasion', 'community_event', 'daily_content', 'marketing', 'system')
  ),
  title_en TEXT NOT NULL,
  title_ar TEXT,
  body_en TEXT NOT NULL,
  body_ar TEXT,
  deep_link TEXT,
  image_url TEXT,
  audience TEXT NOT NULL DEFAULT 'all_users' CHECK (
    audience IN ('all_users', 'registered_users', 'anonymous_devices', 'custom')
  ),
  target_platform TEXT NOT NULL DEFAULT 'all' CHECK (
    target_platform IN ('all', 'android', 'ios', 'web')
  ),
  target_locale TEXT NOT NULL DEFAULT 'all' CHECK (
    target_locale IN ('all', 'en', 'ar')
  ),
  target_filter_json TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')
  ),
  scheduled_at TEXT,
  started_at TEXT,
  sent_at TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(template_key) REFERENCES push_templates(template_key) ON DELETE SET NULL,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_push_campaigns_status_scheduled
  ON push_campaigns(status, scheduled_at);

CREATE TABLE IF NOT EXISTS push_campaign_deliveries (
  campaign_id INTEGER NOT NULL,
  subscription_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'failed', 'invalid_device', 'skipped')
  ),
  provider_ticket_id TEXT,
  error_code TEXT,
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(campaign_id, subscription_id),
  FOREIGN KEY(campaign_id) REFERENCES push_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_campaign_deliveries_status
  ON push_campaign_deliveries(campaign_id, status);

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(admin_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created
  ON admin_activity_log(created_at);
