PRAGMA foreign_keys = ON;

-- Coarse, anonymous location coverage for Hassoun usage analytics.
-- No device IDs, emails, IP addresses, or exact coordinates are stored here.
CREATE TABLE IF NOT EXISTS app_location_usage (
  location_key TEXT PRIMARY KEY,
  latitude_bucket REAL NOT NULL,
  longitude_bucket REAL NOT NULL,
  timezone TEXT NOT NULL,
  place_label TEXT,
  city TEXT,
  region TEXT,
  country_name TEXT,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hit_count INTEGER NOT NULL DEFAULT 1,
  mobile_hits INTEGER NOT NULL DEFAULT 0,
  web_hits INTEGER NOT NULL DEFAULT 0,
  alexa_hits INTEGER NOT NULL DEFAULT 0,
  legacy_hits INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_app_location_usage_last_seen
  ON app_location_usage(last_seen DESC);

-- Preserve location coverage that was already known before this analytics table
-- existed. These rows come only from existing prayer/subscriber location data.
INSERT OR IGNORE INTO app_location_usage (
  location_key, latitude_bucket, longitude_bucket, timezone,
  place_label, city, region, country_name,
  first_seen, last_seen, hit_count, legacy_hits
)
SELECT
  'geo:' || printf('%.1f', ROUND(latitude, 1)) || ',' || printf('%.1f', ROUND(longitude, 1)) || '|' || COALESCE(timezone, 'UTC'),
  ROUND(latitude, 1), ROUND(longitude, 1), COALESCE(timezone, 'UTC'),
  TRIM(COALESCE(city, '') || CASE WHEN region IS NOT NULL AND region <> '' THEN ', ' || region ELSE '' END || CASE WHEN country_name IS NOT NULL AND country_name <> '' THEN ', ' || country_name ELSE '' END),
  city, region, country_name,
  MIN(created_at), MAX(updated_at), COUNT(*), COUNT(*)
FROM email_subscribers
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
GROUP BY ROUND(latitude, 1), ROUND(longitude, 1), COALESCE(timezone, 'UTC');

INSERT OR IGNORE INTO app_location_usage (
  location_key, latitude_bucket, longitude_bucket, timezone,
  place_label, city, region, country_name,
  first_seen, last_seen, hit_count, legacy_hits
)
SELECT
  'geo:' || printf('%.1f', ROUND(latitude, 1)) || ',' || printf('%.1f', ROUND(longitude, 1)) || '|' || COALESCE(timezone, 'UTC'),
  ROUND(latitude, 1), ROUND(longitude, 1), COALESCE(timezone, 'UTC'),
  TRIM(COALESCE(MAX(city), '') || CASE WHEN MAX(region) IS NOT NULL AND MAX(region) <> '' THEN ', ' || MAX(region) ELSE '' END || CASE WHEN MAX(country_name) IS NOT NULL AND MAX(country_name) <> '' THEN ', ' || MAX(country_name) ELSE '' END),
  MAX(city), MAX(region), MAX(country_name),
  MIN(fetched_at), MAX(fetched_at), COUNT(*), COUNT(*)
FROM location_prayer_cache
GROUP BY ROUND(latitude, 1), ROUND(longitude, 1), COALESCE(timezone, 'UTC');
