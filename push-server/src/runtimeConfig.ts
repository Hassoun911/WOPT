import type { Env } from "./types";

const PUBLIC_SETTING_KEYS = [
  "maintenance_mode",
  "minimum_android_version",
  "minimum_ios_version",
  "force_update_android",
  "force_update_ios",
  "quran_enabled",
  "games_enabled",
  "email_enabled",
  "community_content_enabled",
  "prayer_times_enabled",
  "alerts_enabled",
  "islamic_events_enabled",
  "sadaqah_section_enabled",
  "donation_enabled",
  "ask_sheikh_enabled",
  "ask_sheikh_share_enabled",
  "ask_sheikh_max_results",
  "ask_sheikh_disclaimer_en",
  "ask_sheikh_disclaimer_ar",
  "system_banner",
  "scrolling_ticker",
  "about_sadaqah",
  "feature_guide"
] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, s-maxage=60"
    }
  });
}

export async function getPublicRuntimeConfig(env: Env) {
  const placeholders = PUBLIC_SETTING_KEYS.map(() => "?").join(",");
  const [settingsResult, contentResult] = await Promise.all([
    env.DB.prepare(
      `SELECT setting_key, value_json, updated_at
       FROM app_settings
       WHERE setting_key IN (${placeholders})`
    ).bind(...PUBLIC_SETTING_KEYS).all<Record<string, string>>(),
    env.DB.prepare(
      `SELECT public_id, content_type, title_en, title_ar, body_en, body_ar, source_text,
              metadata_json, featured, starts_at, ends_at, updated_at
       FROM app_content
       WHERE status = 'published'
         AND featured = 1
         AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
         AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
       ORDER BY updated_at DESC
       LIMIT 20`
    ).all<Record<string, unknown>>()
  ]);

  const settings: Record<string, unknown> = {};
  let settingsUpdatedAt: string | null = null;
  for (const row of settingsResult.results) {
    const key = row.setting_key;
    const raw = row.value_json;
    const updatedAt = row.updated_at;
    if (typeof key !== "string" || typeof raw !== "string") continue;
    try { settings[key] = JSON.parse(raw); }
    catch { settings[key] = raw; }
    if (typeof updatedAt === "string" && (!settingsUpdatedAt || updatedAt > settingsUpdatedAt)) settingsUpdatedAt = updatedAt;
  }

  const featuredContent = contentResult.results.map((row) => {
    let metadata: unknown = null;
    if (typeof row.metadata_json === "string" && row.metadata_json) {
      try { metadata = JSON.parse(row.metadata_json); } catch { metadata = null; }
    }
    return {
      publicId: row.public_id,
      type: row.content_type,
      titleEn: row.title_en,
      titleAr: row.title_ar,
      bodyEn: row.body_en,
      bodyAr: row.body_ar,
      source: row.source_text,
      metadata,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      updatedAt: row.updated_at
    };
  });

  return json({
    ok: true,
    settings,
    featuredContent,
    settingsUpdatedAt,
    generatedAt: new Date().toISOString()
  });
}
