CREATE TABLE IF NOT EXISTS support_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  platform TEXT,
  app_version TEXT,
  source TEXT NOT NULL DEFAULT 'contact_form',
  status TEXT NOT NULL DEFAULT 'new',
  email_recipient TEXT NOT NULL DEFAULT 'windsor.hassoun@gmail.com',
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_provider_id TEXT,
  email_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_contacts_created_at
  ON support_contacts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_contacts_status
  ON support_contacts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_contacts_email
  ON support_contacts(email COLLATE NOCASE);
