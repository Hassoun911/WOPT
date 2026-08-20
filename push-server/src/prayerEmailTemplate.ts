import type { Locale, PrayerKey } from "./types";

export type PrayerEmailRendered = { subject: string; html: string; text: string };
type PrayerTimes = Partial<Record<PrayerKey, string>>;
type UpcomingEvent = { emoji?: string; daysLeft?: number; nameEn?: string; nameAr?: string; descriptionEn?: string; descriptionAr?: string };

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" }, dhuhr: { en: "Dhuhr", ar: "الظهر" }, asr: { en: "Asr", ar: "العصر" }, maghrib: { en: "Maghrib", ar: "المغرب" }, isha: { en: "Isha", ar: "العشاء" }
};
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const ICONS: Record<PrayerKey, string> = { fajr: "🌅", dhuhr: "☀️", asr: "🌤️", maghrib: "🌇", isha: "🌙" };
const HASSOUN_LOGO = "https://hassoun911.github.io/WOPT/assets/hassoun-logo.png";
const PROPERTY_COUSINS_SITE = "https://thepropertycousins.net/";
const PROPERTY_COUSINS_LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAW