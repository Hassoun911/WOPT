import type { Env } from "./types";

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function getSponsorLogo(env: Env, templateKey: string) {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(templateKey)) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare(
    `SELECT sponsor_logo_mime, sponsor_logo_base64
     FROM email_template_profiles WHERE template_key = ? LIMIT 1`
  ).bind(templateKey).first<{ sponsor_logo_mime: string | null; sponsor_logo_base64: string | null }>();
  if (!row?.sponsor_logo_mime || !row.sponsor_logo_base64) return new Response("Not found", { status: 404 });
  if (!['image/png','image/jpeg','image/webp'].includes(row.sponsor_logo_mime)) return new Response("Not found", { status: 404 });
  try {
    return new Response(decodeBase64(row.sponsor_logo_base64), {
      headers: {
        "Content-Type": row.sponsor_logo_mime,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
