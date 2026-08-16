import { requireOptionalNativeModule } from "expo-modules-core";

export type PrayerAudioScheduleResult = {
  scheduled: number;
  exact: boolean;
};

export type PrayerAudioTestResult = {
  exact: boolean;
};

export type PrayerAudioNativeModule = {
  canScheduleExactAlarms(): boolean;
  scheduleExactPrayerAlarms(eventsJson: string): Promise<PrayerAudioScheduleResult>;
  scheduleTestPrayerAlarm(prayer: string, delaySeconds: number): Promise<PrayerAudioTestResult>;
  cancelExactPrayerAlarms(): Promise<void>;
  openExactAlarmSettings(): void;
};

export default requireOptionalNativeModule<PrayerAudioNativeModule>("PrayerAudio");
