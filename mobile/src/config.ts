export const WINDSOR_TIME_ZONE = "America/Toronto";
export const CITY_LABEL = "Windsor, Ontario";
export const SCHEDULE_URL =
  "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";

export const REMINDER_CHANNEL_ID = "prayer-reminders-v1";
export const ATHAN_CHANNEL_ID = "prayer-athan-v1";

export const STORAGE_KEYS = {
  schedule: "wopt:schedule:v1",
  alertsEnabled: "wopt:alerts-enabled:v1",
  scheduledNotificationIds: "wopt:scheduled-notifications:v1",
  pushToken: "wopt:push-token:v1",
  installationId: "wopt:installation-id:v1",
  locale: "wopt:locale:v1"
} as const;
