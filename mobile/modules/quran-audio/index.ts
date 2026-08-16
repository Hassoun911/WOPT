import { requireOptionalNativeModule } from "expo-modules-core";

export type QuranAudioStatus = {
  available: boolean;
  state: "idle" | "loading" | "playing" | "paused" | "completed" | "error";
  positionMs: number;
  durationMs: number;
  speed: number;
  url?: string | null;
};

export type QuranAudioNativeModule = {
  play(url: string, speed: number): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  seekBy(deltaMs: number): void;
  setSpeed(speed: number): void;
  getStatus(): QuranAudioStatus;
};

export default requireOptionalNativeModule<QuranAudioNativeModule>("QuranAudio");
