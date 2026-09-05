import AsyncStorage from "@react-native-async-storage/async-storage";

export type CalculationMode = "smart" | "manual";

export type PrayerCalculationPreferences = {
  mode: CalculationMode;
  method: number;
  school: 0 | 1;
  highLatitude: 0 | 1 | 2 | 3;
  offsets: {
    fajr: number;
    dhuhr: number;
    asr: number;
    maghrib: number;
    isha: number;
  };
};

export const CALCULATION_PREFS_KEY = "hassoun:prayer-calculation:v2";

export const DEFAULT_CALCULATION_PREFS: PrayerCalculationPreferences = {
  mode: "smart",
  method: 2,
  school: 0,
  highLatitude: 3,
  offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
};

export const METHOD_OPTIONS = [
  { id: 2, name: "ISNA", note: "North America" },
  { id: 3, name: "Muslim World League", note: "International" },
  { id: 4, name: "Umm al-Qura, Makkah", note: "Saudi Arabia" },
  { id: 5, name: "Egyptian Authority", note: "Egypt / nearby regions" },
  { id: 1, name: "University of Karachi", note: "South Asia" },
  { id: 7, name: "Tehran", note: "Institute of Geophysics" },
  { id: 0, name: "Jafari", note: "Ithna-Ashari" }
] as const;

const listeners = new Set<() => void>();

export async function loadPrayerCalculationPreferences(): Promise<PrayerCalculationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(CALCULATION_PREFS_KEY);
    if (!raw) return DEFAULT_CALCULATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<PrayerCalculationPreferences>;
    return {
      ...DEFAULT_CALCULATION_PREFS,
      ...parsed,
      mode: parsed.mode === "manual" ? "manual" : "smart",
      school: parsed.school === 1 ? 1 : 0,
      highLatitude: parsed.highLatitude === 0 || parsed.highLatitude === 1 || parsed.highLatitude === 2 ? parsed.highLatitude : 3,
      offsets: { ...DEFAULT_CALCULATION_PREFS.offsets, ...(parsed.offsets || {}) }
    };
  } catch {
    return DEFAULT_CALCULATION_PREFS;
  }
}

export async function savePrayerCalculationPreferences(value: PrayerCalculationPreferences) {
  await AsyncStorage.setItem(CALCULATION_PREFS_KEY, JSON.stringify(value));
  for (const listener of listeners) {
    try { listener(); } catch {}
  }
}

export function subscribePrayerCalculationChanges(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function smartMethodForLocation(latitude: number, longitude: number) {
  if (latitude >= 16 && latitude <= 33 && longitude >= 34 && longitude <= 56) return 4;
  if (latitude >= 20 && latitude <= 33 && longitude >= 24 && longitude <= 37) return 5;
  if (latitude >= 5 && latitude <= 38 && longitude >= 60 && longitude <= 93) return 1;
  if (latitude >= 15 && latitude <= 72 && longitude >= -170 && longitude <= -50) return 2;
  return 3;
}

export function tuneString(offsets: PrayerCalculationPreferences["offsets"]) {
  return [offsets.fajr, 0, offsets.dhuhr, offsets.asr, 0, offsets.maghrib, offsets.isha, 0, 0].join(",");
}
