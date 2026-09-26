import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";
import HassounPrayerWidget, { type HassounPrayerWidgetProps } from "../../src/HassounPrayerWidget";
import { addDateDays, windsorDateKey, windsorLocalToDate } from "../../src/time";

export type HassounWidgetLayout = "compact" | "next" | "full" | "square" | "vertical" | "slim";
export type HassounWidgetTheme = "emerald" | "ivory" | "ocean" | "sunset" | "midnight";
export type HassounWidgetAppearance = "light" | "dark" | "auto";
export type HassounWidgetTimeSize = "small" | "medium" | "large" | "xlarge";
export type HassounWidgetCountdownStyle = "circle" | "pill" | "minimal";
export type HassounWidgetFocus = "next" | "balanced" | "all";

export type HassounWidgetPreferences = {
  layout: HassounWidgetLayout;
  theme: HassounWidgetTheme;
  appearance: HassounWidgetAppearance;
  showCountdown: boolean;
  showHijri: boolean;
  showGregorian: boolean;
  showAllPrayers: boolean;
  showLocation: boolean;
  showLogo: boolean;
  showArabicNames: boolean;
  highlightNext: boolean;
  timeSize: HassounWidgetTimeSize;
  countdownStyle: HassounWidgetCountdownStyle;
  focus: HassounWidgetFocus;
  locale: "en" | "ar";
};

export type HassounWidgetCapabilities = {
  available: boolean;
  pinningSupported: boolean;
  lockScreenEligible: boolean;
  sdkInt: number;
};

type NativeWidget = {
  setPreferences: (preferences: HassounWidgetPreferences) => void;
  getPreferences: () => HassounWidgetPreferences;
  syncPrayerSchedule: (scheduleJson: string, locale: "en" | "ar") => void;
  refresh: () => void;
  requestPin: () => boolean;
  getCapabilities: () => HassounWidgetCapabilities;
};

type ScheduleDay = { fajr: string; dhuhr: string; asr: string; maghrib: string; isha: string };
type Schedule = Record<string, ScheduleDay>;
type WidgetContext = { timeZone?: string; locationLabel?: string };
type PrayerKey = keyof ScheduleDay;

let native: NativeWidget | null = null;
if (Platform.OS === "android") {
  try { native = requireNativeModule<NativeWidget>("HassounWidget"); } catch { native = null; }
}

const defaults: HassounWidgetPreferences = {
  layout: "full",
  theme: "emerald",
  appearance: "auto",
  showCountdown: true,
  showHijri: true,
  showGregorian: true,
  showAllPrayers: true,
  showLocation: false,
  showLogo: true,
  showArabicNames: true,
  highlightNext: true,
  timeSize: "large",
  countdownStyle: "circle",
  focus: "next",
  locale: "en"
};

let iosPreferences: HassounWidgetPreferences = { ...defaults };
let lastIosTimeline: Array<{ date: Date; props: HassounPrayerWidgetProps }> = [];

const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function prayerName(prayer: PrayerKey, locale: "en" | "ar") {
  if (locale === "ar") return ({ fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" } as const)[prayer];
  return ({ fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" } as const)[prayer];
}

function displayClock(raw: string, locale: "en" | "ar") {
  const [hRaw, mRaw] = String(raw || "").split(":");
  const h = Number(hRaw), m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return raw || "—";
  const suffix = h >= 12 ? (locale === "ar" ? "م" : "PM") : (locale === "ar" ? "ص" : "AM");
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function countdown(target: Date, now: Date, locale: "en" | "ar") {
  const minutes = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60000));
  const hours = Math.floor(minutes / 60), mins = minutes % 60;
  if (locale === "ar") return hours ? `بعد ${hours} س ${mins} د` : `بعد ${mins} د`;
  return hours ? `in ${hours}h ${mins}m` : `in ${mins}m`;
}

function propsFor(schedule: Schedule, dateKey: string, prayer: PrayerKey, target: Date, now: Date, locale: "en" | "ar", location: string): HassounPrayerWidgetProps {
  const day = schedule[dateKey] || ({ fajr: "—", dhuhr: "—", asr: "—", maghrib: "—", isha: "—" } as ScheduleDay);
  return {
    locale,
    location,
    nextPrayer: prayerName(prayer, locale),
    nextTime: displayClock(day[prayer], locale),
    countdown: countdown(target, now, locale),
    fajr: displayClock(day.fajr, locale),
    dhuhr: displayClock(day.dhuhr, locale),
    asr: displayClock(day.asr, locale),
    maghrib: displayClock(day.maghrib, locale),
    isha: displayClock(day.isha, locale)
  };
}

function syncIosWidget(scheduleJson: string, locale: "en" | "ar", context: WidgetContext = {}) {
  if (Platform.OS !== "ios") return;
  try {
    const schedule = JSON.parse(scheduleJson) as Schedule;
    const now = new Date();
    const timeZone = context.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const location = context.locationLabel || (locale === "ar" ? "موقع GPS" : "GPS location");
    const todayKey = windsorDateKey(now, timeZone);
    const upcoming: Array<{ target: Date; dateKey: string; prayer: PrayerKey }> = [];
    for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
      const dateKey = addDateDays(todayKey, dayOffset);
      const day = schedule[dateKey];
      if (!day) continue;
      for (const prayer of PRAYERS) {
        const target = windsorLocalToDate(dateKey, day[prayer], timeZone);
        if (target.getTime() > now.getTime()) upcoming.push({ target, dateKey, prayer });
      }
    }
    if (!upcoming.length) return;
    const entries: Array<{ date: Date; props: HassounPrayerWidgetProps }> = [];
    entries.push({ date: now, props: propsFor(schedule, upcoming[0].dateKey, upcoming[0].prayer, upcoming[0].target, now, locale, location) });
    for (let i = 0; i < Math.min(upcoming.length - 1, 8); i += 1) {
      const next = upcoming[i + 1];
      const entryDate = new Date(upcoming[i].target.getTime() + 1000);
      entries.push({ date: entryDate, props: propsFor(schedule, next.dateKey, next.prayer, next.target, entryDate, locale, location) });
    }
    lastIosTimeline = entries;
    HassounPrayerWidget.updateTimeline(entries);
  } catch {}
}

const HassounWidget = {
  available: Platform.OS === "ios" || Boolean(native),
  setPreferences(preferences: HassounWidgetPreferences) {
    if (Platform.OS === "ios") iosPreferences = { ...preferences };
    native?.setPreferences(preferences);
  },
  getPreferences(): HassounWidgetPreferences {
    if (Platform.OS === "ios") return { ...iosPreferences };
    return { ...defaults, ...(native?.getPreferences() ?? {}) };
  },
  syncPrayerSchedule(scheduleJson: string, locale: "en" | "ar", context?: WidgetContext) {
    if (Platform.OS === "ios") syncIosWidget(scheduleJson, locale, context);
    native?.syncPrayerSchedule(scheduleJson, locale);
  },
  refresh() {
    if (Platform.OS === "ios") {
      if (lastIosTimeline.length) HassounPrayerWidget.updateTimeline(lastIosTimeline);
      HassounPrayerWidget.reload();
    }
    native?.refresh();
  },
  requestPin() { return native?.requestPin() ?? false; },
  getCapabilities(): HassounWidgetCapabilities {
    if (Platform.OS === "ios") return { available: true, pinningSupported: false, lockScreenEligible: true, sdkInt: 0 };
    return native?.getCapabilities() ?? { available: false, pinningSupported: false, lockScreenEligible: false, sdkInt: 0 };
  }
};

export default HassounWidget;
