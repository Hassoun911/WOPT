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
  subscriber_id?: number | null;
  provider: "expo" | "web";
  platform: "android" | "ios" | "web";
  locale: Locale;
  address: string;
  web_p256dh: string | null;
  web_auth: string | null;
  notify_twenty: number;
  notify_ten: number;
  notify_athan: number;
  notify_announcements?: number;
  notify_community_events?: number;
  notify_marketing?: number;
}

export interface Env {
  DB: D1Database;
  SCHEDULE_URL: string;
  ALLOWED_WEB_ORIGIN: string;
  PUBLIC_APP_URL?: string;
  PUBLIC_API_URL?: string;
  GLOBAL_PRAYER_API_BASE?: string;
  EMAIL_LINK_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  SUPPORT_EMAIL?: string;
  ADMIN_BOOTSTRAP_KEY?: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  EXPO_ACCESS_TOKEN?: string;
  OPENAI_API_KEY?: string;
  SUNNAH_API_KEY?: string;
}
