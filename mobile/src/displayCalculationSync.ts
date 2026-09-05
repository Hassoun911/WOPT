import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PrayerCalculationPreferences } from "./prayerCalculationSettings";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const DISPLAY_STORAGE_KEY = "hassoun:paired-displays:v2";

type PairedDisplay = { id: string; token: string; name?: string };
type RemoteDisplay = { name?: string; settings?: Record<string, unknown> };

export async function syncCalculationToPairedDisplays(preferences: PrayerCalculationPreferences) {
  const raw = await AsyncStorage.getItem(DISPLAY_STORAGE_KEY);
  if (!raw) return;

  let displays: PairedDisplay[] = [];
  try { displays = JSON.parse(raw) as PairedDisplay[]; } catch { return; }
  if (!Array.isArray(displays) || !displays.length) return;

  const patch = {
    prayerScheduleSource: preferences.scheduleSource,
    calculationMode: preferences.mode,
    calculationMethod: preferences.method,
    calculationSchool: preferences.school,
    calculationHighLatitude: preferences.highLatitude,
    calculationOffsets: preferences.offsets
  };

  await Promise.all(displays.map(async (display) => {
    if (!display?.id || !display?.token) return;
    try {
      const url = `${API}/masjid-displays/control/${encodeURIComponent(display.id)}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${display.token}` }
      });
      if (!response.ok) return;
      const remote = await response.json() as RemoteDisplay;
      const settings = { ...(remote.settings || {}), ...patch };
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${display.token}`
        },
        body: JSON.stringify({ name: remote.name || display.name || "Masjid Display", settings })
      });
    } catch {
      // A display may be offline. Local prayer settings still save immediately.
    }
  }));
}
