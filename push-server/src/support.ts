import type { Env, Locale } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function addressFrom(value: string | undefined) {
  if (!value) return "";
  const angle = value.match(/<([^>]+)>/);
  return (angle?.[1] ?? value).trim();
}

export async function submitSupportContact(request: Request, env: Env) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid request" }, 400);

  const name = String(body.name ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().slice(0, 254);
  const subject = String(body.subject ?? "Hassoun app support").trim().slice(0, 140);
  const message = String(body.message ?? "").trim().slice(0, 5000);
  const locale: Locale = body.locale === "ar" ? "ar" : "en";
  const appVersion = String(body.appVersion ?? "").trim().slice(0, 40);
  const platform = String(body.platform ?? "").trim().slice(0, 40);

  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Valid email required" }, 400);
  if (message.length < 10) return json({ error: "Message is too short" }, 400);
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return json({ error: "Support email is temporarily unavailable" }, 503);

  const supportAddress = env.SUPPORT_EMAIL || env.EMAIL_REPLY_TO || addressFrom(env.EMAIL_FROM);
  if (!supportAddress) return json({ error: "Support recipient is not configured" }, 503);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [supportAddress],
      reply_to: email,
      subject: `[Hassoun Support] ${subject || "App support"}`,
      text: `Hassoun support request\n\nName: ${name || "Not provided"}\nEmail: ${email}\nLocale: ${locale}\nPlatform: ${platform}\nApp version: ${appVersion}\n\n${message}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#173f35;max-width:640px;margin:auto">
          <h2 style="color:#0b654f">Hassoun Support</h2>
          <p><strong>From:</strong> ${escapeHtml(name || "Not provided")} &lt;${escapeHtml(email)}&gt;</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <p><strong>Locale:</strong> ${escapeHtml(locale)} &nbsp; <strong>Platform:</strong> ${escapeHtml(platform)} &nbsp; <strong>Version:</strong> ${escapeHtml(appVersion)}</p>
          <hr style="border:none;border-top:1px solid #e4ded3" />
          <p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</p>
        </div>`
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Support email delivery failed", response.status, detail.slice(0, 500));
    return json({ error: "Support email could not be sent" }, 502);
  }

  return json({ ok: true });
}
