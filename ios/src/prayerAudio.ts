import { Alert, Platform } from "react-native";
import PrayerAudio from "../modules/prayer-audio";
import { loadPhonePrayerAlertPreferences, type PrayerAlertPreferences } from "./alertPreferences";
import { WINDSOR_TIME_ZONE } from "./config";
import { buildPrayerEvents } from "./events";
import type { PrayerKey, PrayerTimes } from "./types";

let exactAlarmSetupStarted = false;

function startFirstLaunchExactAlarmSetup() {
  if (Platform.OS !== "android" || !PrayerAudio || exactAlarmSetupStarted) return;
  const nativePrayerAudio = PrayerAudio;
  exactAlarmSetupStarted = true;

  // SCHEDULE_EXACT_ALARM is a special Android access screen, not a normal
  // runtime permission dialog. Explain it first, then take the user directly
  // to Alarms & reminders. Never restore/play saved alarms on app startup.
  setTimeout(() => {
    try {
      if (nativePrayerAudio.canScheduleExactAlarms()) return;
      Alert.alert(
        "Allow Alarms & reminders",
        "Hassoun needs Alarms & reminders access so Adhan can play at the exact prayer time, including while your phone is locked.",
        [
          { text: "Later", style: "cancel" },
          {
            text: "Enable",
            onPress: () => {
              try { nativePrayerAudio.openExactAlarmSettings(); } catch {}
            }
          }
        ]
      );
    } catch {}
  }, 1400);
}

startFirstLaunchExactAlarmSetup();

export type AndroidPrayerAudioResult = { count: number; exact: boolean; available: boolean };

export async function scheduleAndroidPrayerAudio(
  prayerTimes: PrayerTimes,
  suppliedPreferences?: PrayerAlertPreferences,
  timeZone = WINDSOR_TIME_ZONE
): Promise<AndroidPrayerAudioResult> {
  if (Platform.OS !== "android" || !PrayerAudio) return { count: 0, exact: false, available: false };

  const preferences = suppliedPreferences ?? await loadPhonePrayerAlertPreferences();
  const now = Date.now();
  const events = buildPrayerEvents(prayerTimes, 30, new Date(), timeZone)
    .filter((event) => event.kind === "athan" && preferences[event.prayer]?.athan === true)
    .filter((event) => event.scheduledAt.getTime() > now + 1000)
    .map((event) => ({ id: event.id, prayer: event.prayer, scheduledAtMs: event.scheduledAt.getTime() }));
  const result = await PrayerAudio.scheduleExactPrayerAlarms(JSON.stringify(events));
  return { count: result.scheduled, exact: result.exact, available: true };
}

export async function scheduleAndroidTestAdhan(prayer: PrayerKey = "fajr", delaySeconds = 30) {
  if (Platform.OS !== "android" || !PrayerAudio) return { exact: false, available: false };
  const result = await PrayerAudio.scheduleTestPrayerAlarm(prayer, delaySeconds);
  return { exact: result.exact, available: true };
}

export async function cancelAndroidPrayerAudio() {
  if (Platform.OS === "android" && PrayerAudio) await PrayerAudio.cancelExactPrayerAlarms();
}

export function canScheduleAndroidExactAlarms() {
  return Platform.OS === "android" && PrayerAudio ? PrayerAudio.canScheduleExactAlarms() : false;
}

export function openExactAlarmSettings() {
  if (Platform.OS === "android" && PrayerAudio) PrayerAudio.openExactAlarmSettings();
}
