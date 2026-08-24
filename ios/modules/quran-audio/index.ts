import { requireOptionalNativeModule } from "expo-modules-core";

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

export type QuranAudioNativeModule = {
  play(url: string, speed: number): Promise<void>;
  playQueue(itemsJson: string, startIndex: number, repeat: boolean, speed: number): void;
  playRange(startAbsolute: number, endAbsolute: number, reciterId: string, bitrate: number, reciterName: string, repeat: boolean, speed: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  next(): void;
  previous(): void;
  seekBy(deltaMs: number): void;
  setSpeed(speed: number): void;
  setRepeat(repeat: boolean): void;
  getStatus(): QuranAudioStatus;
};

export default requireOptionalNativeModule<QuranAudioNativeModule>("QuranAudio");
