PRAGMA foreign_keys = ON;

-- The Admin Content CMS was introduced after the email Islamic content library.
-- Bring the existing verified Hassoun content into the centralized CMS so the
-- owner does not start with an empty Content Manager.

INSERT OR IGNORE INTO app_content (
  public_id,
  content_type,
  title_en,
  title_ar,
  body_en,
  body_ar,
  source_text,
  metadata_json,
  status,
  featured,
  created_at,
  updated_at
)
SELECT
  'legacy-email-content-' || id,
  CASE content_type
    WHEN 'hadith' THEN 'hadith'
    WHEN 'surah' THEN 'ayah'
  END,
  title_en,
  title_ar,
  body_en,
  body_ar,
  source_ref,
  json_object('imported_from', 'email_content_library', 'legacy_id', id),
  CASE WHEN enabled = 1 THEN 'published' ELSE 'archived' END,
  CASE WHEN sort_order = (SELECT MIN(e2.sort_order) FROM email_content_library e2 WHERE e2.enabled = 1) THEN 1 ELSE 0 END,
  created_at,
  updated_at
FROM email_content_library
WHERE content_type IN ('hadith', 'surah');
