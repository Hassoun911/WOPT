import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { getAyah, getSurah, searchQuran, type QuranAyah, type QuranSurah } from "./quran/quranData";
import { hassounApiUrl, type HassounRuntimeConfig } from "./remoteConfig";

type PopularQuestion = {
  public_id: string;
  question_text: string;
  category: string;
  asked_count: number;
  quran_refs_json?: string | null;
};

type CategorySummary = { category: string; question_count: number; distinct_questions: number };
type HadithMatch = { public_id: string; title_en?: string; title_ar?: string; body_en?: string; body_ar?: string; source_text?: string };
type QuranMatch = { surah: QuranSurah; ayah: QuranAyah; reason?: string };

type Props = {
  locale: "en" | "ar";
  runtime: HassounRuntimeConfig;
  onClose: () => void;
};

const CATEGORY_LABELS: Record<string, { en: string; ar: string; emoji: string }> = {
  quran: { en: "Qur’an", ar: "القرآن", emoji: "📖" },
  hadith: { en: "Hadith", ar: "الحديث", emoji: "📜" },
  prayer: { en: "Prayer", ar: "الصلاة", emoji: "🕌" },
  fasting: { en: "Fasting", ar: "الصيام", emoji: "🌙" },
  family: { en: "Family", ar: "الأسرة", emoji: "🤍" },
  seerah: { en: "Prophets & Seerah", ar: "الأنبياء والسيرة", emoji: "✨" },
  general: { en: "General", ar: "عام", emoji: "💬" }
};

const CONCEPTS: Array<{ terms: string[]; refs: Array<[number, number, string]>; keywords: string[] }> = [
  {
    terms: ["12 moons", "twelve moons", "12 months", "twelve months", "months in quran", "عدد الشهور", "اثنا عشر شهرا", "اثني عشر شهرا"],
    refs: [[9, 36, "The Qur’an states that the number of months ordained by Allah is twelve."]],
    keywords: ["اثنا عشر شهرا", "الشهور"]
  },
  {
    terms: ["joseph dream", "yusuf dream", "stars sun moon", "eleven stars", "يوسف", "احد عشر كوكبا", "الشمس والقمر"],
    refs: [[12, 4, "Yusuf’s dream of eleven stars, the sun and the moon."], [12, 100, "Later in Surah Yusuf, the dream is remembered as fulfilled."]],
    keywords: ["أحد عشر كوكبا", "والشمس والقمر", "رؤياي"]
  },
  {
    terms: ["parents", "mother father", "بر الوالدين", "الوالدين"],
    refs: [[17, 23, "Kindness and humility toward parents."], [31, 14, "Gratitude to Allah and to parents."]],
    keywords: ["بالوالدين إحسانا", "والديه"]
  },
  {
    terms: ["fasting", "ramadan", "صيام", "رمضان"],
    refs: [[2, 183, "Fasting is prescribed for believers."], [2, 185, "Ramadan is the month in which the Qur’an was revealed."]],
    keywords: ["كتب عليكم الصيام", "شهر رمضان"]
  },
  {
    terms: ["prayer", "salah", "salat", "صلاة", "الصلاة"],
    refs: [[29, 45, "Establish prayer and remember Allah."], [4, 103, "Prayer is prescribed at appointed times."]],
    keywords: ["أقم الصلاة", "كتابا موقوتا"]
  },
  {
    terms: ["charity", "sadaqah", "zakat", "صدقة", "زكاة"],
    refs: [[2, 261, "The example of spending in Allah’s way."], [9, 60, "Categories of Zakah recipients."]],
    keywords: ["ينفقون أموالهم", "إنما الصدقات"]
  },
  {
    terms: ["patience", "sabr", "صبر", "الصابرين"],
    refs: [[2, 153, "Seek help through patience and prayer."]],
    keywords: ["استعينوا بالصبر والصلاة", "الصابرين"]
  }
];

function uniqueQuran(items: QuranMatch[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.ayah.surah}:${item.ayah.ayah}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function smartQuranSearch(question: string, limit: number) {
  const q = question.trim().toLocaleLowerCase("en");
  const out: QuranMatch[] = [];
  const exact = q.match(/\b(\d{1,3})\s*[:/]\s*(\d{1,3})\b/);
  if (exact) {
    const surah = Number(exact[1]);
    const ayahNo = Number(exact[2]);
    const ayah = getAyah(surah, ayahNo);
    const info = getSurah(surah);
    if (ayah && info) out.push({ surah: info, ayah, reason: "Exact reference" });
  }

  for (const concept of CONCEPTS) {
    if (!concept.terms.some((term) => q.includes(term.toLocaleLowerCase("en")))) continue;
    for (const [surahNo, ayahNo, reason] of concept.refs) {
      const ayah = getAyah(surahNo, ayahNo);
      const surah = getSurah(surahNo);
      if (ayah && surah) out.push({ surah, ayah, reason });
    }
    for (const keyword of concept.keywords) {
      for (const match of searchQuran(keyword, limit)) if (match.ayah) out.push({ surah: match.surah, ayah: match.ayah, reason: "Related wording" });
    }
  }

  for (const match of searchQuran(question, limit)) if (match.ayah) out.push({ surah: match.surah, ayah: match.ayah, reason: "Text match" });
  return uniqueQuran(out).slice(0, limit);
}

function categoryFor(question: string) {
  const q = question.toLocaleLowerCase("en");
  if (/qur|surah|ayah|verse|قران|قرآن|سورة|ايه|آية|story|قص/.test(q)) return "quran";
  if (/hadith|حديث|bukhari|muslim|sunnah|سنة/.test(q)) return "hadith";
  if (/prayer|salah|salat|fajr|dhuhr|asr|maghrib|isha|صلاة|الصلاة|اذان/.test(q)) return "prayer";
  if (/fast|ramadan|صيام|رمضان|صوم/.test(q)) return "fasting";
  if (/marriage|wife|husband|parent|child|family|زواج|زوج|والد|طفل|اسر|أسرة/.test(q)) return "family";
  if (/prophet|seerah|muhammad|yusuf|musa|isa|ibrahim|نبي|رسول|يوسف|موسى|عيسى|ابراهيم/.test(q)) return "seerah";
  return "general";
}

export default function AskSheikh({ locale, runtime, onClose }: Props) {
  const ar = locale === "ar";
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [quran, setQuran] = useState<QuranMatch[]>([]);
  const [hadith, setHadith] = useState<HadithMatch[]>([]);
  const [popular, setPopular] = useState<PopularQuestion[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [grouped, setGrouped] = useState(false);
  const [popularSearch, setPopularSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [error, setError] = useState("");

  const loadPopular = async (search = popularSearch, category = selectedCategory) => {
    try {
      const params = new URLSearchParams({ locale, limit: "40" });
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      const response = await fetch(`${hassounApiUrl()}/ask-sheikh/questions?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json() as { questions?: PopularQuestion[]; categories?: CategorySummary[]; grouped?: boolean };
      setPopular(data.questions ?? []);
      setCategories(data.categories ?? []);
      setGrouped(Boolean(data.grouped));
    } catch {}
  };

  useEffect(() => { void loadPopular("", ""); }, [locale]);

  const ask = async (value = question) => {
    const clean = value.trim();
    if (!clean) return;
    setQuestion(clean);
    setBusy(true);
    setError("");
    const results = smartQuranSearch(clean, runtime.askSheikhMaxResults);
    setQuran(results);
    setHadith([]);
    try {
      const refs = results.map((item) => `${item.ayah.surah}:${item.ayah.ayah}`);
      const response = await fetch(`${hassounApiUrl()}/ask-sheikh/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: clean, locale, category: categoryFor(clean), quranRefs: refs })
      });
      const data = await response.json() as { hadith?: HadithMatch[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save question");
      setHadith(data.hadith ?? []);
      void loadPopular("", "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect");
    } finally {
      setBusy(false);
    }
  };

  const shareAnswer = async () => {
    const lines = [
      `🕌 Hassoun • ${ar ? "اسأل الشيخ" : "Ask the Sheikh"}`,
      question,
      "",
      ...quran.slice(0, 5).map((item) => `📖 ${item.surah.nameTransliterated} ${item.ayah.surah}:${item.ayah.ayah}\n${item.ayah.text}`),
      ...hadith.slice(0, 3).map((item) => `📜 ${ar ? (item.title_ar || item.title_en) : (item.title_en || item.title_ar)}\n${ar ? (item.body_ar || item.body_en) : (item.body_en || item.body_ar)}${item.source_text ? `\n${item.source_text}` : ""}`),
      "",
      ar ? runtime.askSheikhDisclaimerAr : runtime.askSheikhDisclaimerEn
    ];
    await Share.share({ message: lines.join("\n") });
  };

  const visiblePopular = useMemo(() => popular.slice(0, grouped ? 30 : 10), [popular, grouped]);
  const disclaimer = ar ? runtime.askSheikhDisclaimerAr : runtime.askSheikhDisclaimerEn;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>☾ HASSOUN • {ar ? "بحث إسلامي ذكي" : "SMART ISLAMIC SEARCH"}</Text>
          <Text style={styles.title}>{ar ? "اسأل الشيخ" : "Ask the Sheikh"}</Text>
          <Text style={styles.subtitle}>{ar ? "ابحث عن الموضوع في القرآن والمحتوى الحديثي الموثق." : "Find the topic in the Qur’an and verified Hadith content."}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.searchCard}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder={ar ? "مثال: أين ذُكر عدد الشهور الاثني عشر؟" : "Example: Where does the Qur’an mention the twelve months?"}
            placeholderTextColor="#8a9893"
            multiline
            textAlign={ar ? "right" : "left"}
            style={styles.questionInput}
          />
          <Pressable onPress={() => void ask()} disabled={busy || !question.trim()} style={[styles.askButton, (busy || !question.trim()) && styles.disabled]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.askButtonText}>✨ {ar ? "ابحث في المصادر" : "Search the sources"}</Text>}
          </Pressable>
        </View>

        <View style={styles.notice}><Text style={styles.noticeText}>ℹ️ {disclaimer}</Text></View>
        {error ? <Text style={styles.error}>⚠️ {error}</Text> : null}

        {quran.length || hadith.length ? (
          <View style={styles.answerArea}>
            <View style={styles.answerHeader}>
              <Text style={styles.sectionTitle}>📖 {ar ? "ما وجدناه في المصادر" : "What the sources show"}</Text>
              {runtime.askSheikhShareEnabled ? <Pressable onPress={() => void shareAnswer()} style={styles.share}><Text style={styles.shareText}>↗ {ar ? "مشاركة" : "Share"}</Text></Pressable> : null}
            </View>
            {quran.map((item) => (
              <View key={`${item.ayah.surah}:${item.ayah.ayah}`} style={styles.quranCard}>
                <Text style={styles.sourceTag}>QUR’AN • {item.surah.nameTransliterated} {item.ayah.surah}:{item.ayah.ayah}</Text>
                <Text style={styles.arabicVerse}>{item.ayah.text}</Text>
                {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}
              </View>
            ))}
            {hadith.length ? <Text style={styles.sectionTitle}>📜 {ar ? "أحاديث موثقة ذات صلة" : "Related verified Hadith"}</Text> : null}
            {hadith.map((item) => (
              <View key={item.public_id} style={styles.hadithCard}>
                <Text style={styles.hadithTitle}>{ar ? (item.title_ar || item.title_en) : (item.title_en || item.title_ar)}</Text>
                <Text style={[styles.hadithBody, ar && { textAlign: "right" }]}>{ar ? (item.body_ar || item.body_en) : (item.body_en || item.body_ar)}</Text>
                {item.source_text ? <Text style={styles.hadithSource}>✓ {item.source_text}</Text> : null}
              </View>
            ))}
            {!quran.length && !hadith.length ? <Text style={styles.empty}>{ar ? "لم نجد تطابقاً موثقاً. جرّب كلمات أخرى أو مرجع سورة:آية." : "No verified match was found. Try different wording or a Surah:Ayah reference."}</Text> : null}
          </View>
        ) : null}

        <View style={styles.communityCard}>
          <Text style={styles.sectionTitle}>🔥 {ar ? "الأسئلة الأكثر شيوعاً فعلياً" : "Questions people actually ask"}</Text>
          <Text style={styles.communityHint}>{ar ? "هذه القائمة مبنية على أسئلة المستخدمين الحقيقية، وليست أسئلة تجريبية." : "This list is built from real user questions, not seeded examples."}</Text>
          <TextInput value={popularSearch} onChangeText={setPopularSearch} onSubmitEditing={() => void loadPopular(popularSearch, selectedCategory)} placeholder={ar ? "ابحث في الأسئلة السابقة" : "Search previous questions"} placeholderTextColor="#8a9893" style={styles.popularSearch}/>
          {grouped && categories.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              <Pressable onPress={() => { setSelectedCategory(""); void loadPopular(popularSearch, ""); }} style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}><Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>{ar ? "الكل" : "All"}</Text></Pressable>
              {categories.map((cat) => { const info = CATEGORY_LABELS[cat.category] || CATEGORY_LABELS.general; const active = selectedCategory === cat.category; return <Pressable key={cat.category} onPress={() => { setSelectedCategory(cat.category); void loadPopular(popularSearch, cat.category); }} style={[styles.categoryChip, active && styles.categoryChipActive]}><Text style={[styles.categoryText, active && styles.categoryTextActive]}>{info.emoji} {info[locale]} ({cat.question_count})</Text></Pressable>; })}
            </ScrollView>
          ) : null}
          {visiblePopular.length ? visiblePopular.map((item, index) => (
            <Pressable key={item.public_id} onPress={() => void ask(item.question_text)} style={styles.popularRow}>
              <View style={styles.rank}><Text style={styles.rankText}>{index + 1}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.popularQuestion}>{item.question_text}</Text><Text style={styles.popularMeta}>{CATEGORY_LABELS[item.category]?.emoji || "💬"} {ar ? `سُئل ${item.asked_count} مرة` : `Asked ${item.asked_count} ${item.asked_count === 1 ? "time" : "times"}`}</Text></View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          )) : <Text style={styles.empty}>{ar ? "ستظهر الأسئلة هنا تلقائياً بعد أن يبدأ الناس باستخدام الميزة." : "Questions will appear here automatically as people use the feature."}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f0e6" },
  header: { flexDirection: "row", gap: 14, alignItems: "flex-start", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, backgroundColor: "#073f34", borderBottomWidth: 1, borderBottomColor: "#c9aa59" },
  eyebrow: { color: "#dfc36c", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#fffdf7", fontSize: 27, fontWeight: "900", marginTop: 4 },
  subtitle: { color: "#cfe1db", fontSize: 12, lineHeight: 18, marginTop: 5 },
  close: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#fffdf7", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#173f35", fontSize: 17, fontWeight: "900" },
  content: { padding: 14, paddingBottom: 42, gap: 13 },
  searchCard: { backgroundColor: "#fffdf8", borderRadius: 20, padding: 13, borderWidth: 1, borderColor: "#ded5c4" },
  questionInput: { minHeight: 84, color: "#173f35", fontSize: 15, lineHeight: 22, paddingHorizontal: 4, paddingVertical: 4 },
  askButton: { minHeight: 50, borderRadius: 14, backgroundColor: "#08735a", alignItems: "center", justifyContent: "center", marginTop: 10 },
  askButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  notice: { backgroundColor: "#eaf5f1", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#bedbd1" },
  noticeText: { color: "#506c63", fontSize: 10, lineHeight: 16 },
  error: { color: "#a53a2f", fontSize: 12, fontWeight: "800" },
  answerArea: { gap: 10 },
  answerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { color: "#173f35", fontSize: 16, fontWeight: "900" },
  share: { backgroundColor: "#173f35", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  shareText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  quranCard: { backgroundColor: "#eef8f4", borderRadius: 18, padding: 15, borderWidth: 1, borderColor: "#a9d5c5" },
  sourceTag: { color: "#08735a", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  arabicVerse: { color: "#173f35", fontSize: 22, lineHeight: 38, textAlign: "right", marginTop: 10 },
  reason: { color: "#687a74", fontSize: 10, lineHeight: 16, marginTop: 9 },
  hadithCard: { backgroundColor: "#fff8e9", borderRadius: 18, padding: 15, borderWidth: 1, borderColor: "#e3c978" },
  hadithTitle: { color: "#8b5b10", fontSize: 13, fontWeight: "900" },
  hadithBody: { color: "#3e544d", fontSize: 13, lineHeight: 21, marginTop: 7 },
  hadithSource: { color: "#a36c15", fontSize: 10, fontWeight: "800", marginTop: 8 },
  communityCard: { backgroundColor: "#fffdf8", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#ded5c4", gap: 10 },
  communityHint: { color: "#72817c", fontSize: 10, lineHeight: 16 },
  popularSearch: { backgroundColor: "#f4f1e9", borderRadius: 13, minHeight: 44, paddingHorizontal: 12, color: "#173f35", borderWidth: 1, borderColor: "#e0d8c9" },
  categoryRow: { gap: 7, paddingVertical: 2 },
  categoryChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: "#f3eee3", borderWidth: 1, borderColor: "#ded3bd" },
  categoryChipActive: { backgroundColor: "#08735a", borderColor: "#08735a" },
  categoryText: { color: "#5f6d68", fontSize: 10, fontWeight: "800" },
  categoryTextActive: { color: "#fff" },
  popularRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#ece6da" },
  rank: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#e8f4ef", alignItems: "center", justifyContent: "center" },
  rankText: { color: "#08735a", fontSize: 11, fontWeight: "900" },
  popularQuestion: { color: "#254d43", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  popularMeta: { color: "#8a9691", fontSize: 9, marginTop: 4 },
  arrow: { color: "#b5903f", fontSize: 25, fontWeight: "700" },
  empty: { color: "#83908b", fontSize: 11, lineHeight: 17, textAlign: "center", paddingVertical: 12 }
});