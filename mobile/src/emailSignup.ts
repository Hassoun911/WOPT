import Constants from "expo-constants";
import { anyPrayerAlertEnabled, DEFAULT_EMAIL_PRAYER_ALERTS, type PrayerAlertPreferences } from "./alertPreferences";
import { detectPrayerLocation, type DetectedPrayerLocation } from "./deviceLocation";
import { getInstallationId } from "./installation";

export type EmailAlertChoices = PrayerAlertPreferences;

export type EmailSignupResult = {
  ok: boolean;
  verificationRequired?: boolean;
  alreadySubscribed?: boolean;
  verificationAlreadySent?: boolean;
  message?: string;
  location?: {
    city?: string | null;
    region?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    timezone?: string;
  };
};

function apiBase() {
  const configured = Constants.expoConfig?.extra?.pushApiUrl as string | undefined;
  return (configured || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
}

export async function getEmailBackendStatus() {
  const response = await fetch(`${apiBase()}/config`);
  if (!response.ok) throw new Error(`Hassoun service unavailable (${response.status})`);
  return await response.json() as {
    emailSignup?: boolean;
    emailDeliveryConfigured?: boolean;
    automaticLocation?: boolean;
  };
}

export async function subscribeToPrayerEmails(
  email: string,
  locale: "en" | "ar",
  choices: EmailAlertChoices,
  detectedLocation?: DetectedPrayerLocation | null
) {
  const location = detectedLocation ?? await detectPrayerLocation();
  if (!location) throw new Error("Location permission is required so Hassoun can use your local prayer times.");

  const installationId = await getInstallationId();
  const prayerAlerts = anyPrayerAlertEnabled(choices);

  const response = await fetch(`${apiBase()}/email/subscribers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      locale,
      installationId,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      city: location.city ?? undefined,
      region: location.region ?? undefined,
      countryCode: location.countryCode ?? undefined,
      countryName: location.countryName ?? undefined,
      preferences: {
        prayerAlerts,
        dailyPrayerSchedule: false,
        religiousOccasions: true,
        dailyContent: false,
        announcements: true,
        communityEvents: true,
        marketing: false
      },
      prayers: choices
    })
  });

  const payload = await response.json().catch(() => ({})) as EmailSignupResult & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Email signup failed (${response.status})`);
  return { result: payload, detectedLocation: location };
}

export async function subscribeToDailyPrayerTimes(
  email: string,
  locale: "en" | "ar",
  location: { latitude: number; longitude: number; timezone: string; label: string }
) {
  const installationId = await getInstallationId();
  const labelParts = location.label.split(",").map((part) => part.trim()).filter(Boolean);
  const response = await fetch(`${apiBase()}/email/subscribers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      locale,
      installationId,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      city: labelParts[0] || location.label,
      region: labelParts[1] || undefined,
      preferences: {
        prayerAlerts: false,
        dailyPrayerSchedule: true,
        religiousOccasions: true,
        dailyContent: false,
        announcements: false,
        communityEvents: false,
        marketing: false
      },
      prayers: DEFAULT_EMAIL_PRAYER_ALERTS
    })
  });

  const payload = await response.json().catch(() => ({})) as EmailSignupResult & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Email signup failed (${response.status})`);
  return payload;
}
