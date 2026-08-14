export const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export type PrayerEventKind = "twenty" | "ten" | "athan";
export type Locale = "en" | "ar";

export type PrayerDay = Record<PrayerKey, string>;
export type PrayerTimes = Record<string, PrayerDay>;

export interface PrayerFile {
  prayer_times: PrayerTimes;
}

export interface DuePrayerEvent {
  id: string;
  dateKey: string;
  prayer: PrayerKey;
  prayerTime: string;
  kind: PrayerEventKind;
  targetAt: Date;
}

export interface SubscriptionRow {
  id: number;
  installation_id: string;
  provider: "expo" | "web";
  platform: "android" | "ios" | "web";
  locale: Locale;
  address: string;
  web_p256dh: string | null;
  web_auth: string | null;
}

export interface Env {
  DB: D1Database;
  SCHEDULE_URL: string;
  ALLOWED_WEB_ORIGIN: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  EXPO_ACCESS_TOKEN?: string;
}
