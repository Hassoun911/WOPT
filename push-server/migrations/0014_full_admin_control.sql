PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS school_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  class_id INTEGER,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','teachers','parents','students','class')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  scheduled_at TEXT,
  created_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS school_settings (
  setting_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  description TEXT,
  updated_by_admin_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO school_settings(setting_key,value_json,description) VALUES
 ('school_name','"Hassoun Qur’an School"','Public school name'),
 ('registration_open','true','Allow new school registrations'),
 ('academic_year','"2026-2027"','Current academic year'),
 ('default_class_capacity','20','Default class capacity'),
 ('parent_notifications','true','Send parent progress and attendance notices'),
 ('assignment_notifications','true','Send assignment notices'),
 ('attendance_notifications','true','Send absence and late notices');

CREATE TABLE IF NOT EXISTS school_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  student_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  kind TEXT NOT NULL DEFAULT 'tuition',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','waived','refunded','cancelled')),
  due_at TEXT,
  paid_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE
);

ALTER TABLE support_contacts ADD COLUMN assigned_admin_id INTEGER;
ALTER TABLE support_contacts ADD COLUMN internal_notes TEXT;
ALTER TABLE support_contacts ADD COLUMN resolved_at TEXT;

CREATE INDEX IF NOT EXISTS idx_school_announcements_status ON school_announcements(status,scheduled_at,created_at);
CREATE INDEX IF NOT EXISTS idx_school_payments_student ON school_payments(student_id,status,due_at);
