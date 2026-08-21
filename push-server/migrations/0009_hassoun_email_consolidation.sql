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
SET name = REPLACE(REPLACE(REPLACE(name, 'WOPT', 'Hassoun'), 'Xuber', 'Hassoun'), 'xuber.ca', 'hassoun.app'),
    subject_en = REPLACE(REPLACE(REPLACE(subject_en, 'WOPT', 'Hassoun'), 'Xuber', 'Hassoun'), 'xuber.ca', 'hassoun.app'),
    subject_ar = CASE WHEN subject_ar IS NULL THEN NULL ELSE REPLACE(REPLACE(REPLACE(subject_ar, 'WOPT', 'Hassoun'), 'Xuber', 'Hassoun'), 'xuber.ca', 'hassoun.app') END,
    html_en = REPLACE(REPLACE(REPLACE(html_en, 'WOPT', 'Hassoun'), 'Xuber', 'Hassoun'), 'xuber.ca', 'hassoun.app'),
    html_ar = CASE WHEN html_ar IS NULL THEN NULL ELSE REPLACE(REPLACE(REPLACE(html_ar, 'WOPT', 'Hassoun'), 'Xuber', 'Hassoun'), 'xuber.ca', 'hassoun.app') END,
    text_en = CASE WHEN text_en IS NULL THEN NULL ELSE REPLACE(REPLACE(REPLACE(text_en, 'WOPT', 'Hassoun'), 'Xuber', 'Hassoun'), 'xuber.ca', 'hassoun.app') END,
    text_ar = CASE WHEN text_ar IS NULL THEN NULL ELSE REPLACE(REPLACE(REPLACE(text_ar, 'WOPT', 'Hassoun'), 'Xuber', 'Hassoun'), 'xuber.ca', 'hassoun.app') END,
    updated_at = CURRENT_TIMESTAMP
WHERE name LIKE '%WOPT%'
   OR name LIKE '%Xuber%'
   OR name LIKE '%xuber.ca%'
   OR subject_en LIKE '%WOPT%'
   OR subject_en LIKE '%Xuber%'
   OR subject_en LIKE '%xuber.ca%'
   OR COALESCE(subject_ar, '') LIKE '%WOPT%'
   OR COALESCE(subject_ar, '') LIKE '%Xuber%'
   OR COALESCE(subject_ar, '') LIKE '%xuber.ca%'
   OR html_en LIKE '%WOPT%'
   OR html_en LIKE '%Xuber%'
   OR html_en LIKE '%xuber.ca%'
   OR COALESCE(html_ar, '') LIKE '%WOPT%'
   OR COALESCE(html_ar, '') LIKE '%Xuber%'
   OR COALESCE(html_ar, '') LIKE '%xuber.ca%'
   OR COALESCE(text_en, '') LIKE '%WOPT%'
   OR COALESCE(text_en, '') LIKE '%Xuber%'
   OR COALESCE(text_en, '') LIKE '%xuber.ca%'
   OR COALESCE(text_ar, '') LIKE '%WOPT%'
   OR COALESCE(text_ar, '') LIKE '%Xuber%'
   OR COALESCE(text_ar, '') LIKE '%xuber.ca%';
