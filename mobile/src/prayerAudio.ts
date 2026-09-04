import { AppState, Platform } from "react-native";
import PrayerAudio from "../modules/prayer-audio";
import { loadPhonePrayerAlertPreferences, type PrayerAlertPreferences } from "./alertPreferences";
import { buildPrayerEvents } from "./events";
import type { PrayerKey, PrayerTimes } from "./types";

let exactAlarmSetupStarted = false;
let exactAlarmSettingsOpenedThisSession = false;

async function restoreExactAlarmsIfAvailable() {
  if (Platform.OS !== "android" || !PrayerAudio) return false;
  try {
    if (!PrayerAudio.canScheduleExactAlarms()) return false;
    await PrayerAudio.restoreExactPrayerAlarms();
    return true;
  } catch {
    return false;
  }
}

async function requestExactAlarmAccessIfNeeded() {
  if (Platform.OS !== "android" || !PrayerAudio) return;
  if (await restoreExactAlarmsIfAvailable()) return;
  if (AppState.currentState !== "active" || exactAlarmSettingsOpenedThisSession) return;

  exactAlarmSettingsOpenedThisSession = true;
  try {
    PrayerAudio.openExactAlarmSettings();
  } catch {
    // Alerts settings and Test Adhan remain a manual recovery path.
  }
}

function startFirstLaunchExactAlarmSetup() {
  if (Platform.OS !== "android" || !PrayerAudio || exactAlarmSetupStarted) return;
  exactAlarmSetupStarted = true;

  // Do not launch Android special-access UI while React Native is still mounting.
  // Waiting until the Activity is active makes this reliable on Samsung/Android 14+.
  const timer = setTimeout(() => {
    void requestExactAlarmAccessIfNeeded();
  }, 1800);

  AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    void restoreExactAlarmsIfAvailable().then((granted) => {
      if (!granted) void requestExactAlarmAccessIfNeeded();
    });
  });

  // Keep the timer referenced until it fires; it is intentionally process-lifetime setup.
  void timer;
}

startFirstLaunchExactAlarmSetup();

export type AndroidPrayerAudioResult = {
  count: number;
  exact: boolean;
  available: boolean;
};

export async function scheduleAndroidPrayerAudio(
  prayerTimes: PrayerTimes,
  suppliedPreferences?: PrayerAlertPreferences,
  timeZone = "America/Toronto"
): Promise<AndroidPrayerAudioResult> {
  if (Platform.OS !== "android" || !PrayerAudio) {
    return { count: 0, exact: false, available: false };
  }

  const preferences = suppliedPreferences ?? await loadPhonePrayerAlertPreferences();
  const events = buildPrayerEvents(prayerTimes, 30, new Date(), timeZone)
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
