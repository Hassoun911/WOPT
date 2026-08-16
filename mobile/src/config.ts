export const WINDSOR_TIME_ZONE = "America/Toronto";
export const CITY_LABEL = "Windsor, Ontario";
export const SCHEDULE_URL =
  "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";

// Android notification-channel sound settings cannot be changed after creation,
// so channel IDs are versioned independently by notification purpose.
export const REMINDER_CHANNEL_ID = "prayer-reminders-v2";
export const ATHAN_CHANNEL_ID = "prayer-time-v2";
export const GENERAL_CHANNEL_ID = "wopt-general-v1";

export const STORAGE_KEYS = {
  schedule: "wopt:schedule:v1",
  alertsEnabled: "wopt:alerts-enabled:v1",
  scheduledNotificationIds: "wopt:scheduled-notifications:v1",
  pushToken: "wopt:push-token:v1",
  installationId: "wopt:installation-id:v1",
  locale: "wopt:locale:v1"
} as const;
