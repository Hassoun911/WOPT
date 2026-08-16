import Constants from "expo-constants";
import { detectPrayerLocation } from "./deviceLocation";
import { getInstallationId } from "./installation";
import { PRAYER_KEYS } from "./types";

export type EmailAlertChoices = {
  twenty: boolean;
  ten: boolean;
  athan: boolean;
};

export type EmailSignupResult = {
  ok: boolean;
  verificationRequired?: boolean;
  alreadySubscribed?: boolean;
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
  if (!response.ok) throw new Error(`WOPT service unavailable (${response.status})`);
  return await response.json() as {
    emailSignup?: boolean;
    emailDeliveryConfigured?: boolean;
    automaticLocation?: boolean;
  };
}

export async function subscribeToPrayerEmails(
  email: string,
  locale: "en" | "ar",
  choices: EmailAlertChoices
) {
  const location = await detectPrayerLocation();
  if (!location) throw new Error("Location permission is required so WOPT can use your local prayer times.");

  const installationId = await getInstallationId();
  const prayers = Object.fromEntries(
    PRAYER_KEYS.map((prayer) => [prayer, choices])
  );

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
        prayerAlerts: true,
        dailyPrayerSchedule: false,
        religiousOccasions: true,
        dailyContent: false,
        announcements: true,
        communityEvents: true,
        marketing: false
      },
      prayers
    })
  });

  const payload = await response.json().catch(() => ({})) as EmailSignupResult & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Email signup failed (${response.status})`);
  return {
    result: payload,
    detectedLocation: location
  };
}
