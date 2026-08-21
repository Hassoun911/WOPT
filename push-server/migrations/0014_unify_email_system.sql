PRAGMA foreign_keys = ON;

-- Make every existing email subscriber compatible with the final Hassoun email system
-- without changing their subscription status or creating duplicate email records.
INSERT OR IGNORE INTO subscriber_email_preferences (
  subscriber_id, prayer_alerts, daily_prayer_schedule, religious_occasions,
  daily_content, announcements, community_events, marketing
)
SELECT id, 1, 0, 1, 0, 1, 1, 0
FROM email_subscribers;

INSERT OR IGNORE INTO subscriber_prayer_preferences (
  subscriber_id, prayer, email_twenty, email_ten, email_athan
)
SELECT s.id, p.prayer, 0, 0, 1
FROM email_subscribers s
CROSS JOIN (
  SELECT 'fajr' AS prayer
  UNION ALL SELECT 'dhuhr'
  UNION ALL SELECT 'asr'
  UNION ALL SELECT 'maghrib'
  UNION ALL SELECT 'isha'
) p;

-- Remove legacy WOPT wording from stored templates. System/prayer emails use the
-- current built-in Hassoun renderer, but this keeps campaign/template data consistent too.
UPDATE email_templates SET
  name = REPLACE(name, 'WOPT', 'Hassoun'),
  subject_en = REPLACE(subject_en, 'WOPT', 'Hassoun'),
  subject_ar = CASE WHEN subject_ar IS NULL THEN NULL ELSE REPLACE(subject_ar, 'WOPT', 'Hassoun') END,
  html_en = REPLACE(REPLACE(html_en, 'WOPT', 'Hassoun'), 'xuber.ca', 'hassoun.app'),
  html_ar = CASE WHEN html_ar IS NULL THEN NULL ELSE REPLACE(REPLACE(html_ar, 'WOPT', 'Hassoun'), 'xuber.ca', 'hassoun.app') END,
  text_en = CASE WHEN text_en IS NULL THEN NULL ELSE REPLACE(REPLACE(text_en, 'WOPT', 'Hassoun'), 'xuber.ca', 'hassoun.app') END,
  text_ar = CASE WHEN text_ar IS NULL THEN NULL ELSE REPLACE(REPLACE(text_ar, 'WOPT', 'Hassoun'), 'xuber.ca', 'hassoun.app') END,
  updated_at = CURRENT_TIMESTAMP;

-- Old stuck outbox rows should not suddenly send after the new system is deployed.
UPDATE email_outbox
SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP,
    last_error = 'Cancelled during Hassoun email-system consolidation'
WHERE status = 'pending'
  AND created_at < datetime('now', '-30 minutes')
  AND kind IN ('prayer', 'verification', 'manage');
