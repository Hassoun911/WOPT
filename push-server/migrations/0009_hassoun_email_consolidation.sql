PRAGMA foreign_keys = ON;

-- Retire stale prayer-email jobs from any pre-Hassoun pipeline.
UPDATE email_outbox
SET status = 'cancelled',
    last_error = 'Legacy prayer-email pipeline retired',
    updated_at = CURRENT_TIMESTAMP
WHERE kind = 'prayer'
  AND status IN ('pending', 'sending')
  AND (idempotency_key IS NULL OR idempotency_key NOT LIKE 'email:%');

UPDATE email_deliveries
SET status = 'failed',
    error_code = 'legacy_pipeline_retired',
    error_message = 'Legacy prayer-email pipeline retired'
WHERE status = 'pending'
  AND notification_kind IN ('twenty', 'ten', 'athan')
  AND (event_id IS NULL OR event_id NOT LIKE 'email:%');

-- Keep legacy template records for history, but make every visible label Hassoun.
UPDATE email_templates
SET name = REPLACE(name, 'WOPT', 'Hassoun'),
    subject_en = REPLACE(subject_en, 'WOPT', 'Hassoun'),
    subject_ar = CASE WHEN subject_ar IS NULL THEN NULL ELSE REPLACE(subject_ar, 'WOPT', 'Hassoun') END,
    html_en = REPLACE(html_en, 'WOPT', 'Hassoun'),
    html_ar = CASE WHEN html_ar IS NULL THEN NULL ELSE REPLACE(html_ar, 'WOPT', 'Hassoun') END,
    text_en = CASE WHEN text_en IS NULL THEN NULL ELSE REPLACE(text_en, 'WOPT', 'Hassoun') END,
    text_ar = CASE WHEN text_ar IS NULL THEN NULL ELSE REPLACE(text_ar, 'WOPT', 'Hassoun') END,
    updated_at = CURRENT_TIMESTAMP
WHERE name LIKE '%WOPT%'
   OR subject_en LIKE '%WOPT%'
   OR COALESCE(subject_ar, '') LIKE '%WOPT%'
   OR html_en LIKE '%WOPT%'
   OR COALESCE(html_ar, '') LIKE '%WOPT%'
   OR COALESCE(text_en, '') LIKE '%WOPT%'
   OR COALESCE(text_ar, '') LIKE '%WOPT%';
