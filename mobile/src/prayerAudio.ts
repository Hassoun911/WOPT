import { AppState, Platform } from "react-native";
import PrayerAudio from "../modules/prayer-audio";
import { loadPhonePrayerAlertPreferences, type PrayerAlertPreferences } from "./alertPreferences";
import { buildPrayerEvents } from "./events";
import type { PrayerKey, PrayerTimes } from "./types";

let firstLaunchAlarmCheckStarted = false;
let exactAlarmSettingsOpenedThisSession = false;

async function restoreExactAlarmsIfAvailable() {
  if (Platform.OS !== "android" || !PrayerAudio) return;
  try {
    if (PrayerAudio.canScheduleExactAlarms()) {
      await PrayerAudio.restoreExactPrayerAlarms();
    }
  } catch {
    // The next schedule refresh or Test Adhan can retry without crashing startup.
  }
}

function startFirstLaunchExactAlarmSetup() {
  if (Platform.OS !== "android" || !PrayerAudio || firstLaunchAlarmCheckStarted) return;
  const prayerAudio = PrayerAudio;
  firstLaunchAlarmCheckStarted = true;

  setTimeout(() => {
    void (async () => {
      try {
        if (prayerAudio.canScheduleExactAlarms()) {
          await prayerAudio.restoreExactPrayerAlarms();
          return;
        }
        if (!exactAlarmSettingsOpenedThisSession) {
          exactAlarmSettingsOpenedThisSession = true;
          prayerAudio.openExactAlarmSettings();
        }
      } catch {
        // Alerts settings and Test Adhan remain the recovery path.
      }
    })();
  }, 1200);

  AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    void restoreExactAlarmsIfAvailable();
  });
}

startFirstLaunchExactAlarmSetup();

export type AndroidPrayerAudioResult = {
  count: number;
  exact: boolean;
  available: boolean;
};

export async function scheduleAndroidPrayerAudio(
  prayerTimes: PrayerTimes,
  suppliedPreferences?: PrayerAlertPreferences
): Promise<AndroidPrayerAudioResult> {
  if (Platform.OS !== "android" || !PrayerAudio) {
    return { count: 0, exact: false, available: false };
  }

  const preferences = suppliedPreferences ?? await loadPhonePrayerAlertPreferences();
  const events = buildPrayerEvents(prayerTimes, 30)
    .filter((event) => event.kind === "athan" && preferences[event.prayer]?.athan === true)
    .map((event) => ({
      id: event.id,
      prayer: event.prayer,
      scheduledAtMs: event.scheduledAt.getTime()
    }));
  const result = await PrayerAudio.scheduleExactPrayerAlarms(JSON.stringify(events));
  return { count: result.scheduled, exact: result.exact, available: true };
}

export async function scheduleAndroidTestAdhan(prayer: PrayerKey = "fajr", delaySeconds = 30) {
  if (Platform.OS !== "android" || !PrayerAudio) {
    return { exact: false, available: false };
  }
  const result = await PrayerAudio.scheduleTestPrayerAlarm(prayer, delaySeconds);
  return { exact: result.exact, available: true };
}

export async function cancelAndroidPrayerAudio() {
  if (Platform.OS === "android" && PrayerAudio) {
    await PrayerAudio.cancelExactPrayerAlarms();
  }
}

export function canScheduleAndroidExactAlarms() {
  return Platform.OS === "android" && PrayerAudio ? PrayerAudio.canScheduleExactAlarms() : false;
}

export function openExactAlarmSettings() {
  if (Platform.OS === "android" && PrayerAudio) {
    PrayerAudio.openExactAlarmSettings();
  }
}
