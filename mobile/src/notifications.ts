import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ATHAN_CHANNEL_ID, CITY_LABEL, REMINDER_CHANNEL_ID, STORAGE_KEYS } from "./config";
import { buildPrayerEvents } from "./events";
import { formatPrayerTime } from "./time";
import type { PrayerEvent, PrayerKey, PrayerTimes } from "./types";

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function configureNotificationChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "Prayer reminders",
    description: "Reminders 20 and 10 minutes before each prayer",
    importance: Notifications.AndroidImportance.MAX,
    sound: "ding.wav",
    vibrationPattern: [0, 240, 120, 240, 120, 240],
    lightColor: "#d9b85f",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
  });
  await Notifications.setNotificationChannelAsync(ATHAN_CHANNEL_ID, {
    name: "Prayer time — Adhan",
    description: "Notification at the exact prayer time",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 400, 180, 400],
    lightColor: "#0b5b47",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
  });
}

export async function requestNotificationPermission() {
  await configureNotificationChannels();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true }
  });
  return requested.granted;
}

function notificationContent(event: PrayerEvent, locale: "en" | "ar") {
  const prayer = NAMES[event.prayer][locale];
  const time = formatPrayerTime(event.prayerTime, locale);
  const common = {
    data: {
      eventId: event.id,
      dateKey: event.dateKey,
      prayer: event.prayer,
      kind: event.kind
    }
  };

  if (event.kind === "twenty") {
    return {
      ...common,
      title: locale === "ar" ? `بقي ٢٠ دقيقة على صلاة ${prayer}` : `${prayer} in 20 minutes`,
      body: `${time} • ${CITY_LABEL}`,
      sound: "ding.wav"
    };
  }
  if (event.kind === "ten") {
    return {
      ...common,
      title: locale === "ar" ? `بقي ١٠ دقائق على صلاة ${prayer}` : `${prayer} in 10 minutes`,
      body: `${time} • ${CITY_LABEL}`,
      sound: "ding.wav"
    };
  }
  return {
    ...common,
    title: locale === "ar" ? `حان الآن وقت صلاة ${prayer}` : `It is time for ${prayer}`,
    body: `${time} • ${CITY_LABEL}`,
    // The final Adhan recording will replace the default sound after the audio is approved.
    sound: "default"
  };
}

export async function cancelPrayerNotifications() {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.scheduledNotificationIds);
  const identifiers = saved ? (JSON.parse(saved) as string[]) : [];
  await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
  await AsyncStorage.removeItem(STORAGE_KEYS.scheduledNotificationIds);
}

export async function schedulePrayerNotifications(
  prayerTimes: PrayerTimes,
  locale: "en" | "ar"
) {
  const granted = await requestNotificationPermission();
  if (!granted) return { granted: false, count: 0 };

  await cancelPrayerNotifications();
  // iOS keeps at most 64 pending local notifications; four days uses at most 60.
  // The push server remains the primary path and local notifications are the fallback.
  const days = Platform.OS === "ios" ? 4 : 14;
  const events = buildPrayerEvents(prayerTimes, days);
  const identifiers: string[] = [];

  for (const event of events) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: notificationContent(event, locale),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: event.scheduledAt,
        channelId: event.kind === "athan" ? ATHAN_CHANNEL_ID : REMINDER_CHANNEL_ID
      }
    });
    identifiers.push(identifier);
  }

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.scheduledNotificationIds, JSON.stringify(identifiers)),
    AsyncStorage.setItem(STORAGE_KEYS.alertsEnabled, "on")
  ]);
  return { granted: true, count: identifiers.length };
}

export async function disablePrayerNotifications() {
  await cancelPrayerNotifications();
  await AsyncStorage.setItem(STORAGE_KEYS.alertsEnabled, "off");
}
