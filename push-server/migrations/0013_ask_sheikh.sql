CREATE TABLE IF NOT EXISTS ask_sheikh_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  question_text TEXT NOT NULL,
  normalized_question TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK(locale IN ('en','ar')),
  category TEXT NOT NULL DEFAULT 'general',
  quran_refs_json TEXT,
  asked_count INTEGER NOT NULL DEFAULT 1,
  last_asked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ask_sheikh_normalized ON ask_sheikh_questions(normalized_question, locale);
CREATE INDEX IF NOT EXISTS idx_ask_sheikh_popular ON ask_sheikh_questions(asked_count DESC, last_asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ask_sheikh_category ON ask_sheikh_questions(category, asked_count DESC);

INSERT OR IGNORE INTO app_settings(setting_key,value_json,description)
VALUES
 ('ask_sheikh_enabled','true','Show the Ask the Sheikh smart Qur’an and verified Hadith search experience.'),
 ('ask_sheikh_share_enabled','true','Allow users to share Ask the Sheikh answer cards.'),
 ('ask_sheikh_max_results','8','Maximum Qur’an results displayed for one Ask the Sheikh search.'),
 ('ask_sheikh_disclaimer_en','"Hassoun finds relevant Qur’an verses and verified Hadith content. For personal religious rulings, consult a qualified local scholar."','English Ask the Sheikh guidance.'),
 ('ask_sheikh_disclaimer_ar','"يعرض Hassoun آيات قرآنية ومحتوى حديث موثق ذا صلة. للأحكام والفتاوى الشخصية راجع عالماً مؤهلاً تثق به."','Arabic Ask the Sheikh guidance.'),
 ('prayer_times_enabled','true','Master switch for prayer-time experience.'),
 ('alerts_enabled','true','Master switch for prayer and event alert features.'),
 ('islamic_events_enabled','true','Show Islamic events and countdowns.'),
 ('sadaqah_section_enabled','true','Show Sadaqah Jariyah sections in the app.'),
 ('donation_enabled','false','Enable donation calls to action when configured.');