import fs from 'node:fs';

const mobilePath = 'mobile/src/AskSheikh.tsx';
const backendPath = 'push-server/src/askSheikh.ts';

let mobile = fs.readFileSync(mobilePath, 'utf8');
let backend = fs.readFileSync(backendPath, 'utf8');

function mustReplace(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected ${label}`);
  return text.replace(from, to);
}

// 1) Let hadith cards open the authoritative source URL.
mobile = mustReplace(
  mobile,
  'import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";',
  'import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";',
  'React Native import'
);

mobile = mustReplace(
  mobile,
  'type HadithMatch = { public_id: string; title_en?: string; title_ar?: string; body_en?: string; body_ar?: string; source_text?: string };',
  'type HadithMatch = { public_id: string; title_en?: string; title_ar?: string; body_en?: string; body_ar?: string; source_text?: string; source_url?: string };',
  'HadithMatch type'
);

// 2) Dogs must map to Quran verses that actually mention dogs / trained hunting animals.
const conceptsAnchor = 'const CONCEPTS: Array<{ terms: string[]; refs: Array<[number, number, string]>; keywords: string[] }> = [\n';
const dogsConcept = '  { terms: ["dog","dogs","puppy","canine","كلب","كلاب","الكلب","الكلاب"], refs: [[5,4,"Trained hunting animals"],[18,18,"The Companions of the Cave and their dog"],[18,22,"The dog of the Companions of the Cave"]], keywords:["كلبهم","بالوصيد"] },\n';
if (!mobile.includes(dogsConcept)) mobile = mustReplace(mobile, conceptsAnchor, conceptsAnchor + dogsConcept, 'CONCEPTS anchor');

mobile = mustReplace(
  mobile,
  '  const out: QuranMatch[] = [];\n',
  '  const out: QuranMatch[] = [];\n  let conceptMatched = false;\n',
  'concept match state'
);

mobile = mustReplace(
  mobile,
  '    if (!c.terms.some((t) => q.includes(t.toLocaleLowerCase("en")))) continue;\n    for (const [s,a,reason] of c.refs)',
  '    if (!c.terms.some((t) => q.includes(t.toLocaleLowerCase("en")))) continue;\n    conceptMatched = true;\n    for (const [s,a,reason] of c.refs)',
  'concept match assignment'
);

const oldFallback = '  for (const word of q.replace(/what does islam say about|what does islam say|islamic ruling on|tell me about/gi, " ").split(/\\s+/).filter((x)=>x.length>4).slice(0,4)) {\n    for (const m of searchQuran(word, 3)) if (m.ayah) out.push({ surah:m.surah, ayah:m.ayah, reason:"Topic match" });\n  }';
const newFallback = '  if (!conceptMatched && out.length === 0) {\n    const cleaned = q\n      .replace(/what does islam say about|what does islam say|islamic ruling on|tell me about/gi, " ")\n      .replace(/ماذا يقول (?:الإسلام|الاسلام|الدين) عن|ماذا يقول الدين|ما حكم|حكم الشرع في/gi, " ");\n    const generic = new Set(["religion","islam","ruling","about","الدين","الاسلام","الإسلام","يقول","حكم","الشرع","ماذا","عن"]);\n    for (const word of cleaned.split(/\\s+/).filter((x)=>x.length>3 && !generic.has(x)).slice(0,3)) {\n      for (const m of searchQuran(word, 3)) if (m.ayah) out.push({ surah:m.surah, ayah:m.ayah, reason:"Topic match" });\n    }\n  }';
mobile = mustReplace(mobile, oldFallback, newFallback, 'generic Quran fallback');

const helperAnchor = 'function unique(items: QuranMatch[]) {';
const helper = `function hadithSourceUrl(item: HadithMatch) {\n  if (item.source_url && /^https:\\/\\//i.test(item.source_url)) return item.source_url;\n  const ref = item.source_text || "";\n  const bukhari = ref.match(/Sahih\\s+(?:al-)?Bukhari\\s+([0-9]+[a-z]?)/i);\n  if (bukhari) return \`https://sunnah.com/bukhari:\${bukhari[1]}\`;\n  const muslim = ref.match(/Sahih\\s+Muslim\\s+([0-9]+[a-z]?)/i);\n  if (muslim) return \`https://sunnah.com/muslim:\${muslim[1]}\`;\n  return "";\n}\n\n`;
if (!mobile.includes('function hadithSourceUrl(')) mobile = mustReplace(mobile, helperAnchor, helper + helperAnchor, 'hadith URL helper anchor');

const oldHadithRender = '{hadith.map((item)=><View key={item.public_id} style={styles.hadithCard}><Text style={styles.hadithTitle}>{ar?(item.title_ar||item.title_en||"حديث"):(item.title_en||item.title_ar||"Hadith")}</Text><Text style={styles.hadithBody}>{ar?(item.body_ar||item.body_en):(item.body_en||item.body_ar)}</Text>{item.source_text?<View style={styles.referencePill}><Text style={styles.referenceText}>✓ {item.source_text}</Text></View>:<Text style={styles.noRef}>{ar?"لا يُعرض الحديث كمرجع حتى تتوفر بيانات المصدر.":"A hadith is not treated as a reference until its source information is available."}</Text>}</View>)}';
const newHadithRender = '{hadith.map((item)=>{const sourceUrl=hadithSourceUrl(item);return <View key={item.public_id} style={styles.hadithCard}><Text style={styles.hadithTitle}>{ar?(item.title_ar||item.title_en||"حديث"):(item.title_en||item.title_ar||"Hadith")}</Text><Text style={styles.hadithBody}>{ar?(item.body_ar||item.body_en):(item.body_en||item.body_ar)}</Text>{item.source_text?(sourceUrl?<Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(sourceUrl)} style={styles.referencePill}><Text style={styles.referenceText}>✓ {item.source_text} ↗</Text><Text style={styles.verifyText}>{ar?"اضغط للتحقق من المصدر":"Tap to verify source"}</Text></Pressable>:<View style={styles.referencePill}><Text style={styles.referenceText}>✓ {item.source_text}</Text></View>):<Text style={styles.noRef}>{ar?"لا يُعرض الحديث كمرجع حتى تتوفر بيانات المصدر.":"A hadith is not treated as a reference until its source information is available."}</Text>}</View>})}';
mobile = mustReplace(mobile, oldHadithRender, newHadithRender, 'Hadith card source UI');

mobile = mustReplace(
  mobile,
  'referenceText:{color:"#075b47",fontSize:8.5,fontWeight:"900"},noRef:',
  'referenceText:{color:"#075b47",fontSize:8.5,fontWeight:"900"},verifyText:{color:"#547269",fontSize:7.5,fontWeight:"800",marginTop:2},noRef:',
  'Hadith source styles'
);

// 3) Remove generic Arabic words that were causing unrelated hadith hits.
backend = mustReplace(
  backend,
  '"الإسلام","اسلام"]);',
  '"الإسلام","اسلام","الدين","يقول","يقولون","حكم","الشرع","religion","ruling"]);',
  'Ask Sheikh stop words'
);

// Preserve source_url when the database supports it is intentionally not required here:
// curated sources already provide source_url, and the mobile app derives Sunnah.com URLs
// from Sahih al-Bukhari / Sahih Muslim source_text for database records.

fs.writeFileSync(mobilePath, mobile);
fs.writeFileSync(backendPath, backend);

// Guardrails for the exact reported regression.
const checks = [
  ['dog Quran refs', mobile.includes('[5,4,"Trained hunting animals"]') && mobile.includes('[18,18,"The Companions of the Cave and their dog"]') && mobile.includes('[18,22,"The dog of the Companions of the Cave"]')],
  ['generic fallback suppressed after concept match', mobile.includes('if (!conceptMatched && out.length === 0)')],
  ['clickable hadith verification', mobile.includes('Linking.openURL(sourceUrl)') && mobile.includes('Tap to verify source')],
  ['Sunnah.com URL derivation', mobile.includes('https://sunnah.com/bukhari:') && mobile.includes('https://sunnah.com/muslim:')],
  ['Arabic generic stop words', backend.includes('"الدين","يقول","يقولون","حكم","الشرع"')]
];
for (const [name, ok] of checks) if (!ok) throw new Error(`Verification failed: ${name}`);
console.log('Ask the Sheikh relevance and source validation links fixed.');
