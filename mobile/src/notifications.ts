import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  ATHAN_CHANNEL_ID,
  CITY_LABEL,
  GENERAL_CHANNEL_ID,
  REMINDER_CHANNEL_ID,
  STORAGE_KEYS,
  WINDSOR_TIME_ZONE
} from "./config";
import { buildPrayerEvents } from "./events";
import { islamicEventTimeline } from "./islamicEvents";
import { loadPhonePrayerAlertPreferences, type PrayerAlertPreferences } from "./alertPreferences";
import { cancelAndroidPrayerAudio, scheduleAndroidPrayerAudio } from "./prayerAudio";
import { addDateDays, formatPrayerTime, localToDateInZone } from "./time";
import { loadSavedPrayerContext } from "./prayerData";
import { registerDeviceForServerPush } from "./push";
import type { PrayerEvent, PrayerKey, PrayerTimes } from "./types";

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};

const PRAYER_EVENT_KINDS = new Set(["twenty", "ten", "athan"]);
const ISLAMIC_EVENT_KIND = "islamic-event-15-day";
const ISLAMIC_EVENT_MARKER_KEY = "hassoun:islamic-event:last-scheduled:v1";
let notificationScheduleQueue: Promise<void> = Promise.resolve();

export type PrayerNotificationContext = { timeZone?: string; locationLabel?: string };
type PrayerNotificationContextInput = PrayerNotificationContext | string | undefined;

function normalizeContext(contextOrLabel?: PrayerNotificationContextInput, legacyTimeZone?: string): PrayerNotificationContext {
  if (typeof contextOrLabel === "string") return { locationLabel: contextOrLabel, timeZone: legacyTimeZone };
  return contextOrLabel || {};
}

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
    description: "20 and 10 minute prayer reminders",
    importance: Notifications.AndroidImportance.MAX,
    sound: "attention_chime.wav",
    vibrationPattern: [0, 240, 120, 240, 120, 240],
    lightColor: "#d9b85f",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
  });
  await Notifications.setNotificationChannelAsync(ATHAN_CHANNEL_ID, {
    name: "Prayer time",
    description: "Prayer-time notification and Adhan",
    importance: Notifications.AndroidImportance.MAX,
    sound: null,
    vibrationPattern: [0, 400, 180, 400],
    lightColor: "#0b5b47",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
  });
  await Notifications.setNotificationChannelAsync(GENERAL_CHANNEL_ID, {
    name: "Hassoun updates",
    description: "Hassoun updates and Islamic occasions",
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
  const requested = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  return requested.granted;
}

export async function scheduleTestReminder(delaySeconds = 15) {
  const granted = await requestNotificationPermission();
  if (!granted) return { granted: false, identifier: null as string | null };
  const identifier = await Notifications.scheduleNotificationAsync({
    content: { title: "Hassoun test notification", body: "Prayer reminder notifications are working.", sound: "attention_chime.wav", data: { kind: "test-reminder" } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(5, delaySeconds), repeats: false, channelId: REMINDER_CHANNEL_ID }
  });
  return { granted: true, identifier };
}

export async function disableIslamicEventReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ids = scheduled.filter((request) => request.content.data?.kind === ISLAMIC_EVENT_KIND).map((request) => request.identifier);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await AsyncStorage.removeItem(ISLAMIC_EVENT_MARKER_KEY);
}

export async function scheduleIslamicEventReminders(todayKey: string, locale: "en" | "ar", timeZone = WINDSOR_TIME_ZONE) {
  const granted = await requestNotificationPermission();
  if (!granted) return { granted: false, scheduled: false };
  const timeline = islamicEventTimeline(todayKey);
  const event = timeline.next;
  const days = timeline.daysUntilNext;
  if (!event || days === null) return { granted: true, scheduled: false };
  const eventKey = `${event.id}:${event.dateKey}`;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.find((request) => request.content.data?.kind === ISLAMIC_EVENT_KIND && request.content.data?.eventKey === eventKey);
  if (existing) return { granted: true, scheduled: true, identifier: existing.identifier };
  const stale = scheduled.filter((request) => request.content.data?.kind === ISLAMIC_EVENT_KIND);
  await Promise.all(stale.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
  const title = locale === "ar" ? `متبقي ١٥ يوماً على ${event.name.ar}` : `${event.name.en} is 15 days away`;
  const body = locale === "ar" ? `${event.description.ar} • افتح Hassoun لمشاهدة التقويم الإسلامي.` : `${event.description.en} • Open Hassoun to view the Islamic calendar.`;
  const content = { title, body, sound: "default" as const, data: { kind: ISLAMIC_EVENT_KIND, eventKey, eventId: event.id, eventDate: event.dateKey } };
  const identifier = days <= 15
    ? await Notifications.scheduleNotificationAsync({ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, repeats: false, channelId: GENERAL_CHANNEL_ID } })
    : await Notifications.scheduleNotificationAsync({ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: localToDateInZone(addDateDays(event.dateKey, -15), "09:00", timeZone), channelId: GENERAL_CHANNEL_ID } });
  await AsyncStorage.setItem(ISLAMIC_EVENT_MARKER_KEY, eventKey);
  return { granted: true, scheduled: true, identifier, eventKey };
}

function notificationContent(event: PrayerEvent, locale: "en" | "ar", locationLabel: string) {
  const prayer = NAMES[event.prayer][locale];
  const time = formatPrayerTime(event.prayerTime, locale);
  const common = { data: { eventId: event.id, dateKey: event.dateKey, prayer: event.prayer, kind: event.kind, locationLabel } };
  if (event.kind === "twenty") return { ...common, title: locale === "ar" ? `بقي ٢٠ دقيقة على صلاة ${prayer}` : `${prayer} in 20 minutes`, body: `${time} • ${locationLabel}`, sound: "attention_chime.wav" };
  if (event.kind === "ten") return { ...common, title: locale === "ar" ? `بقي ١٠ دقائق على صلاة ${prayer}` : `${prayer} in 10 minutes`, body: `${time} • ${locationLabel}`, sound: "attention_chime.wav" };
  return { ...common, title: locale === "ar" ? `حان الآن وقت صلاة ${prayer}` : `It is time for ${prayer}`, body: `${time} • ${locationLabel}` };
}

function eventEnabled(event: PrayerEvent, preferences: PrayerAlertPreferences) {
  const prayer = preferences[event.prayer];
  if (!prayer) return false;
  if (event.kind === "twenty") return prayer.twenty;
  if (event.kind === "ten") return prayer.ten;
  return event.kind === "athan" ? prayer.athan : false;
}

async function cancelPrayerNotificationsUnlocked() {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.scheduledNotificationIds);
  let savedIds: string[] = [];
  if (saved) {
    try { const parsed = JSON.parse(saved) as unknown; if (Array.isArray(parsed)) savedIds = parsed.filter((value): value is string => typeof value === "string"); } catch {}
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const discovered = scheduled.filter((request) => typeof request.content.data?.eventId === "string" && PRAYER_EVENT_KINDS.has(String(request.content.data?.kind ?? ""))).map((request) => request.identifier);
  const identifiers = Array.from(new Set([...savedIds, ...discovered]));
  await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
  await Promise.all([AsyncStorage.removeItem(STORAGE_KEYS.scheduledNotificationIds), cancelAndroidPrayerAudio()]);
}

export function cancelPrayerNotifications() { return withNotificationScheduleLock(cancelPrayerNotificationsUnlocked); }

async function schedulePrayerNotificationsUnlocked(
  prayerTimes: PrayerTimes,
  locale: "en" | "ar",
  suppliedPreferences?: PrayerAlertPreferences,
  contextOrLabel?: PrayerNotificationContextInput,
  legacyTimeZone?: string
) {
  const granted = await requestNotificationPermission();
  if (!granted) return { granted: false, count: 0 };
  await cancelPrayerNotificationsUnlocked();
  const preferences = suppliedPreferences ?? await loadPhonePrayerAlertPreferences();
  const savedContext = await loadSavedPrayerContext();
  const context = normalizeContext(contextOrLabel, legacyTimeZone);
  const timeZone = context.timeZone || savedContext?.location.timezone || WINDSOR_TIME_ZONE;
  const locationLabel = context.locationLabel || savedContext?.location.label || CITY_LABEL;
  const days = Platform.OS === "ios" ? 4 : 14;
  const events = buildPrayerEvents(prayerTimes, days, new Date(), timeZone)
    .filter((event) => eventEnabled(event, preferences))
    .filter((event) => Platform.OS !== "android" || event.kind !== "athan");
  const identifiers: string[] = [];
  for (const event of events) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: notificationContent(event, locale, locationLabel),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: event.scheduledAt, channelId: event.kind === "athan" ? ATHAN_CHANNEL_ID : REMINDER_CHANNEL_ID }
    });
    identifiers.push(identifier);
  }
  const androidAudio = await scheduleAndroidPrayerAudio(prayerTimes, preferences, timeZone);
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.scheduledNotificationIds, JSON.stringify(identifiers)),
    AsyncStorage.setItem(STORAGE_KEYS.alertsEnabled, "on")
  ]);
  void registerDeviceForServerPush(locale).catch(() => undefined);
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
  locale: "en" | "ar",
  preferences?: PrayerAlertPreferences,
  contextOrLabel?: PrayerNotificationContextInput,
  legacyTimeZone?: string
) {
  return withNotificationScheduleLock(() => schedulePrayerNotificationsUnlocked(prayerTimes, locale, preferences, contextOrLabel, legacyTimeZone));
}

export async function disablePrayerNotifications() {
  await cancelPrayerNotifications();
  await AsyncStorage.setItem(STORAGE_KEYS.alertsEnabled, "off");
}
