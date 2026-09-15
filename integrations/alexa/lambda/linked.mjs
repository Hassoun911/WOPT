import { handler as baseHandler } from "./index.mjs";

const API_BASE = (process.env.HASSOUN_API_BASE || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");

// AWS Lambda invokes one request at a time per execution environment. Wrapping
// fetch here lets the existing, heavily-tested Alexa presentation/intent code
// stay unchanged while every Hassoun prayer-data request automatically carries
// the linked Hassoun access token plus privacy-safe device identifiers.
export const handler = async (event) => {
  const originalFetch = globalThis.fetch;
  const accessToken = event?.context?.System?.user?.accessToken || event?.session?.user?.accessToken || "";
  const alexaUserId = event?.context?.System?.user?.userId || event?.session?.user?.userId || "";
  const alexaDeviceId = event?.context?.System?.device?.deviceId || "";

  globalThis.fetch = async (input, init = {}) => {
    const value = typeof input === "string" ? input : input?.url || String(input);
    if (!value.startsWith(`${API_BASE}/voice/alexa/context`)) return originalFetch(input, init);

    const headers = new Headers(init.headers || (typeof input !== "string" ? input?.headers : undefined) || {});
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    if (alexaUserId) headers.set("X-Alexa-User-Id", alexaUserId);
    if (alexaDeviceId) headers.set("X-Alexa-Device-Id", alexaDeviceId);
    headers.set("Accept", "application/json");
    return originalFetch(input, { ...init, headers });
  };

  try {
    return await baseHandler(event);
  } finally {
    globalThis.fetch = originalFetch;
  }
};
