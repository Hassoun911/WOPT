import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { getAyah, getSurah, searchQuran, type QuranAyah, type QuranSurah } from "./quran/quranData";
import { hassounApiUrl, type HassounRuntimeConfig } from "./remoteConfig";

type HadithMatch = { public_id: string; title_en?: string; title_ar?: string; body_en?: string; body_ar?: string; source_text?: string };
type QuranMatch = { surah: QuranSurah; ayah: QuranAyah; reason?: string };
type Props = { locale: "en" | "ar"; runtime: HassounRuntimeConfig; onClose: () => void };

const CONCEPTS: Array<{ terms: string[]; refs: Array<[number, number, string]>; keywords: string[] }> = [
  { terms: ["parents","mother","father","والدين","والد","أم","اب"], refs: [[17,23,"Kindness to parents"],[31,14,"Gratitude to Allah and parents"]], keywords:["بالوالدين إحسانا"] },
  { terms: ["fasting","ramadan","صيام","رمضان"], refs: [[2,183,"Fasting is prescribed"],[2,185,"Ramadan and the Qur’an"]], keywords:["كتب عليكم الصيام"] },
  { terms: ["prayer","salah","salat","صلاة","اذان"], refs: [[29,45,"Prayer restrains from wrongdoing"],[4,103,"Prayer at appointed times"]], keywords:["أقم الصلاة"] },
  { terms: ["charity","sadaqah","zakat","صدقة","زكاة"], refs: [[2,261,"Reward for spending in Allah’s way"],[9,60,"Recipients of zakah"]], keywords:["إنما الصدقات"] },
  { terms: ["patience","sabr","صبر"], refs: [[2,153,"Seek help through patience and prayer"]], keywords:["استعينوا بالصبر والصلاة"] },
  { terms: ["alcohol","wine","khamr","خمر","كحول","مسكر"], refs: [[5,90,"Intoxicants are prohibited"],[2,219,"Harm in intoxicants and gambling"]], keywords:["الخمر والميسر"] },
  { terms: ["gambling","casino","betting","قمار","ميسر"], refs: [[5,90,"Gambling is prohibited"],[2,219,"Harm in gambling"]], keywords:["الخمر والميسر"] },
  { terms: ["interest","riba","usury","ربا","فائدة"], refs: [[2,275,"Riba is forbidden"],[2,278,"Leave what remains of riba"]], keywords:["حرم الربا"] },
  { terms: ["backbiting","gheebah","gossip","غيبة","نميمة"], refs: [[49,12,"Do not backbite one another"]], keywords:["ولا يغتب"] },
  { terms: ["modesty","hijab","cover","حجاب","ستر","لباس"], refs: [[24,30,"Lower the gaze and guard chastity"],[24,31,"Modesty guidance for believing women"]], keywords:["وليضربن بخمرهن"] },
  { terms: ["marriage","wife","husband","spouse","زواج","زوج","نكاح"], refs: [[30,21,"Tranquility, affection and mercy in marriage"],[4,19,"Live with spouses in kindness"]], keywords:["مودة ورحمة"] },
  { terms: ["anxiety","worry","stress","قلق","خوف","هم"], refs: [[13,28,"Hearts find rest in remembrance of Allah"],[2,286,"Allah does not burden a soul beyond its capacity"]], keywords:["تطمئن القلوب"] },
  { terms: ["forgive","forgiveness","mercy","توبة","مغفرة","رحمة"], refs: [[39,53,"Do not despair of Allah’s mercy"],[3,134,"Those who pardon people"]], keywords:["لا تقنطوا من رحمة الله"] }
];

function unique(items: QuranMatch[]) {
  const seen = new Set<string>();
  return items.filter((x) => { const k = `${x.ayah.surah}:${x.ayah.ayah}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function smartQuranSearch(question: string, limit: number) {
  const q = question.toLocaleLowerCase("en");
  const out: QuranMatch[] = [];
  const exact = q.match(/\b(\d{1,3})\s*[:/]\s*(\d{1,3})\b/);
  if (exact) {
    const ayah = getAyah(Number(exact[1]), Number(exact[2]));
    const surah = getSurah(Number(exact[1]));
    if (ayah && surah) out.push({ surah, ayah, reason: "Exact reference" });
  }
  for (const c of CONCEPTS) {
    if (!c.terms.some((t) => q.includes(t.toLocaleLowerCase("en")))) continue;
    for (const [s,a,reason] of c.refs) { const ayah=getAyah(s,a); const surah=getSurah(s); if (ayah&&surah) out.push({surah,ayah,reason}); }
    for (const keyword of c.keywords) for (const m of searchQuran(keyword, 4)) if (m.ayah) out.push({ surah:m.surah, ayah:m.ayah, reason:"Related wording" });
  }
  for (const word of q.replace(/what does islam say about|what does islam say|islamic ruling on|tell me about/gi, " ").split(/\s+/).filter((x)=>x.length>4).slice(0,4)) {
    for (const m of searchQuran(word, 3)) if (m.ayah) out.push({ surah:m.surah, ayah:m.ayah, reason:"Topic match" });
  }
  return unique(out).slice(0, Math.max(4, limit));
}

export default function AskSheikh({ locale, runtime, onClose }: Props) {
  const ar = locale === "ar";
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [quran, setQuran] = useState<QuranMatch[]>([]);
  const [hadith, setHadith] = useState<HadithMatch[]>([]);
  const [answer, setAnswer] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState("");
  const [openVerse, setOpenVerse] = useState<QuranMatch | null>(null);
  const disclaimer = ar ? runtime.askSheikhDisclaimerAr : runtime.askSheikhDisclaimerEn;

  const ask = async () => {
    const clean = question.trim();
    if (!clean) return;
    setBusy(true); setError(""); setAnswer(""); setOpenVerse(null);
    const quranResults = smartQuranSearch(clean, runtime.askSheikhMaxResults);
    setQuran(quranResults); setHadith([]);
    try {
      const response = await fetch(`${hassounApiUrl()}/ask-sheikh/questions`, {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ question: clean, locale, quranRefs: quranResults.map((x)=>`${x.ayah.surah}:${x.ayah.ayah}`) })
      });
      const data = await response.json() as { hadith?:HadithMatch[]; answer?:string; aiEnabled?:boolean; error?:string };
      if (!response.ok) throw new Error(data.error || "Search failed");
      setHadith(data.hadith ?? []); setAnswer(data.answer ?? ""); setAiEnabled(Boolean(data.aiEnabled));
      if (!quranResults.length && !(data.hadith?.length)) setError(ar ? "لم نجد مرجعاً موثوقاً كافياً لهذا السؤال بعد." : "I could not find enough verified source material for that question yet.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to connect"); }
    finally { setBusy(false); }
  };

  const share = async () => {
    const lines = [`Hassoun • ${ar ? "اسأل الشيخ" : "Ask the Sheikh"}`, question, answer,
      ...quran.map((x)=>`Qur’an ${x.ayah.surah}:${x.ayah.ayah} — ${x.surah.nameTransliterated}`),
      ...hadith.map((x)=>`${x.source_text || "Hadith"}`), disclaimer];
    await Share.share({ message: lines.filter(Boolean).join("\n\n") });
  };

  const resultCount = useMemo(() => quran.length + hadith.length, [quran, hadith]);

  return <View style={styles.page}>
    <View style={styles.header}><View style={{flex:1}}><Text style={styles.eyebrow}>HASSOUN • {ar ? "بحث إسلامي ذكي" : "SMART ISLAMIC SEARCH"}</Text><Text style={styles.title}>{ar ? "اسأل الشيخ" : "Ask the Sheikh"}</Text><Text style={styles.subtitle}>{ar ? "اسأل بطريقتك: ماذا يقول الإسلام عن...؟ وسنبحث في القرآن والحديث الموثق." : "Ask naturally: “What does Islam say about…?” Hassoun searches the Qur’an and verified Hadith sources."}</Text></View><Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.searchCard}><TextInput value={question} onChangeText={setQuestion} multiline textAlign={ar?"right":"left"} placeholder={ar?"مثال: ماذا يقول الإسلام عن الربا؟":"Example: What does Islam say about interest (riba)?"} placeholderTextColor="#8a9893" style={styles.input}/><Pressable onPress={()=>void ask()} disabled={busy||!question.trim()} style={[styles.askButton,(busy||!question.trim())&&styles.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<Text style={styles.askText}>✨ {ar?"اسأل Hassoun":"Ask Hassoun"}</Text>}</Pressable></View>
      <View style={styles.notice}><Text style={styles.noticeText}>ℹ️ {disclaimer}</Text></View>
      {error?<Text style={styles.error}>⚠️ {error}</Text>:null}

      {answer?<View style={styles.answerCard}><Text style={styles.answerLabel}>{aiEnabled?(ar?"ملخص ذكي من المصادر":"AI SOURCE SUMMARY"):(ar?"ملخص المصادر":"SOURCE SUMMARY")}</Text><Text style={styles.answerText}>{answer}</Text></View>:null}

      {resultCount>0?<View style={styles.resultsHeader}><Text style={styles.sectionTitle}>{ar?"المراجع":"References"} • {resultCount}</Text><Pressable onPress={()=>void share()} style={styles.share}><Text style={styles.shareText}>↗ {ar?"مشاركة":"Share"}</Text></Pressable></View>:null}

      {quran.map((item)=><Pressable key={`${item.ayah.surah}:${item.ayah.ayah}`} onPress={()=>setOpenVerse(item)} style={styles.quranCard}><Text style={styles.sourceTag}>QUR’AN • {item.surah.nameTransliterated} {item.ayah.surah}:{item.ayah.ayah}</Text><Text style={styles.arabic}>{item.ayah.text}</Text>{item.reason?<Text style={styles.reason}>{item.reason}</Text>:null}<Text style={styles.openLink}>{ar?"افتح الآية داخل Hassoun ←":"Open this verse inside Hassoun →"}</Text></Pressable>)}

      {openVerse?<View style={styles.inlineReader}><View style={styles.inlineTop}><Text style={styles.inlineTitle}>📖 {openVerse.surah.nameTransliterated} • {openVerse.ayah.surah}:{openVerse.ayah.ayah}</Text><Pressable onPress={()=>setOpenVerse(null)}><Text style={styles.inlineClose}>✕</Text></Pressable></View><Text style={styles.inlineArabic}>{openVerse.ayah.text}</Text><Text style={styles.inlineMeta}>{openVerse.surah.nameEnglish} • {openVerse.surah.revelationType}</Text><Text style={styles.inlineHint}>{ar?"بقي مربع البحث والنتائج مفتوحين في نفس الصفحة.":"Your search and results stay open on this same page."}</Text></View>:null}

      {hadith.length?<Text style={styles.hadithHeading}>📜 {ar?"أحاديث ذات صلة":"Related Hadith"}</Text>:null}
      {hadith.map((item)=><View key={item.public_id} style={styles.hadithCard}><Text style={styles.hadithTitle}>{ar?(item.title_ar||item.title_en||"حديث"):(item.title_en||item.title_ar||"Hadith")}</Text><Text style={styles.hadithBody}>{ar?(item.body_ar||item.body_en):(item.body_en||item.body_ar)}</Text>{item.source_text?<View style={styles.referencePill}><Text style={styles.referenceText}>✓ {item.source_text}</Text></View>:<Text style={styles.noRef}>{ar?"لا يُعرض الحديث كمرجع حتى تتوفر بيانات المصدر.":"A hadith is not treated as a reference until its source information is available."}</Text>}</View>)}

      <View style={styles.footer}><Text style={styles.footerText}>{ar?"Hassoun أداة بحث وليست بديلاً عن فتوى من عالم مؤهل، خصوصاً في المسائل الشخصية أو المعقدة.":"Hassoun is a research tool, not a replacement for a qualified scholar’s fatwa, especially for personal or complex rulings."}</Text></View>
    </ScrollView>
  </View>;
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:"#f7f4ec"}, header:{paddingHorizontal:18,paddingTop:14,paddingBottom:11,flexDirection:"row",gap:12,borderBottomWidth:1,borderBottomColor:"#e5e0d5"}, eyebrow:{color:"#a17c35",fontSize:8,fontWeight:"900",letterSpacing:1.2}, title:{color:"#173f35",fontSize:28,fontWeight:"900",marginTop:3}, subtitle:{color:"#6f7e78",fontSize:11,lineHeight:16,marginTop:4}, close:{width:40,height:40,borderRadius:14,backgroundColor:"#fff",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#ddd8cd"},closeText:{color:"#173f35",fontSize:17,fontWeight:"900"},
  content:{padding:16,paddingBottom:30},searchCard:{backgroundColor:"#fff",borderRadius:22,padding:12,borderWidth:1,borderColor:"#dfddd5"},input:{minHeight:72,color:"#173f35",fontSize:14,lineHeight:20,textAlignVertical:"top"},askButton:{marginTop:9,minHeight:48,borderRadius:16,backgroundColor:"#075b47",alignItems:"center",justifyContent:"center"},disabled:{opacity:.45},askText:{color:"#fff",fontSize:13,fontWeight:"900"},notice:{marginTop:10,borderRadius:15,backgroundColor:"#eee9dc",padding:10},noticeText:{color:"#6f786f",fontSize:9,lineHeight:14},error:{color:"#9b4335",fontSize:10,fontWeight:"800",marginTop:10},
  answerCard:{marginTop:12,borderRadius:20,backgroundColor:"#e9f3ee",borderWidth:1,borderColor:"#c8ded4",padding:14},answerLabel:{color:"#a17c35",fontSize:7.5,fontWeight:"900",letterSpacing:1},answerText:{color:"#23483e",fontSize:12.5,lineHeight:19,fontWeight:"700",marginTop:5},resultsHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:17,marginBottom:8},sectionTitle:{color:"#173f35",fontSize:17,fontWeight:"900"},share:{paddingHorizontal:10,paddingVertical:6,borderRadius:12,backgroundColor:"#e8f2ed"},shareText:{color:"#075b47",fontSize:9,fontWeight:"900"},
  quranCard:{backgroundColor:"#075b47",borderRadius:20,padding:14,marginBottom:9},sourceTag:{color:"#e7c875",fontSize:7.5,fontWeight:"900",letterSpacing:.8},arabic:{color:"#fff",fontSize:20,lineHeight:34,textAlign:"right",marginTop:8},reason:{color:"#c9ddd5",fontSize:9,lineHeight:14,marginTop:7},openLink:{color:"#f4d987",fontSize:9,fontWeight:"900",marginTop:9},
  inlineReader:{borderRadius:20,backgroundColor:"#fffaf0",borderWidth:1,borderColor:"#d9bf78",padding:14,marginBottom:12},inlineTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},inlineTitle:{color:"#173f35",fontSize:12,fontWeight:"900"},inlineClose:{color:"#8b6b2c",fontSize:14,fontWeight:"900"},inlineArabic:{color:"#153f35",fontSize:23,lineHeight:38,textAlign:"right",marginTop:12},inlineMeta:{color:"#718078",fontSize:9,fontWeight:"700",marginTop:8},inlineHint:{color:"#9b7a39",fontSize:8.5,fontWeight:"800",marginTop:8},
  hadithHeading:{color:"#173f35",fontSize:17,fontWeight:"900",marginTop:8,marginBottom:8},hadithCard:{backgroundColor:"#fff",borderRadius:20,padding:14,borderWidth:1,borderColor:"#dfddd5",marginBottom:9},hadithTitle:{color:"#173f35",fontSize:13,fontWeight:"900"},hadithBody:{color:"#4e625b",fontSize:11,lineHeight:18,marginTop:6},referencePill:{alignSelf:"flex-start",backgroundColor:"#e7f2ec",borderRadius:99,paddingHorizontal:9,paddingVertical:5,marginTop:9},referenceText:{color:"#075b47",fontSize:8.5,fontWeight:"900"},noRef:{color:"#9c7761",fontSize:8.5,lineHeight:13,marginTop:8},footer:{marginTop:12,borderRadius:17,backgroundColor:"#eee9dc",padding:12},footerText:{color:"#78817b",fontSize:8.5,lineHeight:13,textAlign:"center"}
});
