PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS email_template_profiles (
  template_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  include_islamic_occasion INTEGER NOT NULL DEFAULT 1 CHECK (include_islamic_occasion IN (0, 1)),
  include_daily_hadith INTEGER NOT NULL DEFAULT 1 CHECK (include_daily_hadith IN (0, 1)),
  include_daily_surah INTEGER NOT NULL DEFAULT 1 CHECK (include_daily_surah IN (0, 1)),
  include_occasion_countdown INTEGER NOT NULL DEFAULT 1 CHECK (include_occasion_countdown IN (0, 1)),
  include_motivation INTEGER NOT NULL DEFAULT 1 CHECK (include_motivation IN (0, 1)),
  include_sadaqah_jariyah INTEGER NOT NULL DEFAULT 1 CHECK (include_sadaqah_jariyah IN (0, 1)),
  include_sponsor INTEGER NOT NULL DEFAULT 1 CHECK (include_sponsor IN (0, 1)),
  sponsor_name TEXT,
  sponsor_url TEXT,
  sponsor_message_en TEXT,
  sponsor_message_ar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_template_profiles (
  template_key, name, category,
  include_islamic_occasion, include_daily_hadith, include_daily_surah,
  include_occasion_countdown, include_motivation, include_sadaqah_jariyah, include_sponsor
) VALUES
  ('prayer_alert', 'Prayer alert', 'prayer', 1, 1, 1, 1, 1, 1, 1),
  ('verification', 'Email verification', 'system', 0, 0, 0, 0, 1, 1, 1),
  ('manage', 'Manage alerts', 'system', 0, 0, 0, 0, 1, 1, 1),
  ('admin_password_reset', 'Admin password reset', 'system', 0, 0, 0, 0, 0, 1, 0),
  ('religious_occasion', 'Islamic occasion', 'religious_occasion', 1, 1, 1, 1, 1, 1, 1),
  ('daily_content', 'Daily Islamic content', 'daily_content', 0, 1, 1, 1, 1, 1, 1),
  ('announcement', 'Announcement', 'announcement', 1, 0, 0, 1, 1, 1, 1),
  ('community_event', 'Community event', 'community_event', 1, 0, 0, 1, 1, 1, 1),
  ('marketing', 'Marketing', 'marketing', 0, 0, 0, 0, 1, 1, 1);

CREATE TABLE IF NOT EXISTS email_content_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type TEXT NOT NULL CHECK (content_type IN ('hadith', 'surah', 'motivation')),
  title_en TEXT NOT NULL,
  title_ar TEXT,
  body_en TEXT NOT NULL,
  body_ar TEXT,
  source_ref TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO email_content_library (id, content_type, title_en, title_ar, body_en, body_ar, source_ref, enabled, sort_order) VALUES
  (1, 'hadith', 'Daily Hadith', 'حديث اليوم', 'The Prophet ﷺ taught that deeds are judged by intentions. Renew your intention and make today meaningful.', 'علّمنا النبي ﷺ أن الأعمال بالنيات. جدّد نيتك واجعل يومك مليئاً بالخير.', 'Sahih al-Bukhari 1', 1, 10),
  (2, 'surah', 'Daily Qur’an', 'آية اليوم', 'Allah reminds us that ease accompanies hardship. Keep moving forward with patience and trust.', 'يذكّرنا الله أن مع العسر يسراً. استمر بالصبر والثقة بالله.', 'Qur’an 94:5–6', 1, 20),
  (3, 'motivation', 'Today’s Reminder', 'تذكير اليوم', 'Protect your prayers, remember Allah often, and use today to do one good deed that continues beyond you.', 'حافظ على صلاتك وأكثر من ذكر الله واجعل لك اليوم عملاً صالحاً يستمر أثره بعدك.', NULL, 1, 30);

CREATE INDEX IF NOT EXISTS idx_email_content_library_type_enabled
  ON email_content_library(content_type, enabled, sort_order);
