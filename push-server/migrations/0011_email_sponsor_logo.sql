PRAGMA foreign_keys = ON;

-- Production already contains sponsor_logo_data and sponsor_logo_mime from the
-- initial partially-applied rollout. Fresh databases receive both columns from
-- migration 0008, so this migration is intentionally a no-op that lets Wrangler
-- record the rollout as complete without attempting duplicate ALTER TABLE calls.
SELECT 1;
