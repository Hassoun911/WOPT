CREATE TABLE IF NOT EXISTS game_rooms (
  code TEXT PRIMARY KEY,
  game_type TEXT NOT NULL CHECK (game_type IN ('trivia', 'imposter', 'clue')),
  category TEXT NOT NULL CHECK (category IN ('islamic', 'sports')),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished')),
  host_player_id TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_players (
  room_code TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_host INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_code, player_id),
  FOREIGN KEY (room_code) REFERENCES game_rooms(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_updated ON game_rooms(updated_at);
CREATE INDEX IF NOT EXISTS idx_game_players_room ON game_players(room_code, joined_at);
