PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO email_templates (
  template_key, name, category, subject_en, subject_ar, html_en, html_ar, text_en, text_ar
) VALUES
(
  'subscriber_verification',
  'Subscriber email verification',
  'system',
  'Confirm your WOPT prayer email alerts',
  'تأكيد تنبيهات مواقيت الصلاة عبر البريد',
  '<p>Confirm your prayer-time email alerts:</p><p><a href="{{verificationUrl}}">Confirm email alerts</a></p>',
  '<p dir="rtl">أكد تنبيهات مواقيت الصلاة عبر البريد:</p><p dir="rtl"><a href="{{verificationUrl}}">تأكيد البريد الإلكتروني</a></p>',
  'Confirm your prayer-time email alerts: {{verificationUrl}}',
  'أكد تنبيهات مواقيت الصلاة عبر البريد: {{verificationUrl}}'
),
(
  'subscriber_manage',
  'Subscriber manage link',
  'system',
  'Manage your WOPT email alerts',
  'إدارة تنبيهات WOPT عبر البريد',
  '<p>Use this secure link to manage your WOPT email alerts:</p><p><a href="{{manageUrl}}">Manage email alerts</a></p>',
  '<p dir="rtl">استخدم هذا الرابط الآمن لإدارة تنبيهات WOPT عبر البريد:</p><p dir="rtl"><a href="{{manageUrl}}">إدارة التنبيهات</a></p>',
  'Manage your WOPT email alerts: {{manageUrl}}',
  'إدارة تنبيهات WOPT عبر البريد: {{manageUrl}}'
),
(
  'prayer_alert',
  'Prayer time email alert',
  'prayer',
  '{{emailSubject}}',
  '{{emailSubject}}',
  '{{emailHtml}}',
  '{{emailHtml}}',
  '{{emailText}}',
  '{{emailText}}'
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER,
  subscriber_id INTEGER,
  recipient_email TEXT NOT NULL COLLATE NOCASE,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  kind TEXT NOT NULL CHECK (
    kind IN ('verification', 'prayer', 'daily_schedule', 'religious_occasion', 'daily_content', 'announcement', 'community_event', 'marketing', 'manage', 'admin_password_reset')
  ),
  template_key TEXT,
  template_data_json TEXT,
  idempotency_key TEXT UNIQUE,
  scheduled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(delivery_id) REFERENCES email_deliveries(id) ON DELETE SET NULL,
  FOREIGN KEY(subscriber_id) REFERENCES email_subscribers(id) ON DELETE CASCADE,
  FOREIGN KEY(template_key) REFERENCES email_templates(template_key) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_due
  ON email_outbox(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_email_outbox_subscriber
  ON email_outbox(subscriber_id, status);
