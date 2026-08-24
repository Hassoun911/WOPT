import fs from 'node:fs';

function patchFile(path, mutate) {
  let s = fs.readFileSync(path, 'utf8');
  const next = mutate(s);
  if (next === s) console.log(path + ': no changes needed');
  else { fs.writeFileSync(path, next); console.log(path + ': restored Ask the Sheikh'); }
}

patchFile('App.tsx', (s) => {
  if (!s.includes('import AskSheikh from "./src/AskSheikh";')) {
    const marker = 'import QiblaDirectionScreen from "./src/QiblaDirectionScreen";\n';
    if (!s.includes(marker)) throw new Error('AskSheikh import anchor not found');
    s = s.replace(marker, marker + 'import AskSheikh from "./src/AskSheikh";\nimport { DEFAULT_RUNTIME_CONFIG } from "./src/remoteConfig";\n');
  }

  s = s.replace(
    'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "qibla" | "more";',
    'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "qibla" | "sheikh" | "more";'
  );

  if (!s.includes('ASK THE SHEIKH')) {
    const marker = '      <Pressable onPress={() => setActiveTab("events")} style={styles.eventsEntryCard}>';
    if (!s.includes(marker)) throw new Error('Ask Sheikh home-card anchor not found');
    const card = `      <Pressable onPress={() => setActiveTab("sheikh")} style={styles.eventsEntryCard}><View style={styles.eventsEntryIcon}><Text style={styles.eventsEntryEmoji}>🕌</Text></View><View style={styles.eventsEntryCopy}><Text style={styles.eventsEntryEyebrow}>{locale === "ar" ? "بحث إسلامي ذكي" : "ASK THE SHEIKH"}</Text><Text style={styles.eventsEntryTitle}>{locale === "ar" ? "اسأل الشيخ" : "Ask the Sheikh"}</Text><Text style={styles.eventsEntryText}>{locale === "ar" ? "اسأل عن موضوع إسلامي وابحث في القرآن والأحاديث الموثقة مع المراجع." : "Ask an Islamic question and search Qur’an and verified Hadith references in one place."}</Text></View><Text style={styles.eventsEntryArrow}>›</Text></Pressable>\n\n`;
    s = s.replace(marker, card + marker);
  }

  if (!s.includes('activeTab === "sheikh"')) {
    const marker = '      : activeTab === "alerts"\n        ? alertsScreen';
    if (!s.includes(marker)) throw new Error('Ask Sheikh route anchor not found');
    s = s.replace(marker, '      : activeTab === "sheikh"\n        ? <AskSheikh locale={locale} runtime={DEFAULT_RUNTIME_CONFIG} onClose={() => setActiveTab("home")} />\n      : activeTab === "alerts"\n        ? alertsScreen');
  }

  return s;
});

patchFile('src/FeatureGuidePage.tsx', (s) => {
  if (s.includes('en:"Ask the Sheikh"')) return s;
  const marker = ' {emoji:"🛠️",en:"Quick troubleshooting"';
  if (!s.includes(marker)) throw new Error('Ask Sheikh guide anchor not found');
  const item = ` {emoji:"🕌",en:"Ask the Sheikh",ar:"اسأل الشيخ",whatEn:"Ask natural Islamic questions and let Hassoun search relevant Qur’an verses and verified Hadith references while keeping the sources visible.",whatAr:"اسأل أسئلة إسلامية بطريقتك ويبحث Hassoun عن الآيات ذات الصلة والأحاديث الموثقة مع إبقاء المراجع ظاهرة.",stepsEn:["Open Ask the Sheikh from Home.","Type a question such as: What does Islam say about riba?","Tap Ask Hassoun.","Review the Qur’an and Hadith references and open a verse without losing your search."],stepsAr:["افتح اسأل الشيخ من الرئيسية.","اكتب سؤالك مثل: ماذا يقول الإسلام عن الربا؟","اضغط اسأل Hassoun.","راجع مراجع القرآن والحديث وافتح الآية دون فقدان البحث."],exampleEn:"Ask about patience → Hassoun can surface related Qur’an verses and verified source references.",exampleAr:"اسأل عن الصبر ← يمكن لـ Hassoun عرض آيات ذات صلة ومراجع موثقة.",tipEn:"ℹ️ For personal fatwas and individual rulings, consult a qualified scholar you trust.",tipAr:"ℹ️ للفتاوى والأحكام الشخصية راجع عالماً مؤهلاً تثق به.",tags:"ask sheikh islam question quran hadith sunnah reference ai scholar"},\n`;
  return s.replace(marker, item + marker);
});

console.log('Ask the Sheikh restored to Hassoun navigation and guide');
