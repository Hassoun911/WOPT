import type { DuePrayerEvent, Locale, PrayerKey } from "./types";

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};

function formatTime(time: string, locale: Locale) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC"
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}

export function notificationMessage(event: DuePrayerEvent, locale: Locale) {
  const prayer = NAMES[event.prayer][locale];
  const body = `${formatTime(event.prayerTime, locale)} • Windsor, Ontario`;
  if (event.kind === "twenty") {
    return {
      title: locale === "ar" ? `بقي ٢٠ دقيقة على صلاة ${prayer}` : `${prayer} in 20 minutes`,
      body,
      sound: "attention_chime.wav",
      channelId: "prayer-reminders-v2"
    };
  }
  if (event.kind === "ten") {
    return {
      title: locale === "ar" ? `بقي ١٠ دقائق على صلاة ${prayer}` : `${prayer} in 10 minutes`,
      body,
      sound: "attention_chime.wav",
      channelId: "prayer-reminders-v2"
    };
  }
  return {
    title: locale === "ar" ? `حان الآن وقت صلاة ${prayer}` : `It is time for ${prayer}`,
    body,
    sound: null,
    channelId: "prayer-time-v2"
  };
}
