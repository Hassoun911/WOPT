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
  dogs: ["dog","dogs","puppy","canine","كلب","كلاب","جرو"],
  cats: ["cat","cats","kitten","قط","قطط","هرة"],
  animals: ["animal","animals","pet","pets","حيوان","حيوانات","الرفق بالحيوان"],
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
  intention: ["intentions","niyyah","نية","نيات"],
  prayer: ["salah","salat","fajr","dhuhr","asr","maghrib","isha","صلاه","صلاة","فجر","ظهر","عصر","مغرب","عشاء"],
  fasting: ["fast","ramadan","sawm","صيام","صوم","رمضان"],
  charity: ["sadaqah","zakat","donation","صدقه","صدقة","زكاه","زكاة"],
  anxiety: ["worry","fear","stress","قلق","خوف","هم"],
  death: ["dying","grave","funeral","موت","قبر","جنازه","جنازة"]
};

type HadithRecord = Record<string, unknown> & {
  public_id: string;
  title_en?: string;
  title_ar?: string;
  body_en?: string;
  body_ar?: string;
  source_text?: string;
  source_url?: string;
};

type CuratedHadith = HadithRecord & { terms: string[] };

const CURATED_HADITH: CuratedHadith[] = [
  {
    public_id: "curated-bukhari-2363",
    terms: ["dog","dogs","puppy","animals","animal","pets","mercy","kindness","كلب","كلاب","حيوان","رحمة"],
    title_en: "Kindness to a thirsty dog",
    title_ar: "الرحمة بكلب عطشان",
    body_en: "The Prophet ﷺ taught that a man was forgiven after giving water to a desperately thirsty dog, and that there is reward in showing kindness to living creatures.",
    body_ar: "علّم النبي ﷺ أن رجلاً غُفر له بعدما سقى كلباً شديد العطش، وأن في الإحسان إلى الكائنات الحية أجراً.",
    source_text: "Sahih al-Bukhari 2363",
    source_url: "https://sunnah.com/bukhari:2363"
  },
  {
    public_id: "curated-muslim-279c",
    terms: ["dog","dogs","lick","bowl","vessel","clean","purity","كلب","كلاب","ولغ","إناء","طهارة"],
    title_en: "Cleaning a vessel licked by a dog",
    title_ar: "تطهير الإناء إذا ولغ فيه الكلب",
    body_en: "A hadith in Sahih Muslim instructs washing a vessel seven times after a dog drinks from it.",
    body_ar: "ورد في صحيح مسلم الأمر بغسل الإناء سبع مرات إذا شرب منه الكلب.",
    source_text: "Sahih Muslim 279c",
    source_url: "https://sunnah.com/muslim:279c"
  },
  {
    public_id: "curated-muslim-2106a",
    terms: ["dog","dogs","house","home","angels","كلب","كلاب","بيت","ملائكة"],
    title_en: "Dogs in the home and angels",
    title_ar: "الكلب في البيت ودخول الملائكة",
    body_en: "Sahih Muslim records the teaching that angels do not enter a house in which there is a dog or an image. Scholars discuss exceptions and details when applying this hadith.",
    body_ar: "ورد في صحيح مسلم أن الملائكة لا تدخل بيتاً فيه كلب أو صورة، وللفقهاء تفصيل في تطبيق الحديث والاستثناءات.",
    source_text: "Sahih Muslim 2106a",
    source_url: "https://sunnah.com/muslim:2106a"
  },
  {
    public_id: "curated-bukhari-1",
    terms: ["intention","intentions","niyyah","نية","نيات","deeds","actions"],
    title_en: "Actions are judged by intentions",
    title_ar: "الأعمال بالنيات",
    body_en: "The Prophet ﷺ taught that actions are judged according to intentions and each person receives according to what they intended.",
    body_ar: "علّم النبي ﷺ أن الأعمال بالنيات وأن لكل امرئ ما نوى.",
    source_text: "Sahih al-Bukhari 1",
    source_url: "https://sunnah.com/bukhari:1"
  },
  {
    public_id: "curated-bukhari-6116",
    terms: ["anger","angry","temper","غضب","غاضب"],
    title_en: "Do not give in to anger",
    title_ar: "الوصية بترك الغضب",
    body_en: "When a man repeatedly asked for advice, the Prophet ﷺ repeatedly told him not to give in to anger.",
    body_ar: "لما طلب رجل من النبي ﷺ الوصية كرر له: لا تغضب.",
    source_text: "Sahih al-Bukhari 6116",
    source_url: "https://sunnah.com/bukhari:6116"
  },
  {
    public_id: "curated-muslim-2588",
    terms: ["backbiting","gheebah","gossip","غيبة","نميمة"],
    title_en: "What backbiting means",
    title_ar: "معنى الغيبة",
    body_en: "The Prophet ﷺ explained backbiting as mentioning about another person something they would dislike, even when the statement is true.",
    body_ar: "بيّن النبي ﷺ أن الغيبة هي أن تذكر أخاك بما يكره، ولو كان ما تقول فيه صحيحاً.",
    source_text: "Sahih Muslim 2589",
    source_url: "https://sunnah.com/muslim:2589"
  },
  {
    public_id: "curated-bukhari-5971",
    terms: ["parents","mother","father","parent","والدين","أم","ام","أب","اب"],
    title_en: "Good treatment of parents",
    title_ar: "حسن صحبة الوالدين",
    body_en: "The Prophet ﷺ emphasized excellent companionship with one’s mother, repeating her priority three times before mentioning the father.",
    body_ar: "أكد النبي ﷺ حسن صحبة الأم وكرر حقها ثلاث مرات قبل ذكر الأب.",
    source_text: "Sahih al-Bukhari 5971",
    source_url: "https://sunnah.com/bukhari:5971"
  },
  {
    public_id: "curated-muslim-2699",
    terms: ["knowledge","learn","study","علم","تعلم","دراسة"],
    title_en: "Seeking knowledge",
    title_ar: "طلب العلم",
    body_en: "Sahih Muslim records that whoever follows a path seeking knowledge, Allah makes a path to Paradise easier for them.",
    body_ar: "ورد في صحيح مسلم أن من سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة.",
    source_text: "Sahih Muslim 2699",
    source_url: "https://sunnah.com/muslim:2699"
  }
];

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
  return [...out].filter(Boolean).slice(0, 24);
}

function curatedMatches(terms: string[], limit = 8): HadithRecord[] {
  const wanted = new Set(terms.map(normalize));
  return CURATED_HADITH.map((h) => ({
    h,
    score: h.terms.reduce((score, term) => score + (wanted.has(normalize(term)) ? 1 : 0), 0)
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ h }) => {
      const { terms: _terms, ...record } = h;
      return record;
    });
}

function classify(question: string) {
  const q = normalize(question);
  if (/quran|قران|ayah|verse|surah|سوره|ايه/.test(q)) return "quran";
  if (/hadith|حديث|bukhari|muslim|sunnah|سنه/.test(q)) return "hadith";
  if (/dog|dogs|cat|cats|animal|pet|كلب|كلاب|قط|حيوان/.test(q)) return "animals";
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

function sourceSummary(locale: Locale, quranRefs: string[], hadith: HadithRecord[]) {
  if (!quranRefs.length && !hadith.length) return "";
  if (locale === "ar") {
    const parts: string[] = [];
    if (quranRefs.length) parts.push(`وجدت آيات قرآنية مرتبطة بالسؤال: ${quranRefs.slice(0, 4).join("، ")}.`);
    if (hadith.length) parts.push(`ووجدت ${hadith.length} من الأحاديث ذات الصلة، منها ${hadith.slice(0, 3).map((h) => h.source_text).filter(Boolean).join("، ")}. افتح المراجع أدناه لقراءة التفاصيل.`);
    return parts.join(" ");
  }
  const parts: string[] = [];
  if (quranRefs.length) parts.push(`I found related Qur’an references: ${quranRefs.slice(0, 4).join(", ")}.`);
  if (hadith.length) parts.push(`I also found ${hadith.length} relevant hadith source${hadith.length === 1 ? "" : "s"}, including ${hadith.slice(0, 3).map((h) => h.source_text).filter(Boolean).join(", ")}. Open the references below for the source details.`);
  return parts.join(" ");
}

async function aiSummary(question: string, locale: Locale, quranRefs: string[], hadith: HadithRecord[], env: Env) {
  if (!env.OPENAI_API_KEY) return sourceSummary(locale, quranRefs, hadith);
  const sources = [
    ...quranRefs.map((r) => `Qur'an ${r}`),
    ...hadith.slice(0, 8).map((h) => `${String(h.source_text || "Hadith source")}: ${String(h.body_en || h.body_ar || "").slice(0, 700)}`)
  ];
  if (!sources.length) return "";
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 450,
        messages: [
          { role: "system", content: `You are Hassoun's careful Islamic research assistant. Answer in ${locale === "ar" ? "Arabic" : "English"}. Use ONLY the supplied Qur'an/Hadith references. Explain what the sources say and distinguish source text from scholarly application. Never invent a source and never pretend to issue a personal fatwa. Cite references inline.` },
          { role: "user", content: `Question: ${question}\n\nVerified sources:\n${sources.join("\n")}` }
        ]
      })
    });
    if (!response.ok) return sourceSummary(locale, quranRefs, hadith);
    const data = await response.json() as any;
    return clean(data?.choices?.[0]?.message?.content, 3000) || sourceSummary(locale, quranRefs, hadith);
  } catch { return sourceSummary(locale, quranRefs, hadith); }
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
  let hadith: HadithRecord[] = [];
  if (terms.length) {
    const where = terms.map(() => `(LOWER(COALESCE(title_en,'')) LIKE ? OR LOWER(COALESCE(body_en,'')) LIKE ? OR LOWER(COALESCE(source_text,'')) LIKE ? OR COALESCE(title_ar,'') LIKE ? OR COALESCE(body_ar,'') LIKE ?)`).join(" OR ");
    const params = terms.flatMap((term) => [`%${term}%`,`%${term}%`,`%${term}%`,`%${term}%`,`%${term}%`]);
    const result = await env.DB.prepare(`SELECT public_id,title_en,title_ar,body_en,body_ar,source_text FROM app_content WHERE content_type='hadith' AND status='published' AND (${where}) ORDER BY featured DESC,updated_at DESC LIMIT 8`).bind(...params).all<HadithRecord>();
    hadith = result.results;
  }

  const fallback = curatedMatches(terms, 8);
  const seen = new Set(hadith.map((h) => String(h.source_text || h.public_id)));
  for (const item of fallback) {
    const key = String(item.source_text || item.public_id);
    if (!seen.has(key)) { hadith.push(item); seen.add(key); }
  }
  hadith = hadith.slice(0, 8);

  const answer = await aiSummary(question, locale, quranRefs, hadith, env);
  return json({ ok: true, publicId, category, searchTerms: terms, hadith, answer, aiEnabled: Boolean(env.OPENAI_API_KEY), verifiedFallbackEnabled: true });
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
