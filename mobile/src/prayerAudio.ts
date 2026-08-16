import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import PrayerAudio from "../modules/prayer-audio";
import { buildPrayerEvents } from "./events";
import type { PrayerKey, PrayerTimes } from "./types";

const EXACT_ALARM_SETUP_KEY = "wopt:exact-alarm-setup:v1";
let firstLaunchAlarmCheckStarted = false;

function startFirstLaunchExactAlarmSetup() {
  if (Platform.OS !== "android" || !PrayerAudio || firstLaunchAlarmCheckStarted) return;
  firstLaunchAlarmCheckStarted = true;

  // Give the first app screen time to mount before Android opens its system
  // Alarms & reminders page. AsyncStorage is cleared by a fresh uninstall, so
  // this runs once per installation. Existing users also receive it once when
  // upgrading from a build that did not yet store this marker.
  setTimeout(() => {
    void (async () => {
      try {
        const alreadyHandled = await AsyncStorage.getItem(EXACT_ALARM_SETUP_KEY);
        if (alreadyHandled) return;

        await AsyncStorage.setItem(EXACT_ALARM_SETUP_KEY, "shown");
        if (!PrayerAudio.canScheduleExactAlarms()) {
          PrayerAudio.openExactAlarmSettings();
        }
      } catch {
        // Never block the app if onboarding storage fails. The Alerts tab and
        // Test Adhan flow remain the recovery path for exact-alarm access.
      }
    })();
  }, 1200);
}

startFirstLaunchExactAlarmSetup();

export type AndroidPrayerAudioResult = {
  count: number;
  exact: boolean;
  available: boolean;
};

export async function scheduleAndroidPrayerAudio(
  prayerTimes: PrayerTimes
): Promise<AndroidPrayerAudioResult> {
  if (Platform.OS !== "android" || !PrayerAudio) {
    return { count: 0, exact: false, available: false };
  }

  const events = buildPrayerEvents(prayerTimes, 30)
    .filter((event) => event.kind === "athan")
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
