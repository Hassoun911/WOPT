CREATE TABLE IF NOT EXISTS mosques (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  region TEXT,
  country_code TEXT,
  country_name TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  phone TEXT,
  website_url TEXT,
  maps_url TEXT,
  google_place_id TEXT UNIQUE,
  osm_type TEXT,
  osm_id TEXT,
  discovery_source TEXT NOT NULL DEFAULT 'manual',
  verification_status TEXT NOT NULL DEFAULT 'discovered' CHECK (verification_status IN ('discovered','pending','verified','rejected')),
  active INTEGER NOT NULL DEFAULT 1,
  timetable_url TEXT,
  timetable_source_type TEXT NOT NULL DEFAULT 'unknown' CHECK (timetable_source_type IN ('unknown','adhan','iqamah','both')),
  calculation_method INTEGER,
  madhab TEXT NOT NULL DEFAULT 'standard' CHECK (madhab IN ('standard','hanafi')),
  last_verified_at TEXT,
  last_discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mosques_osm_unique ON mosques(osm_type, osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mosques_location ON mosques(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_mosques_status ON mosques(active, verification_status);
CREATE INDEX IF NOT EXISTS idx_mosques_city ON mosques(city, country_code);

CREATE TABLE IF NOT EXISTS mosque_prayer_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mosque_id INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  prayer_date TEXT NOT NULL,
  fajr TEXT,
  dhuhr TEXT,
  asr TEXT,
  maghrib TEXT,
  isha TEXT,
  fajr_iqamah TEXT,
  dhuhr_iqamah TEXT,
  asr_iqamah TEXT,
  maghrib_iqamah TEXT,
  isha_iqamah TEXT,
  source_url TEXT,
  source_label TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mosque_id, prayer_date)
);

CREATE INDEX IF NOT EXISTS idx_mosque_prayer_times_date ON mosque_prayer_times(mosque_id, prayer_date);

CREATE TABLE IF NOT EXISTS mosque_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  latitude REAL,
  longitude REAL,
  website_url TEXT,
  timetable_url TEXT,
  submitted_by_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);
