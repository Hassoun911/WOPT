import { requireNativeModule } from "expo-modules-core";

export type QuranSpeechStatus = {
  available: boolean;
  state: "idle" | "listening" | "processing" | "done" | "error";
  transcript: string;
  partialTranscript: string;
  error?: string | null;
};

type QuranSpeechNative = {
  start(locale: string): Promise<void>;
  stop(): void;
  cancel(): void;
  getStatus(): QuranSpeechStatus;
};

let module: QuranSpeechNative | null = null;
try {
  module = requireNativeModule<QuranSpeechNative>("QuranSpeech");
} catch {
  module = null;
}

export default module;
