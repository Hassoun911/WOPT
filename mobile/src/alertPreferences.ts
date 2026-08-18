import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./config";
import { PRAYER_KEYS, type PrayerKey } from "./types";

export type PrayerAlertTiming = {
  twenty: boolean;
  ten: boolean;
  athan: boolean;
};

export type PrayerAlertPreferences = Record<PrayerKey, PrayerAlertTiming>;

const ALL_ON: PrayerAlertTiming = { twenty: true, ten: true, athan: true };
const ATHAN_ONLY: PrayerAlertTiming = { twenty: false, ten: false, athan: true };

function copyTiming(value: PrayerAlertTiming): PrayerAlertTiming {
  return { twenty: value.twenty, ten: value.ten, athan: value.athan };
}

export function makePrayerAlertPreferences(defaultTiming: PrayerAlertTiming = ALL_ON): PrayerAlertPreferences {
  return Object.fromEntries(PRAYER_KEYS.map((prayer) => [prayer, copyTiming(defaultTiming)])) as PrayerAlertPreferences;
}

export const DEFAULT_PHONE_PRAYER_ALERTS = makePrayerAlertPreferences(ALL_ON);
export const DEFAULT_EMAIL_PRAYER_ALERTS = makePrayerAlertPreferences(ATHAN_ONLY);

export function normalizePrayerAlertPreferences(
  raw: unknown,
  fallback: PrayerAlertPreferences = DEFAULT_PHONE_PRAYER_ALERTS
): PrayerAlertPreferences {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return Object.fromEntries(PRAYER_KEYS.map((prayer) => {
    const current = source[prayer] && typeof source[prayer] === "object"
      ? source[prayer] as Record<string, unknown>
      : {};
    const base = fallback[prayer];
    return [prayer, {
      twenty: typeof current.twenty === "boolean" ? current.twenty : base.twenty,
      ten: typeof current.ten === "boolean" ? current.ten : base.ten,
      athan: typeof current.athan === "boolean" ? current.athan : base.athan
    }];
  })) as PrayerAlertPreferences;
}

export function anyPrayerAlertEnabled(value: PrayerAlertPreferences) {
  return PRAYER_KEYS.some((prayer) => {
    const prefs = value[prayer];
    return prefs.twenty || prefs.ten || prefs.athan;
  });
}

export function prayerEnabled(value: PrayerAlertPreferences, prayer: PrayerKey) {
  const prefs = value[prayer];
  return prefs.twenty || prefs.ten || prefs.athan;
}

export function setPrayerEnabled(value: PrayerAlertPreferences, prayer: PrayerKey, enabled: boolean): PrayerAlertPreferences {
  return {
    ...value,
    [prayer]: enabled ? copyTiming(ALL_ON) : { twenty: false, ten: false, athan: false }
  };
}

export function setPrayerTiming(
  value: PrayerAlertPreferences,
  prayer: PrayerKey,
  timing: keyof PrayerAlertTiming,
  enabled: boolean
): PrayerAlertPreferences {
  return {
    ...value,
    [prayer]: { ...value[prayer], [timing]: enabled }
  };
}

export function applyPrayerAlertPreset(
  preset: "all" | "twenty" | "ten" | "athan" | "none"
): PrayerAlertPreferences {
  const timing: PrayerAlertTiming = preset === "all"
    ? { twenty: true, ten: true, athan: true }
    : preset === "twenty"
      ? { twenty: true, ten: false, athan: false }
      : preset === "ten"
        ? { twenty: false, ten: true, athan: false }
        : preset === "athan"
          ? { twenty: false, ten: false, athan: true }
          : { twenty: false, ten: false, athan: false };
  return makePrayerAlertPreferences(timing);
}

export function summarizePrayerAlertPreferences(value: PrayerAlertPreferences, locale: "en" | "ar") {
  const enabledPrayers = PRAYER_KEYS.filter((prayer) => prayerEnabled(value, prayer)).length;
  const twenty = PRAYER_KEYS.filter((prayer) => value[prayer].twenty).length;
  const ten = PRAYER_KEYS.filter((prayer) => value[prayer].ten).length;
  const athan = PRAYER_KEYS.filter((prayer) => value[prayer].athan).length;
  if (!enabledPrayers) return locale === "ar" ? "جميع تنبيهات الصلاة متوقفة" : "All prayer alerts are off";
  if (locale === "ar") return `${enabledPrayers}/٥ صلوات • ٢٠د: ${twenty} • ١٠د: ${ten} • الأذان: ${athan}`;
  return `${enabledPrayers}/5 prayers • 20m: ${twenty} • 10m: ${ten} • Adhan: ${athan}`;
}

export async function loadPhonePrayerAlertPreferences() {
  const [saved, legacyMuted] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.phonePrayerAlerts),
    AsyncStorage.getItem(STORAGE_KEYS.prayerAudioMuted)
  ]);
  if (saved) {
    try { return normalizePrayerAlertPreferences(JSON.parse(saved)); } catch {}
  }

  // Migrate the old Home-card Adhan mute list into the richer preference model.
  const migrated = makePrayerAlertPreferences(ALL_ON);
  if (legacyMuted) {
    try {
      const parsed = JSON.parse(legacyMuted) as unknown;
      if (Array.isArray(parsed)) {
        for (const prayer of PRAYER_KEYS) {
          if (parsed.includes(prayer)) migrated[prayer].athan = false;
        }
      }
    } catch {}
  }
  await savePhonePrayerAlertPreferences(migrated);
  return migrated;
}

export async function savePhonePrayerAlertPreferences(value: PrayerAlertPreferences) {
  const normalized = normalizePrayerAlertPreferences(value);
  await AsyncStorage.setItem(STORAGE_KEYS.phonePrayerAlerts, JSON.stringify(normalized));
  const muted = PRAYER_KEYS.filter((prayer) => !normalized[prayer].athan);
  await AsyncStorage.setItem(STORAGE_KEYS.prayerAudioMuted, JSON.stringify(muted));
  return normalized;
}
