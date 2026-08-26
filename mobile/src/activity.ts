import { Platform } from "react-native";
import { getInstallationId } from "./installation";

const API_URL = "https://wopt-prayer-push.wopt-windsor.workers.dev/activity";

export type HassounActivity = "app_open" | "home" | "quran" | "games" | "alerts" | "events" | "sheikh" | "qibla" | "more" | "email_alerts";

const DETAILS: Record<HassounActivity, string> = {
  app_open: "Opened the Hassoun mobile app",
  home: "Viewed the prayer dashboard",
  quran: "Opened the Qur’an",
  games: "Opened games and learning",
  alerts: "Reviewed prayer alerts",
  events: "Viewed Islamic events",
  sheikh: "Opened Ask the Sheikh",
  qibla: "Opened Qibla compass",
  more: "Opened app settings",
  email_alerts: "Reviewed email prayer alerts"
};

let lastActivity = "";
let lastAt = 0;

export async function reportHassounActivity(activity: HassounActivity, detail = DETAILS[activity]) {
  const now = Date.now();
  if (lastActivity === activity && now - lastAt < 30_000) return;
  lastActivity = activity;
  lastAt = now;
  try {
    const installationId = await getInstallationId();
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId, activity, detail, platform: Platform.OS })
    });
  } catch {
    // Activity personalization must never interrupt the prayer/Qur’an experience.
  }
}
