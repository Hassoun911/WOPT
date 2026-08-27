import type { Env } from "./types";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type FcmMessage = {
  token: string;
  title: string;
  body: string;
  priority: "normal" | "high";
  data?: Record<string, string>;
};

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getAccessToken(env: Env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("Firebase service account is not configured");
  const service = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
  if (!service.project_id || !service.client_email || !service.private_key) throw new Error("Firebase service account is incomplete");

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: service.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: service.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(service.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch(service.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payload = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Firebase OAuth failed: ${response.status} ${payload.error || ""} ${payload.error_description || ""}`.trim());
  }
  return { accessToken: payload.access_token, projectId: service.project_id };
}

export async function sendFcmMessage(env: Env, message: FcmMessage) {
  const { accessToken, projectId } = await getAccessToken(env);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token: message.token,
        notification: { title: message.title, body: message.body },
        android: {
          priority: message.priority === "high" ? "HIGH" : "NORMAL",
          notification: {
            channel_id: "wopt-general-v1",
            sound: "default"
          }
        },
        data: message.data || {}
      }
    })
  });
  const payload = await response.json() as { name?: string; error?: { status?: string; message?: string } };
  if (!response.ok || !payload.name) {
    const status = payload.error?.status || "FCM_ERROR";
    const detail = payload.error?.message || `HTTP ${response.status}`;
    const error = new Error(`${status}: ${detail}`);
    (error as Error & { fcmStatus?: string }).fcmStatus = status;
    throw error;
  }
  return payload.name;
}
