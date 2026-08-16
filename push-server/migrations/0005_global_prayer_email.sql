PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS location_prayer_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_key TEXT NOT NULL,
  prayer_date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT,
  region TEXT,
  city TEXT NOT NULL,
  timezone TEXT NOT NULL,
  calculation_method INTEGER,
  madhab TEXT NOT NULL DEFAULT 'standard' CHECK (madhab IN ('standard', 'hanafi')),
  fajr TEXT NOT NULL,
  dhuhr TEXT NOT NULL,
  asr TEXT NOT NULL,
  maghrib TEXT NOT NULL,
  isha TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'aladhan',
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(location_key, prayer_date)
);

CREATE INDEX IF NOT EXISTS idx_location_prayer_cache_date
  ON location_prayer_cache(prayer_date, location_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_deliveries_event_subscriber
  ON email_deliveries(event_id, subscriber_id)
  WHERE event_id IS NOT NULL AND subscriber_id IS NOT NULL;

ALTER TABLE email_deliveries
  ADD COLUMN notification_kind TEXT CHECK (notification_kind IN ('twenty', 'ten', 'athan', 'daily_schedule', 'campaign', 'verification', 'manage', 'password_reset'));

ALTER TABLE email_deliveries
  ADD COLUMN prayer TEXT CHECK (prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha'));

ALTER TABLE email_deliveries
  ADD COLUMN scheduled_for TEXT;

ALTER TABLE email_deliveries
  ADD COLUMN subject_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_email_deliveries_scheduled_status
  ON email_deliveries(status, scheduled_for);
