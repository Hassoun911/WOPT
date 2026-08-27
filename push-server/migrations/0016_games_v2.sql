PRAGMA foreign_keys=OFF;

CREATE TABLE game_rooms_v2 (
  code TEXT PRIMARY KEY,
  game_type TEXT NOT NULL CHECK (game_type IN ('trivia', 'imposter', 'clue', 'wordrace', 'wordpuzzle')),
  category TEXT NOT NULL CHECK (category IN ('islamic', 'sports', 'general')),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished')),
  host_player_id TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO game_rooms_v2 (code, game_type, category, status, host_player_id, state_json, created_at, updated_at)
SELECT code, game_type, category, status, host_player_id, state_json, created_at, updated_at FROM game_rooms;

CREATE TABLE game_players_v2 (
  room_code TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_host INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_code, player_id),
  FOREIGN KEY (room_code) REFERENCES game_rooms_v2(code) ON DELETE CASCADE
);

INSERT INTO game_players_v2 (room_code, player_id, name, score, is_host, joined_at, updated_at)
SELECT room_code, player_id, name, score, is_host, joined_at, updated_at FROM game_players;

DROP TABLE game_players;
DROP TABLE game_rooms;
ALTER TABLE game_rooms_v2 RENAME TO game_rooms;
ALTER TABLE game_players_v2 RENAME TO game_players;

CREATE INDEX idx_game_rooms_updated ON game_rooms(updated_at);
CREATE INDEX idx_game_players_room ON game_players(room_code, joined_at);

CREATE TABLE IF NOT EXISTS game_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL UNIQUE,
  game_type TEXT NOT NULL,
  category TEXT NOT NULL,
  winner_names TEXT NOT NULL DEFAULT '',
  scores_json TEXT NOT NULL DEFAULT '[]',
  rounds_played INTEGER NOT NULL DEFAULT 0,
  ended_reason TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_game_results_created ON game_results(created_at DESC);

CREATE TABLE IF NOT EXISTS game_settings (
  game_type TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  max_rounds INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO game_settings (game_type, enabled, max_rounds) VALUES
  ('trivia',1,5),('imposter',1,5),('clue',1,5),('wordrace',1,5),('wordpuzzle',1,5);

PRAGMA foreign_keys=ON;
