from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT / "mobile/src/SettingsHub.tsx"
GAMES = ROOT / "mobile/src/QuizGamesHub.tsx"
MULTI = ROOT / "mobile/src/MultiplayerGames.tsx"

# ---------------------------------------------------------------------------
# SettingsHub: persist the exact nested Settings page across Activity/process
# recreation so background return never collapses back to Settings root/Home.
# ---------------------------------------------------------------------------
h = HUB.read_text(encoding="utf-8")
if 'import AsyncStorage from "@react-native-async-storage/async-storage";' not in h:
    h = 'import AsyncStorage from "@react-native-async-storage/async-storage";\n' + h
anchor = '  const [page, setPage] = useState<SettingsPage>("root");\n'
if anchor not in h:
    raise SystemExit('SettingsHub page state anchor missing')
if 'settingsPageRestoredV3' not in h:
    h = h.replace(anchor, anchor + '  const [settingsPageRestoredV3, setSettingsPageRestoredV3] = useState(false);\n', 1)
    insert = '  const [readerOpen, setReaderOpen] = useState(false);\n'
    effect = '''  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem("hassoun:last-settings-page:v3")
      .then((saved) => {
        if (!alive || !saved) return;
        setPage(saved as SettingsPage);
      })
      .finally(() => { if (alive) setSettingsPageRestoredV3(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!settingsPageRestoredV3) return;
    void AsyncStorage.setItem("hassoun:last-settings-page:v3", page).catch(() => undefined);
  }, [page, settingsPageRestoredV3]);

'''
    if insert not in h:
        raise SystemExit('SettingsHub reader state anchor missing')
    h = h.replace(insert, insert + effect, 1)
HUB.write_text(h, encoding="utf-8")

# ---------------------------------------------------------------------------
# Games hub: persist nested mode + selected game. This is what was resetting to
# Games/Home after Android recreated the React tree.
# ---------------------------------------------------------------------------
g = GAMES.read_text(encoding="utf-8")
if 'import AsyncStorage from "@react-native-async-storage/async-storage";' not in g:
    g = 'import AsyncStorage from "@react-native-async-storage/async-storage";\n' + g
if 'import { useEffect, useState } from "react";' not in g:
    g = g.replace('import { useState } from "react";', 'import { useEffect, useState } from "react";', 1)
mode_anchor = '  const [selectedGame, setSelectedGame] = useState<MultiplayerGameType | undefined>();\n'
if mode_anchor not in g:
    raise SystemExit('QuizGamesHub selectedGame anchor missing')
if 'gamesNavRestoredV3' not in g:
    state = '''  const [gamesNavRestoredV3, setGamesNavRestoredV3] = useState(false);

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem("hassoun:games-nav:v3")
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const saved = JSON.parse(raw) as { mode?: ViewMode; selectedGame?: MultiplayerGameType };
          if (saved.mode === "daily" || saved.mode === "multiplayer" || saved.mode === "hub") setMode(saved.mode);
          if (saved.selectedGame === "trivia" || saved.selectedGame === "imposter" || saved.selectedGame === "clue") setSelectedGame(saved.selectedGame);
        } catch {}
      })
      .finally(() => { if (alive) setGamesNavRestoredV3(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!gamesNavRestoredV3) return;
    void AsyncStorage.setItem("hassoun:games-nav:v3", JSON.stringify({ mode, selectedGame })).catch(() => undefined);
  }, [gamesNavRestoredV3, mode, selectedGame]);
'''
    g = g.replace(mode_anchor, mode_anchor + state, 1)
GAMES.write_text(g, encoding="utf-8")

# ---------------------------------------------------------------------------
# Multiplayer: persist selected game/category/setup and active room code, then
# reconnect to that room after a true process recreation.
# ---------------------------------------------------------------------------
m = MULTI.read_text(encoding="utf-8")
if 'const GAME_SESSION_KEY = "hassoun:multiplayer-session:v3";' not in m:
    m = m.replace(
        'const PLAYER_NAME_KEY = "wopt:games:player-name:v1";\n',
        'const PLAYER_NAME_KEY = "wopt:games:player-name:v1";\nconst GAME_SESSION_KEY = "hassoun:multiplayer-session:v3";\n',
        1,
    )
state_anchor = '  const [now, setNow] = useState(Date.now());\n'
if state_anchor not in m:
    raise SystemExit('Multiplayer now-state anchor missing')
if 'sessionRestoredV3' not in m:
    state = '''  const [sessionRestoredV3, setSessionRestoredV3] = useState(false);
  const [restoreRoomCodeV3, setRestoreRoomCodeV3] = useState("");
'''
    m = m.replace(state_anchor, state_anchor + state, 1)

    first_effect = '  useEffect(() => {\n    void (async () => {\n      let id = await AsyncStorage.getItem(PLAYER_ID_KEY);'
    if first_effect not in m:
        raise SystemExit('Multiplayer identity effect anchor missing')
    # Restore session before/alongside identity. Room reconnect waits for playerId.
    restore_effect = '''  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(GAME_SESSION_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const saved = JSON.parse(raw) as { game?: MultiplayerGameType | null; category?: Category; joinCode?: string; roomCode?: string };
          if (saved.game === "trivia" || saved.game === "imposter" || saved.game === "clue") setGame(saved.game);
          if (saved.category === "islamic" || saved.category === "sports") setCategory(saved.category);
          if (typeof saved.joinCode === "string") setJoinCode(saved.joinCode.slice(0, 6));
          if (typeof saved.roomCode === "string") setRestoreRoomCodeV3(saved.roomCode.slice(0, 6));
        } catch {}
      })
      .finally(() => { if (alive) setSessionRestoredV3(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!sessionRestoredV3) return;
    void AsyncStorage.setItem(GAME_SESSION_KEY, JSON.stringify({
      game,
      category,
      joinCode,
      roomCode: room?.code || restoreRoomCodeV3 || ""
    })).catch(() => undefined);
  }, [category, game, joinCode, restoreRoomCodeV3, room?.code, sessionRestoredV3]);

  useEffect(() => {
    if (!sessionRestoredV3 || !restoreRoomCodeV3 || !playerId || room) return;
    void api(`/games/rooms/${restoreRoomCodeV3}?playerId=${encodeURIComponent(playerId)}`)
      .then((restored) => {
        setRoom(restored);
        setGame(restored.gameType);
        setCategory(restored.category);
      })
      .catch(() => setRestoreRoomCodeV3(""));
  }, [playerId, restoreRoomCodeV3, room, sessionRestoredV3]);

'''
    m = m.replace(first_effect, restore_effect + first_effect, 1)

    m = m.replace(
        '  const leaveRoom = () => { setRoom(null); setJoinCode(""); };',
        '  const leaveRoom = () => { setRoom(null); setJoinCode(""); setRestoreRoomCodeV3(""); void AsyncStorage.removeItem(GAME_SESSION_KEY).catch(() => undefined); };',
        1,
    )
MULTI.write_text(m, encoding="utf-8")

for path, needles in {
    HUB: ['hassoun:last-settings-page:v3', 'settingsPageRestoredV3'],
    GAMES: ['hassoun:games-nav:v3', 'gamesNavRestoredV3'],
    MULTI: ['hassoun:multiplayer-session:v3', 'restoreRoomCodeV3', 'sessionRestoredV3'],
}.items():
    text = path.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Missing resume-state marker {needle!r} in {path}')

print('Persisted nested Settings, Games, and active multiplayer room across Android recreation')
