"use client";

import { useCallback, useEffect, useState } from "react";

type GameRoom = {
  code: string;
  game_type: string;
  category: string;
  status: "lobby" | "playing" | "finished";
  player_count?: number;
  player_names?: string | null;
  created_at: string;
  updated_at: string;
};

type Player = { player_id: string; name: string; score: number; is_host: number; joined_at: string };

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function AdminGamesPanel({ token }: { token: string }) {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [selected, setSelected] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("Admin moderation");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const data = await request<{ rooms: GameRoom[] }>(`/admin/games/rooms${query}`, token);
      setRooms(data.rooms || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load game rooms");
    }
  }, [status, token]);

  useEffect(() => { void load(); }, [load]);

  const inspect = async (room: GameRoom) => {
    setBusy(true); setError("");
    try {
      const data = await request<{ room: GameRoom; players: Player[] }>(`/admin/games/room?code=${encodeURIComponent(room.code)}`, token);
      setSelected(data.room); setPlayers(data.players || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to inspect room"); }
    finally { setBusy(false); }
  };

  const close = async (room: GameRoom) => {
    setBusy(true); setError(""); setMessage("");
    try {
      await request("/admin/games/rooms/close", token, { method: "POST", body: JSON.stringify({ code: room.code, reason }) });
      setMessage(`Room ${room.code} closed.`); setSelected(null); setPlayers([]); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to close room"); }
    finally { setBusy(false); }
  };

  const remove = async (room: GameRoom) => {
    if (!window.confirm(`Permanently delete room ${room.code} and its players?`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request(`/admin/games/rooms?code=${encodeURIComponent(room.code)}`, token, { method: "DELETE" });
      setMessage(`Room ${room.code} deleted.`); setSelected(null); setPlayers([]); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete room"); }
    finally { setBusy(false); }
  };

  return <div style={styles.wrap}>
    {error ? <div style={styles.error}>{error}</div> : null}
    {message ? <div style={styles.success}>{message}</div> : null}
    <section style={styles.card}>
      <div style={styles.head}><div><h3 style={styles.title}>Multiplayer rooms</h3><p style={styles.muted}>Live visibility and moderation for Hassoun trivia, imposter and clue rooms.</p></div><div style={styles.filters}><select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.input}><option value="">All recent</option><option value="playing">Playing</option><option value="lobby">Lobby</option><option value="finished">Finished</option></select><button onClick={() => void load()} style={styles.secondary}>Refresh</button></div></div>
      <div style={styles.grid}>{rooms.map((room) => <button key={room.code} onClick={() => void inspect(room)} style={styles.room}><div style={styles.roomTop}><strong>{room.code}</strong><span style={{ ...styles.badge, background: room.status === "playing" ? "#e2f5ec" : room.status === "lobby" ? "#fff1cc" : "#edf1ef", color: room.status === "playing" ? "#0b654f" : room.status === "lobby" ? "#815c10" : "#52625d" }}>{room.status}</span></div><div style={styles.game}>{room.game_type} • {room.category}</div><div style={styles.small}>{room.player_count ?? 0} players{room.player_names ? ` • ${room.player_names}` : ""}</div><div style={styles.small}>Updated {new Date(room.updated_at).toLocaleString()}</div></button>)}</div>
    </section>

    {selected ? <section style={styles.card}>
      <div style={styles.head}><div><h3 style={styles.title}>Room {selected.code}</h3><p style={styles.muted}>{selected.game_type} • {selected.category} • {selected.status}</p></div><button onClick={() => { setSelected(null); setPlayers([]); }} style={styles.secondary}>Close details</button></div>
      <div style={styles.players}>{players.map((player) => <div key={player.player_id} style={styles.player}><div><strong>{player.name}</strong>{player.is_host ? <span style={styles.host}> HOST</span> : null}<div style={styles.small}>{player.player_id}</div></div><strong>{player.score}</strong></div>)}</div>
      <label style={styles.field}><span>Moderation reason</span><input value={reason} onChange={(e) => setReason(e.target.value)} style={styles.input} /></label>
      <div style={styles.actions}><button disabled={busy || selected.status === "finished"} onClick={() => void close(selected)} style={styles.warn}>End room</button><button disabled={busy} onClick={() => void remove(selected)} style={styles.danger}>Delete room</button></div>
    </section> : null}
  </div>;
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "grid", gap: 16 }, card: { background: "white", border: "1px solid #e0e5e0", borderRadius: 20, padding: 20 }, head: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }, title: { margin: 0, color: "#173f35" }, muted: { color: "#71807a", margin: "5px 0 0", lineHeight: 1.5 }, filters: { display: "flex", gap: 8 }, input: { border: "1px solid #d9dfdb", borderRadius: 10, padding: "8px 10px", background: "white", color: "#173f35" }, secondary: { border: "1px solid #d7dfda", borderRadius: 9, padding: "8px 10px", background: "white", color: "#173f35", fontWeight: 800, cursor: "pointer" }, grid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }, room: { border: "1px solid #e3e8e4", borderRadius: 15, padding: 14, background: "#fcfdfb", color: "#173f35", textAlign: "left", cursor: "pointer" }, roomTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }, badge: { borderRadius: 999, padding: "4px 8px", fontSize: 9, fontWeight: 900 }, game: { marginTop: 8, fontSize: 13, fontWeight: 800 }, small: { color: "#7a8782", fontSize: 11, marginTop: 4 }, players: { display: "grid", gap: 7, marginBottom: 14 }, player: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, border: "1px solid #e5e9e6", borderRadius: 11, padding: 10 }, host: { color: "#b27a23", fontSize: 9, fontWeight: 900 }, field: { display: "grid", gap: 6, fontSize: 11, fontWeight: 900, color: "#66756f", textTransform: "uppercase", letterSpacing: .7 }, actions: { display: "flex", gap: 8, marginTop: 12 }, warn: { border: "1px solid #ecd599", borderRadius: 9, padding: "9px 12px", background: "#fff8e2", color: "#7b5d11", fontWeight: 850, cursor: "pointer" }, danger: { border: "1px solid #efc2bd", borderRadius: 9, padding: "9px 12px", background: "#fff1ef", color: "#9a3028", fontWeight: 850, cursor: "pointer" }, error: { background: "#ffe5e2", color: "#8f2e27", border: "1px solid #f0c3bd", padding: 10, borderRadius: 11, fontWeight: 750 }, success: { background: "#e3f5ed", color: "#0b654f", border: "1px solid #c4e6d8", padding: 10, borderRadius: 11, fontWeight: 750 }
};
