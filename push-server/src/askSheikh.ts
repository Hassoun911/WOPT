import type { Env, Locale } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classify(question: string) {
  const q = normalize(question);
  const rules: Array<[string, string[]]> = [
    ["quran", ["quran", "قران", "ayah", "verse", "surah", "سوره", "ايه", "story", "قصه"]],
    ["hadith", ["hadith", "حديث", "bukhari", "مسلم", "sunnah", "سنه"]],
    ["prayer", ["prayer", "salah", "salat", "صلاه", "اذان", "fajr", "dhuhr", "asr", "maghrib", "isha"]],
    ["fasting", ["fast", "fasting", "ramadan", "صيام", "رمضان", "صوم"]],
    ["family", ["marriage", "wife", "husband", "parents", "children", "family", "زواج", "زوج", "والد", "اطفال", "عائله"]],
    ["seerah", ["prophet", "muhammad", "يوسف", "موسى", "عيسى", "ابراهيم", "نبي", "رسول", "seerah"]]
  ];
  for (const [category, terms] of rules) if (terms.some((term) => q.includes(term))) return category;
  return "general";
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 24_000) throw new Error("Request body is too large");
  return await request.json() as Record<string, unknown>;
}

export async function recordAskSheikhQuestion(request: Request, env: Env) {
  const body = await bodyJson(request);
  const question = clean(body.question, 600);
  if (question.length < 3) return json({ error: "Question is required" }, 400);
  const locale: Locale = body.locale === "ar" ? "ar" : "en";
  const normalized = normalize(question);
  if (!normalized) return json({ error: "Question is required" }, 400);
  const category = clean(body.category, 40) || classify(question);
  const quranRefs = Array.isArray(body.quranRefs)
    ? body.quranRefs.slice(0, 20).map((x) => clean(x, 30)).filter(Boolean)
    : [];

  const existing = await env.DB.prepare(
    `SELECT public_id, asked_count FROM ask_sheikh_questions WHERE normalized_question = ? AND locale = ? LIMIT 1`
  ).bind(normalized, locale).first<{ public_id: string; asked_count: number }>();

  let publicId: string;
  if (existing) {
    publicId = existing.public_id;
    await env.DB.prepare(
      `UPDATE ask_sheikh_questions
       SET question_text = ?, category = ?, quran_refs_json = ?, asked_count = asked_count + 1,
           last_asked_at = CURRENT_TIMESTAMP
       WHERE public_id = ?`
    ).bind(question, category, JSON.stringify(quranRefs), publicId).run();
  } else {
    publicId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO ask_sheikh_questions(public_id, question_text, normalized_question, locale, category, quran_refs_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(publicId, question, normalized, locale, category, JSON.stringify(quranRefs)).run();
  }

  const hadithTerms = normalized.split(" ").filter((x) => x.length >= 4).slice(0, 6);
  let hadith: Array<Record<string, unknown>> = [];
  if (hadithTerms.length) {
    const where = hadithTerms.map(() => `(LOWER(COALESCE(title_en,'')) LIKE ? OR LOWER(COALESCE(body_en,'')) LIKE ? OR COALESCE(title_ar,'') LIKE ? OR COALESCE(body_ar,'') LIKE ?)`).join(" OR ");
    const params = hadithTerms.flatMap((term) => [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]);
    const result = await env.DB.prepare(
      `SELECT public_id, title_en, title_ar, body_en, body_ar, source_text
       FROM app_content WHERE content_type = 'hadith' AND status = 'published' AND (${where})
       ORDER BY featured DESC, updated_at DESC LIMIT 6`
    ).bind(...params).all<Record<string, unknown>>();
    hadith = result.results;
  }

  return json({ ok: true, publicId, category, hadith });
}

export async function listAskSheikhQuestions(url: URL, env: Env) {
  const search = clean(url.searchParams.get("search"), 120);
  const category = clean(url.searchParams.get("category"), 40);
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "en";
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") || 30) || 30));
  const like = `%${normalize(search)}%`;
  const { results } = await env.DB.prepare(
    `SELECT public_id, question_text, locale, category, quran_refs_json, asked_count, last_asked_at
     FROM ask_sheikh_questions
     WHERE locale = ?
       AND (? = '' OR category = ?)
       AND (? = '' OR normalized_question LIKE ?)
     ORDER BY asked_count DESC, last_asked_at DESC
     LIMIT ?`
  ).bind(locale, category, category, search, like, limit).all<Record<string, unknown>>();

  const categories = await env.DB.prepare(
    `SELECT category, SUM(asked_count) AS question_count, COUNT(*) AS distinct_questions
     FROM ask_sheikh_questions WHERE locale = ? GROUP BY category ORDER BY question_count DESC`
  ).bind(locale).all<Record<string, unknown>>();
  const total = await env.DB.prepare(`SELECT COALESCE(SUM(asked_count),0) AS total, COUNT(*) AS distinct_count FROM ask_sheikh_questions WHERE locale = ?`).bind(locale).first<Record<string, number>>();

  return json({ ok: true, questions: results, categories: categories.results, totalAsked: total?.total ?? 0, distinctQuestions: total?.distinct_count ?? 0, grouped: (total?.distinct_count ?? 0) > 10 });
}
