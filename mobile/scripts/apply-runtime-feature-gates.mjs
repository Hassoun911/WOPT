import fs from 'node:fs';

const path = new URL('../App.tsx', import.meta.url);
let src = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!src.includes(from)) throw new Error(`Missing App.tsx anchor: ${label}`);
  src = src.replace(from, to);
}

if (!src.includes('loadHassounRuntimeConfig')) {
  replaceOnce(
    'import { PRAYER_KEYS, type PrayerKey, type PrayerTimes } from "./src/types";',
    'import { PRAYER_KEYS, type PrayerKey, type PrayerTimes } from "./src/types";\nimport { DEFAULT_RUNTIME_CONFIG, loadHassounRuntimeConfig, type HassounRuntimeConfig } from "./src/remoteConfig";',
    'remote config import'
  );
}

if (!src.includes('const [runtimeFeatures, setRuntimeFeatures]')) {
  replaceOnce(
    '  const [islamicEventAlertsBusy, setIslamicEventAlertsBusy] = useState(false);',
    '  const [islamicEventAlertsBusy, setIslamicEventAlertsBusy] = useState(false);\n  const [runtimeFeatures, setRuntimeFeatures] = useState<HassounRuntimeConfig>(DEFAULT_RUNTIME_CONFIG);',
    'runtime state'
  );
}

if (!src.includes('void loadHassounRuntimeConfig().then(setRuntimeFeatures)')) {
  replaceOnce(
    '  useEffect(() => {\n    void reportHassounActivity("app_open");\n  }, []);',
    '  useEffect(() => {\n    void reportHassounActivity("app_open");\n    void loadHassounRuntimeConfig().then(setRuntimeFeatures).catch(() => undefined);\n  }, []);',
    'runtime load'
  );
}

src = src.replace('onPress={() => setActiveTab("quiz")}', 'onPress={() => runtimeFeatures.gamesEnabled && setActiveTab("quiz")}');
src = src.replace('onPress={() => setActiveTab("quran")}', 'onPress={() => runtimeFeatures.quranEnabled && setActiveTab("quran")}');
src = src.replace('onPress={() => setActiveTab("alerts")}', 'onPress={() => runtimeFeatures.alertsEnabled && setActiveTab("alerts")}');
src = src.replaceAll('onPress={() => setActiveTab("events")}', 'onPress={() => runtimeFeatures.islamicEventsEnabled && setActiveTab("events")}');

replaceOnce(
`  const body = activeTab === "quran"
    ? <Quran locale={locale} onBackHome={() => { setQuranAppNavVisible(true); setQuranOwnsAudioSurface(false); setActiveTab("home"); }} onAppNavVisibilityChange={setQuranAppNavVisible} onLocalAudioSurfaceChange={setQuranOwnsAudioSurface} />
    : activeTab === "quiz"
      ? <QuizGamesHub locale={locale} dateKey={todayKey} stats={quizStats} onStatsChange={setQuizStats} onBackHome={() => setActiveTab("home")} />
      : activeTab === "alerts"
        ? alertsScreen
        : activeTab === "events"
          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />
          : activeTab === "more"
            ? moreScreen
            : homeScreen;

  const navItems: Array<{ tab: AppTab; emoji: string; en: string; ar: string }> = [
    { tab: "home", emoji: "🏠", en: "Home", ar: "الرئيسية" },
    { tab: "quran", emoji: "📖", en: "Qur’an", ar: "القرآن" },
    { tab: "quiz", emoji: "🎮", en: "Games", ar: "ألعاب" },
    { tab: "alerts", emoji: "🔔", en: "Alerts", ar: "تنبيهات" },
    { tab: "more", emoji: "•••", en: "More", ar: "المزيد" }
  ];`,
`  const body = activeTab === "quran" && runtimeFeatures.quranEnabled
    ? <Quran locale={locale} onBackHome={() => { setQuranAppNavVisible(true); setQuranOwnsAudioSurface(false); setActiveTab("home"); }} onAppNavVisibilityChange={setQuranAppNavVisible} onLocalAudioSurfaceChange={setQuranOwnsAudioSurface} />
    : activeTab === "quiz" && runtimeFeatures.gamesEnabled
      ? <QuizGamesHub locale={locale} dateKey={todayKey} stats={quizStats} onStatsChange={setQuizStats} onBackHome={() => setActiveTab("home")} />
      : activeTab === "alerts" && runtimeFeatures.alertsEnabled
        ? alertsScreen
        : activeTab === "events" && runtimeFeatures.islamicEventsEnabled
          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />
          : activeTab === "more"
            ? moreScreen
            : homeScreen;

  const navItems: Array<{ tab: AppTab; emoji: string; en: string; ar: string }> = [
    { tab: "home", emoji: "🏠", en: "Home", ar: "الرئيسية" },
    ...(runtimeFeatures.quranEnabled ? [{ tab: "quran" as AppTab, emoji: "📖", en: "Qur’an", ar: "القرآن" }] : []),
    ...(runtimeFeatures.gamesEnabled ? [{ tab: "quiz" as AppTab, emoji: "🎮", en: "Games", ar: "ألعاب" }] : []),
    ...(runtimeFeatures.alertsEnabled ? [{ tab: "alerts" as AppTab, emoji: "🔔", en: "Alerts", ar: "تنبيهات" }] : []),
    { tab: "more", emoji: "•••", en: "More", ar: "المزيد" }
  ];`,
  'body and nav feature gates'
);

fs.writeFileSync(path, src);
console.log('Applied Hassoun runtime feature gates to mobile/App.tsx');
