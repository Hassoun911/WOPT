export const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

export type Locale = "en" | "ar";
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export type PrayerDay = Record<PrayerKey, string>;
export type PrayerTimes = Record<string, PrayerDay>;

export interface PrayerFile {
  metadata?: {
    year?: number;
    source_page?: string;
    [key: string]: unknown;
  };
  prayer_times: PrayerTimes;
}

export type PrayerEventKind = "twenty" | "ten" | "athan";

export interface PrayerEvent {
  id: string;
  dateKey: string;
  prayer: PrayerKey;
  prayerTime: string;
  kind: PrayerEventKind;
  scheduledAt: Date;
}
