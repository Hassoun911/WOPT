import { requireOptionalNativeModule } from "expo-modules-core";

export type PrayerAudioScheduleResult = {
  scheduled: number;
  exact: boolean;
};

export type PrayerAudioTestResult = {
  exact: boolean;
};

export type NativeDeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  capturedAtMs: number;
};

export type PrayerAudioNativeModule = {
  canScheduleExactAlarms(): boolean;
  scheduleExactPrayerAlarms(eventsJson: string): Promise<PrayerAudioScheduleResult>;
  scheduleTestPrayerAlarm(prayer: string, delaySeconds: number): Promise<PrayerAudioTestResult>;
  getCurrentDeviceLocation(): Promise<NativeDeviceLocation | null>;
  cancelExactPrayerAlarms(): Promise<void>;
  openExactAlarmSettings(): void;
};

export default requireOptionalNativeModule<PrayerAudioNativeModule>("PrayerAudio");
