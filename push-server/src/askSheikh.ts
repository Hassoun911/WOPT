import type { Env, Locale } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function normalize(value: string) {
  return value.toLocaleLowerCase("en").normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

const STOP = new Set(["what","does","islam","say","about","this","that","the","a","an","and","or","to","of","in","on","for","with","can","i","we","you","my","our","it","is","are","was","were","do","does","did","how","why","when","where","who","هل","ما","ماذا","عن","في","من","على","الى","إلى","هو","هي","هذا","هذه","الإسلام","اسلام"]);

const SYNONYMS: Record<string, string[]> = {
  alcohol: ["wine","intoxicant","khamr","drinking","خمر","كحول","مسكر"],
  interest: ["riba","usury","loan","ربا","فائده","فائدة"],
  gambling: ["maysir","betting","casino","قمار","ميسر"],
  marriage: ["wife","husband","spouse","nikah","زواج","زوج","زوجة","نكاح"],
  parents: ["mother","father","parent","والدين","والد","ام","أم","اب","أب"],
  modesty: ["hijab","cover","clothing","حجاب","ستر","لباس"],
  anger: ["angry","temper","غضب","غاضب"],
  forgiveness: ["forgive","mercy","توبه","توبة","مغفره","مغفرة","رحمه","رحمة"],
  backbiting: ["gheebah","gossip","غيبه","غيبة","نميمة"],
  honesty: ["truth","lying","lie","صدق","كذب"],
  prayer: ["salah","salat","fajr","dhuhr","asr","maghrib","isha","صلاه","صلاة","فجر","ظهر","عصر","مغرب","عشاء"],
  fasting: ["fast","ramadan","sawm","صيام","صوم","رمضان"],
  charity: ["sadaqah","zakat","donation","صدقه","صدقة","زكاه","زكاة"],
  anxiety: ["worry","fear","stress","قلق","خوف","هم"],
  death: ["dying","grave","funeral","موت","قبر","جنازه","جنازة"]
};

function termsFor(question: string) {
  const words = normalize(question).split(" ").filter((w) => w.length >= 3 && !STOP.has(w));
  const out = new Set(words);
  const q = normalize(question);
  for (const [topic, synonyms] of Object.entries(SYNONYMS)) {
    if (q.includes(topic) || synonyms.some((s) => q.includes(normalize(s)))) {
      out.add(topic);
      synonyms.forEach((s) => out.add(normalize(s)));
    }
  }
  return [...out].filter(Boolean).slice(0, 16);
}

function classify(question: string) {
  const q = normalize(question);
  if (/quran|قران|ayah|verse|surah|سوره|ايه/.test(q)) return "quran";
  if (/hadith|حديث|bukhari|muslim|sunnah|سنه/.test(q)) return "hadith";
  if (/prayer|salah|salat|صلاه|اذان|fajr|dhuhr|asr|maghrib|isha/.test(q)) return "prayer";
  if (/fast|ramadan|صيام|رمضان|صوم/.test(q)) return "fasting";
  if (/marriage|wife|husband|parent|child|family|زواج|زوج|والد|طفل|عائله/.test(q)) return "family";
  if (/prophet|muhammad|يوسف|موسى|عيسى|ابراهيم|نبي|رسول|seerah/.test(q)) return "seerah";
  return "general";
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 24_000) throw new Error("Request body is too large");
  return await request.json() as Record<string, unknown>;
}

async function aiSummary(question: string, locale: Locale, quranRefs: string[], hadith: Array<Record<string, unknown>>, env: Env) {
  if (!env.OPENAI_API_KEY) return "";
  const sources = [
    ...quranRefs.map((r) => `Qur'an ${r}`),
    ...hadith.slice(0, 6).map((h) => `${String(h.source_text || "Hadith source")}: ${String(h.body_en || h.body_ar || "").slice(0, 700)}`)
  ];
  if (!sources.length) return "";
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.15,
        max_tokens: 350,
        messages: [
          { role: "system", content: `You are a careful Islamic research assistant. Answer in ${locale === "ar" ? "Arabic" : "English"}. Use ONLY the supplied Qur'an/Hadith references. Never invent a source or issue a personal fatwa. If sources are insufficient, say so. Keep the answer concise and cite references inline.` },
          { role: "user", content: `Question: ${question}\n\nAvailable sources:\n${sources.join("\n")}` }
        ]
      })
    });
    if (!response.ok) return "";
    const data = await response.json() as any;
    return clean(data?.choices?.[0]?.message?.content, 2500);
  } catch { return ""; }
}

export async function recordAskSheikhQuestion(request: Request, env: Env) {
  const body = await bodyJson(request);
  const question = clean(body.question, 600);
  if (question.length < 3) return json({ error: "Question is required" }, 400);
  const locale: Locale = body.locale === "ar" ? "ar" : "en";
  const normalized = normalize(question);
  if (!normalized) return json({ error: "Question is required" }, 400);
  const category = clean(body.category, 40) || classify(question);
  const quranRefs = Array.isArray(body.quranRefs) ? body.quranRefs.slice(0, 20).map((x) => clean(x, 30)).filter(Boolean) : [];

  const existing = await env.DB.prepare(`SELECT public_id FROM ask_sheikh_questions WHERE normalized_question = ? AND locale = ? LIMIT 1`).bind(normalized, locale).first<{ public_id: string }>();
  const publicId = existing?.public_id || crypto.randomUUID();
  if (existing) {
    await env.DB.prepare(`UPDATE ask_sheikh_questions SET question_text=?, category=?, quran_refs_json=?, asked_count=asked_count+1, last_asked_at=CURRENT_TIMESTAMP WHERE public_id=?`).bind(question, category, JSON.stringify(quranRefs), publicId).run();
  } else {
    await env.DB.prepare(`INSERT INTO ask_sheikh_questions(public_id,question_text,normalized_question,locale,category,quran_refs_json) VALUES (?,?,?,?,?,?)`).bind(publicId, question, normalized, locale, category, JSON.stringify(quranRefs)).run();
  }

  const terms = termsFor(question);
  let hadith: Array<Record<string, unknown>> = [];
  if (terms.length) {
    const where = terms.map(() => `(LOWER(COALESCE(title_en,'')) LIKE ? OR LOWER(COALESCE(body_en,'')) LIKE ? OR LOWER(COALESCE(source_text,'')) LIKE ? OR COALESCE(title_ar,'') LIKE ? OR COALESCE(body_ar,'') LIKE ?)`).join(" OR ");
    const params = terms.flatMap((term) => [`%${term}%`,`%${term}%`,`%${term}%`,`%${term}%`,`%${term}%`]);
    const result = await env.DB.prepare(`SELECT public_id,title_en,title_ar,body_en,body_ar,source_text FROM app_content WHERE content_type='hadith' AND status='published' AND (${where}) ORDER BY featured DESC,updated_at DESC LIMIT 8`).bind(...params).all<Record<string, unknown>>();
    hadith = result.results;
  }

  const answer = await aiSummary(question, locale, quranRefs, hadith, env);
  return json({ ok: true, publicId, category, searchTerms: terms, hadith, answer, aiEnabled: Boolean(env.OPENAI_API_KEY) });
}

export async function listAskSheikhQuestions(url: URL, env: Env) {
  const search = clean(url.searchParams.get("search"), 120);
  const category = clean(url.searchParams.get("category"), 40);
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "en";
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") || 30) || 30));
  const like = `%${normalize(search)}%`;
  const { results } = await env.DB.prepare(`SELECT public_id,question_text,locale,category,quran_refs_json,asked_count,last_asked_at FROM ask_sheikh_questions WHERE locale=? AND (?='' OR category=?) AND (?='' OR normalized_question LIKE ?) ORDER BY asked_count DESC,last_asked_at DESC LIMIT ?`).bind(locale, category, category, search, like, limit).all<Record<string, unknown>>();
  const categories = await env.DB.prepare(`SELECT category,SUM(asked_count) AS question_count,COUNT(*) AS distinct_questions FROM ask_sheikh_questions WHERE locale=? GROUP BY category ORDER BY question_count DESC`).bind(locale).all<Record<string, unknown>>();
  const total = await env.DB.prepare(`SELECT COALESCE(SUM(asked_count),0) AS total,COUNT(*) AS distinct_count FROM ask_sheikh_questions WHERE locale=?`).bind(locale).first<Record<string, number>>();
  return json({ ok:true, questions:results, categories:categories.results, totalAsked:total?.total ?? 0, distinctQuestions:total?.distinct_count ?? 0, grouped:(total?.distinct_count ?? 0) > 10 });
}
