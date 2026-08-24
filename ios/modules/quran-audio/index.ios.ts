import { createAudioPlaylist, setAudioModeAsync, type AudioPlaylist } from "expo-audio";

export type QuranAudioStatus = {
  available: boolean;
  state: "idle" | "loading" | "playing" | "paused" | "completed" | "error";
  positionMs: number;
  durationMs: number;
  speed: number;
  url?: string | null;
  title?: string | null;
  subtitle?: string | null;
  queueIndex?: number;
  queueSize?: number;
  repeat?: boolean;
  mode?: "queue" | "range";
};

type QueueItem = { url: string; title?: string; subtitle?: string };

let playlist: AudioPlaylist | null = null;
let queue: QueueItem[] = [];
let repeatQueue = false;
let requestedSpeed = 1;
let lastState: QuranAudioStatus["state"] = "idle";
let lastError = "";

const configureAudio = async () => {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix"
  });
};

const destroyPlaylist = () => {
  try { playlist?.pause(); } catch {}
  try { playlist?.destroy(); } catch {}
  playlist = null;
};

const normalizedSpeed = (value: number) => Math.min(2, Math.max(0.5, Number.isFinite(value) ? value : 1));

const startQueue = async (items: QueueItem[], startIndex: number, repeat: boolean, speed: number) => {
  destroyPlaylist();
  queue = items.filter((item) => typeof item.url === "string" && item.url.startsWith("https://"));
  repeatQueue = repeat;
  requestedSpeed = normalizedSpeed(speed);
  lastError = "";

  if (!queue.length) {
    lastState = "error";
    lastError = "No valid Quran audio URLs";
    return;
  }

  try {
    await configureAudio();
    playlist = createAudioPlaylist({
      sources: queue.map((item) => item.url),
      loop: repeat ? (queue.length === 1 ? "single" : "all") : "none",
      updateInterval: 250
    });
    const safeIndex = Math.min(Math.max(startIndex, 0), queue.length - 1);
    if (safeIndex > 0) playlist.skipTo(safeIndex);
    playlist.playbackRate = requestedSpeed;
    playlist.volume = 1;
    playlist.play();
    lastState = "playing";
  } catch (error) {
    lastState = "error";
    lastError = error instanceof Error ? error.message : String(error);
  }
};

const play = async (url: string, speed: number) => {
  await startQueue([{ url, title: "Qur’an", subtitle: "Hassoun" }], 0, false, speed);
};

const playQueue = (itemsJson: string, startIndex: number, repeat: boolean, speed: number) => {
  try {
    const parsed = JSON.parse(itemsJson) as QueueItem[];
    void startQueue(Array.isArray(parsed) ? parsed : [], startIndex, repeat, speed);
  } catch (error) {
    lastState = "error";
    lastError = error instanceof Error ? error.message : String(error);
  }
};

const playRange = (
  startAbsolute: number,
  endAbsolute: number,
  reciterId: string,
  bitrate: number,
  reciterName: string,
  repeat: boolean,
  speed: number
) => {
  const start = Math.max(1, Math.floor(startAbsolute));
  const end = Math.max(start, Math.floor(endAbsolute));
  const safeBitrate = Math.max(32, Math.floor(bitrate));
  const items: QueueItem[] = [];
  for (let absolute = start; absolute <= end; absolute += 1) {
    items.push({
      url: `https://cdn.islamic.network/quran/audio/${safeBitrate}/${reciterId}/${absolute}.mp3`,
      title: `Qur’an • Ayah ${absolute}`,
      subtitle: `${reciterName || "Hassoun"} • Hassoun`
    });
  }
  void startQueue(items, 0, repeat, speed);
};

const pause = () => {
  try { playlist?.pause(); lastState = "paused"; } catch (error) {
    lastState = "error";
    lastError = error instanceof Error ? error.message : String(error);
  }
};

const resume = () => {
  try {
    if (playlist) {
      playlist.playbackRate = requestedSpeed;
      playlist.play();
      lastState = "playing";
    }
  } catch (error) {
    lastState = "error";
    lastError = error instanceof Error ? error.message : String(error);
  }
};

const stop = () => {
  destroyPlaylist();
  queue = [];
  repeatQueue = false;
  lastState = "idle";
  lastError = "";
};

const next = () => {
  try { playlist?.next(); } catch {}
};

const previous = () => {
  try { playlist?.previous(); } catch {}
};

const seekBy = (deltaMs: number) => {
  if (!playlist) return;
  const target = Math.max(0, playlist.currentTime + deltaMs / 1000);
  void playlist.seekTo(target);
};

const setSpeed = (speed: number) => {
  requestedSpeed = normalizedSpeed(speed);
  if (playlist) playlist.playbackRate = requestedSpeed;
};

const setRepeat = (repeat: boolean) => {
  repeatQueue = repeat;
  if (playlist) playlist.loop = repeat ? (queue.length === 1 ? "single" : "all") : "none";
};

const getStatus = (): QuranAudioStatus => {
  const currentIndex = playlist?.currentIndex ?? 0;
  const item = queue[currentIndex];
  let state = lastState;
  if (playlist) {
    if (playlist.playing) state = "playing";
    else if (playlist.isBuffering) state = "loading";
    else if (lastState === "playing") state = "paused";
  }
  return {
    available: true,
    state,
    positionMs: Math.round((playlist?.currentTime ?? 0) * 1000),
    durationMs: Math.round((playlist?.duration ?? 0) * 1000),
    speed: playlist?.playbackRate ?? requestedSpeed,
    url: item?.url ?? null,
    title: item?.title ?? null,
    subtitle: item?.subtitle ?? (lastError || null),
    queueIndex: currentIndex,
    queueSize: queue.length,
    repeat: repeatQueue,
    mode: "queue"
  };
};

const QuranAudioIOS = {
  play,
  playQueue,
  playRange,
  pause,
  resume,
  stop,
  next,
  previous,
  seekBy,
  setSpeed,
  setRepeat,
  getStatus
};

export default QuranAudioIOS;
