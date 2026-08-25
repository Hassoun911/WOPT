PRAGMA foreign_keys = ON;

ALTER TABLE email_template_profiles ADD COLUMN sponsor_logo_data TEXT;
ALTER TABLE email_template_profiles ADD COLUMN sponsor_logo_mime TEXT;
