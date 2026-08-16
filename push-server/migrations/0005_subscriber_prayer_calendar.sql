PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS subscriber_prayer_days (
  subscriber_id INTEGER NOT NULL,
  date_key TEXT NOT NULL,
  timezone TEXT NOT NULL,
  fajr TEXT NOT NULL,
  dhuhr TEXT NOT NULL,
  asr TEXT NOT NULL,
  maghrib TEXT NOT NULL,
  isha TEXT NOT NULL,
  calculation_method INTEGER NOT NULL DEFAULT 3,
  source TEXT NOT NULL DEFAULT 'aladhan',
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(subscriber_id, date_key),
  FOREIGN KEY(subscriber_id) REFERENCES email_subscribers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriber_prayer_days_date
  ON subscriber_prayer_days(date_key, subscriber_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_deliveries_prayer_once
  ON email_deliveries(event_id, subscriber_id)
  WHERE event_id IS NOT NULL AND subscriber_id IS NOT NULL;
