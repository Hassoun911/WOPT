import Constants from "expo-constants";

export type SupportMessage = {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: "en" | "ar";
  appVersion?: string;
  platform?: string;
};

function apiBase() {
  const configured = Constants.expoConfig?.extra?.pushApiUrl as string | undefined;
  return (configured || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
}

export async function submitSupportMessage(input: SupportMessage) {
  const response = await fetch(`${apiBase()}/support/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Support request failed (${response.status})`);
  }
  return payload;
}
