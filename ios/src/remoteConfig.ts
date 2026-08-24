import Constants from "expo-constants";
import { Platform } from "react-native";

export type FeaturedRuntimeContent = {
  publicId: string;
  type: string;
  titleEn: string;
  titleAr?: string | null;
  bodyEn?: string | null;
  bodyAr?: string | null;
  source?: string | null;
};

export type HassounRuntimeConfig = {
  maintenanceMode: boolean;
  minimumVersion: string;
  forceUpdate: boolean;
  quranEnabled: boolean;
  gamesEnabled: boolean;
  emailEnabled: boolean;
  communityContentEnabled: boolean;
  prayerTimesEnabled: boolean;
  alertsEnabled: boolean;
  islamicEventsEnabled: boolean;
  sadaqahSectionEnabled: boolean;
  donationEnabled: boolean;
  askSheikhEnabled: boolean;
  askSheikhShareEnabled: boolean;
  askSheikhMaxResults: number;
  askSheikhDisclaimerEn: string;
  askSheikhDisclaimerAr: string;
  systemBanner: { enabled: boolean; title: string; message: string };
  featuredContent: FeaturedRuntimeContent[];
};

export const DEFAULT_RUNTIME_CONFIG: HassounRuntimeConfig = {
  maintenanceMode: false,
  minimumVersion: "0.0.0",
  forceUpdate: false,
  quranEnabled: true,
  gamesEnabled: true,
  emailEnabled: true,
  communityContentEnabled: true,
  prayerTimesEnabled: true,
  alertsEnabled: true,
  islamicEventsEnabled: true,
  sadaqahSectionEnabled: true,
  donationEnabled: false,
  askSheikhEnabled: true,
  askSheikhShareEnabled: true,
  askSheikhMaxResults: 8,
  askSheikhDisclaimerEn: "Hassoun finds relevant Qur’an verses and verified Hadith content. For personal religious rulings, consult a qualified local scholar.",
  askSheikhDisclaimerAr: "يعرض Hassoun آيات قرآنية ومحتوى حديث موثق ذا صلة. للأحكام والفتاوى الشخصية راجع عالماً مؤهلاً تثق به.",
  systemBanner: { enabled: false, title: "", message: "" },
  featuredContent: []
};

export function hassounApiUrl() {
  const configured = Constants.expoConfig?.extra?.pushApiUrl;
  return typeof configured === "string" && configured.startsWith("https://")
    ? configured.replace(/\/$/, "")
    : "https://wopt-prayer-push.wopt-windsor.workers.dev";
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
}

export async function loadHassounRuntimeConfig(): Promise<HassounRuntimeConfig> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${hassounApiUrl()}/app/runtime`, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return DEFAULT_RUNTIME_CONFIG;
    const payload = await response.json() as {
      settings?: Record<string, unknown>;
      featuredContent?: FeaturedRuntimeContent[];
    };
    const settings = payload.settings ?? {};
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const minimumKey = platform === "ios" ? "minimum_ios_version" : "minimum_android_version";
    const forceKey = platform === "ios" ? "force_update_ios" : "force_update_android";
    const rawBanner = settings.system_banner;
    const banner = rawBanner && typeof rawBanner === "object" ? rawBanner as Record<string, unknown> : {};
    return {
      maintenanceMode: asBool(settings.maintenance_mode, false),
      minimumVersion: asString(settings[minimumKey], "0.0.0"),
      forceUpdate: asBool(settings[forceKey], false),
      quranEnabled: asBool(settings.quran_enabled, true),
      gamesEnabled: asBool(settings.games_enabled, true),
      emailEnabled: asBool(settings.email_enabled, true),
      communityContentEnabled: asBool(settings.community_content_enabled, true),
      prayerTimesEnabled: asBool(settings.prayer_times_enabled, true),
      alertsEnabled: asBool(settings.alerts_enabled, true),
      islamicEventsEnabled: asBool(settings.islamic_events_enabled, true),
      sadaqahSectionEnabled: asBool(settings.sadaqah_section_enabled, true),
      donationEnabled: asBool(settings.donation_enabled, false),
      askSheikhEnabled: asBool(settings.ask_sheikh_enabled, true),
      askSheikhShareEnabled: asBool(settings.ask_sheikh_share_enabled, true),
      askSheikhMaxResults: asNumber(settings.ask_sheikh_max_results, 8, 3, 20),
      askSheikhDisclaimerEn: asString(settings.ask_sheikh_disclaimer_en, DEFAULT_RUNTIME_CONFIG.askSheikhDisclaimerEn),
      askSheikhDisclaimerAr: asString(settings.ask_sheikh_disclaimer_ar, DEFAULT_RUNTIME_CONFIG.askSheikhDisclaimerAr),
      systemBanner: {
        enabled: asBool(banner.enabled, false),
        title: asString(banner.title, ""),
        message: asString(banner.message, "")
      },
      featuredContent: Array.isArray(payload.featuredContent) ? payload.featuredContent.slice(0, 20) : []
    };
  } catch {
    return DEFAULT_RUNTIME_CONFIG;
  } finally {
    clearTimeout(timer);
  }
}

export function versionIsBelow(current: string, minimum: string) {
  const left = current.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = minimum.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const size = Math.max(left.length, right.length, 3);
  for (let index = 0; index < size; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}
