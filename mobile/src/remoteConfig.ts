import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const CACHE_KEY = "hassoun:remote-control:v1";

export type FeatureFlags = {
  prayerTimes: boolean;
  adhan: boolean;
  quran: boolean;
  quranRadio: boolean;
  memorize: boolean;
  quiz: boolean;
  multiplayerGames: boolean;
  islamicEvents: boolean;
  widgets: boolean;
  emailAlerts: boolean;
  support: boolean;
};

export type AppUiConfig = {
  maintenanceMode: boolean;
  maintenanceMessageEn: string;
  maintenanceMessageAr: string;
  homeAnnouncementEnabled: boolean;
  homeAnnouncementEn: string;
  homeAnnouncementAr: string;
};

export type PrayerRemoteConfig = {
  mode: "windsor_official" | "global";
  locationLabel: string;
  sourceLabel: string;
  timezone: string;
  allowLocationDetection: boolean;
};

export type QuranRemoteConfig = {
  readerEnabled: boolean;
  audioEnabled: boolean;
  radioEnabled: boolean;
  memorizeEnabled: boolean;
  defaultReciterId: string;
  defaultBitrate: number;
};

export type StoreReleaseConfig = {
  marketingVersion: string;
  androidMinimumVersion: string;
  iosMinimumVersion: string;
  forceUpdate: boolean;
  androidStoreUrl: string;
  iosStoreUrl: string;
};

export type RemoteContent = {
  publicId: string;
  key: string;
  type: string;
  locale: "en" | "ar" | "both";
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  deepLink?: string | null;
  payload?: unknown;
  startsAt?: string | null;
  endsAt?: string | null;
  sortOrder?: number;
};

export type RemoteControlConfig = {
  features: FeatureFlags;
  appUi: AppUiConfig;
  prayer: PrayerRemoteConfig;
  quran: QuranRemoteConfig;
  store: StoreReleaseConfig;
  content: RemoteContent[];
  generatedAt?: string;
  live: boolean;
};

export const DEFAULT_REMOTE_CONTROL: RemoteControlConfig = {
  features: {
    prayerTimes: true,
    adhan: true,
    quran: true,
    quranRadio: true,
    memorize: true,
    quiz: true,
    multiplayerGames: true,
    islamicEvents: true,
    widgets: true,
    emailAlerts: true,
    support: true
  },
  appUi: {
    maintenanceMode: false,
    maintenanceMessageEn: "Hassoun is temporarily under maintenance.",
    maintenanceMessageAr: "تطبيق Hassoun تحت الصيانة مؤقتاً.",
    homeAnnouncementEnabled: false,
    homeAnnouncementEn: "",
    homeAnnouncementAr: ""
  },
  prayer: {
    mode: "windsor_official",
    locationLabel: "Windsor, Ontario",
    sourceLabel: "Windsor Islamic Association",
    timezone: "America/Toronto",
    allowLocationDetection: false
  },
  quran: {
    readerEnabled: true,
    audioEnabled: true,
    radioEnabled: true,
    memorizeEnabled: true,
    defaultReciterId: "ar.alafasy",
    defaultBitrate: 128
  },
  store: {
    marketingVersion: "1.0.0",
    androidMinimumVersion: "1.0.0",
    iosMinimumVersion: "1.0.0",
    forceUpdate: false,
    androidStoreUrl: "",
    iosStoreUrl: ""
  },
  content: [],
  live: false
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalize(payload: unknown, live: boolean): RemoteControlConfig {
  const root = object(payload);
  const control = object(root.control);
  const settings = object(control.settings);
  const flags = object(settings.feature_flags);
  const ui = object(settings.app_ui);
  const prayer = object(settings.prayer_config);
  const quran = object(settings.quran_config);
  const store = object(settings.store_release);
  const defaults = DEFAULT_REMOTE_CONTROL;

  return {
    features: {
      prayerTimes: bool(flags.prayerTimes, defaults.features.prayerTimes),
      adhan: bool(flags.adhan, defaults.features.adhan),
      quran: bool(flags.quran, defaults.features.quran),
      quranRadio: bool(flags.quranRadio, defaults.features.quranRadio),
      memorize: bool(flags.memorize, defaults.features.memorize),
      quiz: bool(flags.quiz, defaults.features.quiz),
      multiplayerGames: bool(flags.multiplayerGames, defaults.features.multiplayerGames),
      islamicEvents: bool(flags.islamicEvents, defaults.features.islamicEvents),
      widgets: bool(flags.widgets, defaults.features.widgets),
      emailAlerts: bool(flags.emailAlerts, defaults.features.emailAlerts),
      support: bool(flags.support, defaults.features.support)
    },
    appUi: {
      maintenanceMode: bool(ui.maintenanceMode, defaults.appUi.maintenanceMode),
      maintenanceMessageEn: text(ui.maintenanceMessageEn, defaults.appUi.maintenanceMessageEn),
      maintenanceMessageAr: text(ui.maintenanceMessageAr, defaults.appUi.maintenanceMessageAr),
      homeAnnouncementEnabled: bool(ui.homeAnnouncementEnabled, defaults.appUi.homeAnnouncementEnabled),
      homeAnnouncementEn: text(ui.homeAnnouncementEn, defaults.appUi.homeAnnouncementEn),
      homeAnnouncementAr: text(ui.homeAnnouncementAr, defaults.appUi.homeAnnouncementAr)
    },
    prayer: {
      mode: prayer.mode === "global" ? "global" : "windsor_official",
      locationLabel: text(prayer.locationLabel, defaults.prayer.locationLabel),
      sourceLabel: text(prayer.sourceLabel, defaults.prayer.sourceLabel),
      timezone: text(prayer.timezone, defaults.prayer.timezone),
      allowLocationDetection: bool(prayer.allowLocationDetection, defaults.prayer.allowLocationDetection)
    },
    quran: {
      readerEnabled: bool(quran.readerEnabled, defaults.quran.readerEnabled),
      audioEnabled: bool(quran.audioEnabled, defaults.quran.audioEnabled),
      radioEnabled: bool(quran.radioEnabled, defaults.quran.radioEnabled),
      memorizeEnabled: bool(quran.memorizeEnabled, defaults.quran.memorizeEnabled),
      defaultReciterId: text(quran.defaultReciterId, defaults.quran.defaultReciterId),
      defaultBitrate: numberValue(quran.defaultBitrate, defaults.quran.defaultBitrate)
    },
    store: {
      marketingVersion: text(store.marketingVersion, defaults.store.marketingVersion),
      androidMinimumVersion: text(store.androidMinimumVersion, defaults.store.androidMinimumVersion),
      iosMinimumVersion: text(store.iosMinimumVersion, defaults.store.iosMinimumVersion),
      forceUpdate: bool(store.forceUpdate, defaults.store.forceUpdate),
      androidStoreUrl: text(store.androidStoreUrl, defaults.store.androidStoreUrl),
      iosStoreUrl: text(store.iosStoreUrl, defaults.store.iosStoreUrl)
    },
    content: Array.isArray(control.content) ? control.content as RemoteContent[] : [],
    generatedAt: typeof control.generatedAt === "string" ? control.generatedAt : undefined,
    live
  };
}

function apiBase() {
  return String(Constants.expoConfig?.extra?.pushApiUrl || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
}

export async function loadRemoteControlConfig(): Promise<RemoteControlConfig> {
  let fallback = DEFAULT_REMOTE_CONTROL;
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  if (cached) {
    try { fallback = { ...normalize(JSON.parse(cached), false), live: false }; } catch {}
  }

  try {
    const response = await fetch(`${apiBase()}/config`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Remote config request failed: ${response.status}`);
    const payload = await response.json() as unknown;
    const next = normalize(payload, true);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    return next;
  } catch {
    return fallback;
  }
}
