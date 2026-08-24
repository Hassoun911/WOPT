import fs from 'node:fs';

const path = new URL('../App.tsx', import.meta.url);
let src = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!src.includes(from)) throw new Error(`Missing App.tsx anchor: ${label}`);
  src = src.replace(from, to);
}

if (!src.includes('import AskSheikh from "./src/AskSheikh";')) {
  replaceOnce(
    'import ScrollingTicker from "./src/ScrollingTicker";',
    'import ScrollingTicker from "./src/ScrollingTicker";\nimport AskSheikh from "./src/AskSheikh";',
    'AskSheikh import'
  );
}

replaceOnce(
  'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "more";',
  'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "sheikh" | "more";',
  'AppTab union'
);

const smartGrid = '      <View style={styles.smartGrid}><Pressable onPress={() => runtimeFeatures.quranEnabled && setActiveTab("quran")} style={styles.smartCard}><Text style={styles.smartEmoji}>📖</Text><Text style={styles.smartTitle}>{locale === "ar" ? "القرآن" : "Qur’an"}</Text><Text style={styles.smartText}>{locale === "ar" ? "قارئ أندرويد أصلي" : "Native Android reader"}</Text></Pressable><Pressable onPress={() => runtimeFeatures.alertsEnabled && setActiveTab("alerts")} style={styles.smartCard}><Text style={styles.smartEmoji}>🔔</Text><Text style={styles.smartTitle}>{locale === "ar" ? "التنبيهات" : "Alerts"}</Text><Text style={styles.smartText}>{alertsEnabled ? (locale === "ar" ? "مفعّلة" : "Enabled") : (locale === "ar" ? "اضبط التذكيرات" : "Set reminders")}</Text></Pressable></View>';
if (!src.includes('SMART ISLAMIC SEARCH')) {
  replaceOnce(
    smartGrid,
    `${smartGrid}\n\n      {runtimeFeatures.askSheikhEnabled ? <Pressable onPress={() => setActiveTab("sheikh")} style={styles.eventsEntryCard}><View style={styles.eventsEntryIcon}><Text style={styles.eventsEntryEmoji}>✨</Text></View><View style={styles.eventsEntryCopy}><Text style={styles.eventsEntryEyebrow}>HASSOUN • {locale === "ar" ? "بحث إسلامي ذكي" : "SMART ISLAMIC SEARCH"}</Text><Text style={styles.eventsEntryTitle}>{locale === "ar" ? "اسأل الشيخ" : "Ask the Sheikh"}</Text><Text style={styles.eventsEntryText}>{locale === "ar" ? "ابحث بذكاء في القرآن والأحاديث الموثقة وشاهد أكثر الأسئلة التي يسألها الناس فعلاً." : "Search the Qur’an and verified Hadith intelligently, with real questions people are actually asking."}</Text></View><Text style={styles.eventsEntryArrow}>›</Text></Pressable> : null}`,
    'Ask Sheikh home card'
  );
}

const bodyAnchor = `        : activeTab === "events" && runtimeFeatures.islamicEventsEnabled\n          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />\n          : activeTab === "more"`;
if (!src.includes('activeTab === "sheikh"')) {
  replaceOnce(
    bodyAnchor,
    `        : activeTab === "events" && runtimeFeatures.islamicEventsEnabled\n          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />\n          : activeTab === "sheikh" && runtimeFeatures.askSheikhEnabled\n            ? <AskSheikh locale={locale} runtime={runtimeFeatures} onClose={() => setActiveTab("home")} />\n          : activeTab === "more"`,
    'Ask Sheikh body route'
  );
}

fs.writeFileSync(path, src);
console.log('Ask the Sheikh is connected to Hassoun mobile navigation.');
