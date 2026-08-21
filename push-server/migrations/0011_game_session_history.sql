PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_session_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  room_code TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('trivia', 'imposter', 'clue')),
  category TEXT NOT NULL CHECK (category IN ('islamic', 'sports')),
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'tie')),
  player_score INTEGER NOT NULL DEFAULT 0,
  winning_score INTEGER NOT NULL DEFAULT 0,
  winner_names_json TEXT NOT NULL DEFAULT '[]',
  participants_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  finished_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_session_history_player
  ON game_session_history(player_id, finished_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_game_session_history_room
  ON game_session_history(room_code, finished_at DESC);
