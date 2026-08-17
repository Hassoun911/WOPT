import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  ATHAN_CHANNEL_ID,
  CITY_LABEL,
  GENERAL_CHANNEL_ID,
  REMINDER_CHANNEL_ID,
  STORAGE_KEYS
} from "./config";
import { buildPrayerEvents } from "./events";
import { cancelAndroidPrayerAudio, scheduleAndroidPrayerAudio } from "./prayerAudio";
import { formatPrayerTime } from "./time";
import type { PrayerEvent, PrayerKey, PrayerTimes } from "./types";

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};

const PRAYER_EVENT_KINDS = new Set(["twenty", "ten", "athan"]);
let notificationScheduleQueue: Promise<void> = Promise.resolve();

function withNotificationScheduleLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = notificationScheduleQueue.then(operation, operation);
  notificationScheduleQueue = run.then(() => undefined, () => undefined);
  return run;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldPlaySound: notification.request.content.data?.kind !== "athan",
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
    sound: "attention_chime.wav",
    vibrationPattern: [0, 240, 120, 240, 120, 240],
    lightColor: "#d9b85f",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
  });
  await Notifications.setNotificationChannelAsync(ATHAN_CHANNEL_ID, {
    name: "Prayer time",
    description: "Visual notification at the exact prayer time; native Android playback supplies the Adhan",
    importance: Notifications.AndroidImportance.MAX,
    sound: null,
    vibrationPattern: [0, 400, 180, 400],
    lightColor: "#0b5b47",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
  });
  await Notifications.setNotificationChannelAsync(GENERAL_CHANNEL_ID, {
    name: "Hassoun updates",
    description: "Announcements, community events, Islamic occasions and other Hassoun updates",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 260, 140, 260],
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

export async function scheduleTestReminder(delaySeconds = 15) {
  const granted = await requestNotificationPermission();
  if (!granted) return { granted: false, identifier: null as string | null };
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Hassoun test notification",
      body: "Prayer reminder notifications are working.",
      sound: "attention_chime.wav",
      data: { kind: "test-reminder" }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(5, delaySeconds),
      repeats: false,
      channelId: REMINDER_CHANNEL_ID
    }
  });
  return { granted: true, identifier };
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
      sound: "attention_chime.wav"
    };
  }
  if (event.kind === "ten") {
    return {
      ...common,
      title: locale === "ar" ? `بقي ١٠ دقائق على صلاة ${prayer}` : `${prayer} in 10 minutes`,
      body: `${time} • ${CITY_LABEL}`,
      sound: "attention_chime.wav"
    };
  }
  return {
    ...common,
    title: locale === "ar" ? `حان الآن وقت صلاة ${prayer}` : `It is time for ${prayer}`,
    body: `${time} • ${CITY_LABEL}`,
    sound: null
  };
}

async function cancelPrayerNotificationsUnlocked() {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.scheduledNotificationIds);
  let savedIdentifiers: string[] = [];
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed)) {
        savedIdentifiers = parsed.filter((value): value is string => typeof value === "string");
      }
    } catch {
      // A bad legacy value must never stop prayer-alert cleanup.
    }
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const discoveredPrayerIdentifiers = scheduled
    .filter((request) => {
      const data = request.content.data as Record<string, unknown> | null | undefined;
      return typeof data?.eventId === "string" && PRAYER_EVENT_KINDS.has(String(data.kind ?? ""));
    })
    .map((request) => request.identifier);

  const identifiers = Array.from(new Set([...savedIdentifiers, ...discoveredPrayerIdentifiers]));
  await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.scheduledNotificationIds),
    cancelAndroidPrayerAudio()
  ]);
}

export function cancelPrayerNotifications() {
  return withNotificationScheduleLock(cancelPrayerNotificationsUnlocked);
}

async function schedulePrayerNotificationsUnlocked(
  prayerTimes: PrayerTimes,
  locale: "en" | "ar"
) {
  const granted = await requestNotificationPermission();
  if (!granted) return { granted: false, count: 0 };

  await cancelPrayerNotificationsUnlocked();
  const days = Platform.OS === "ios" ? 4 : 14;
  const events = buildPrayerEvents(prayerTimes, days).filter(
    (event) => Platform.OS !== "android" || event.kind !== "athan"
  );
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

  const androidAudio = await scheduleAndroidPrayerAudio(prayerTimes);

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.scheduledNotificationIds, JSON.stringify(identifiers)),
    AsyncStorage.setItem(STORAGE_KEYS.alertsEnabled, "on")
  ]);
  return {
    granted: true,
    count: identifiers.length + androidAudio.count,
    reminderCount: identifiers.length,
    audioCount: androidAudio.count,
    exactAlarmGranted: Platform.OS !== "android" || androidAudio.exact
  };
}

export function schedulePrayerNotifications(
  prayerTimes: PrayerTimes,
  locale: "en" | "ar"
) {
  return withNotificationScheduleLock(() => schedulePrayerNotificationsUnlocked(prayerTimes, locale));
}

export async function disablePrayerNotifications() {
  await cancelPrayerNotifications();
  await AsyncStorage.setItem(STORAGE_KEYS.alertsEnabled, "off");
}
