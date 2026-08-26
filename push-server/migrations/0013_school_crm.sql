PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS school_teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS school_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  teacher_id INTEGER,
  invite_code TEXT NOT NULL UNIQUE,
  capacity INTEGER,
  schedule_text TEXT,
  delivery_mode TEXT NOT NULL DEFAULT 'online' CHECK (delivery_mode IN ('online','in_person','hybrid')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(teacher_id) REFERENCES school_teachers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS school_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  class_id INTEGER,
  parent_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived','suspended')),
  current_surah INTEGER,
  current_ayah INTEGER,
  streak INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL DEFAULT 0,
  admin_notes TEXT,
  last_active_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(class_id) REFERENCES school_classes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS school_parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS school_parent_students (
  parent_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  relationship TEXT DEFAULT 'parent',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(parent_id, student_id),
  FOREIGN KEY(parent_id) REFERENCES school_parents(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS school_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  class_id INTEGER NOT NULL,
  student_id INTEGER,
  title TEXT NOT NULL,
  quran_reference TEXT NOT NULL,
  instructions TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','closed','archived')),
  created_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS school_assignment_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','submitted','reviewed','resubmit')),
  practice_count INTEGER NOT NULL DEFAULT 0,
  ai_score INTEGER,
  teacher_score INTEGER,
  fluency_score INTEGER,
  tajweed_score INTEGER,
  teacher_feedback TEXT,
  last_practiced_at TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assignment_id, student_id),
  FOREIGN KEY(assignment_id) REFERENCES school_assignments(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS school_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  note TEXT,
  recorded_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, student_id, attendance_date),
  FOREIGN KEY(class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE,
  FOREIGN KEY(recorded_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS school_memorization_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  surah INTEGER NOT NULL,
  ayah_start INTEGER NOT NULL,
  ayah_end INTEGER NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'memorization' CHECK (activity_type IN ('memorization','revision','practice','assessment')),
  ai_score INTEGER,
  teacher_score INTEGER,
  fluency_score INTEGER,
  tajweed_score INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(student_id) REFERENCES school_students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_school_students_class ON school_students(class_id, status);
CREATE INDEX IF NOT EXISTS idx_school_assignments_class ON school_assignments(class_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_school_progress_student ON school_assignment_progress(student_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_school_attendance_student ON school_attendance(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_school_memorization_student ON school_memorization_log(student_id, created_at);
