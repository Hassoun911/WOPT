import fs from "node:fs";

function patch(path, before, after, label) {
  let src = fs.readFileSync(path, "utf8");
  if (!src.includes(before)) throw new Error(`${path}: missing ${label}`);
  src = src.replace(before, after);
  fs.writeFileSync(path, src);
}

patch(
  "mobile/src/quran/QuranV3.tsx",
  `type Props = { locale: QuranLocale; onBackHome: () => void };`,
  `type Props = {\n  locale: QuranLocale;\n  onBackHome: () => void;\n  onAppNavVisibilityChange?: (visible: boolean) => void;\n};`,
  "Quran props"
);

patch(
  "mobile/src/quran/QuranV3.tsx",
  `export default function QuranV3({ locale, onBackHome }: Props) {`,
  `export default function QuranV3({ locale, onBackHome, onAppNavVisibilityChange }: Props) {`,
  "Quran component signature"
);

patch(
  "mobile/src/quran/QuranV3.tsx",
  `  const completionRef = useRef<string | null>(null);`,
  `  const completionRef = useRef<string | null>(null);\n  const appNavHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);`,
  "navigation timer ref"
);

patch(
  "mobile/src/quran/QuranV3.tsx",
  `  useEffect(() => {\n    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBack);\n    return () => subscription.remove();\n  }, [screen, backTarget, menuOpen, appearanceOpen]);`,
  `  useEffect(() => {\n    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBack);\n    return () => subscription.remove();\n  }, [screen, backTarget, menuOpen, appearanceOpen]);\n\n  const clearAppNavTimer = () => {\n    if (appNavHideTimer.current) {\n      clearTimeout(appNavHideTimer.current);\n      appNavHideTimer.current = null;\n    }\n  };\n\n  const scheduleAppNavHide = () => {\n    clearAppNavTimer();\n    appNavHideTimer.current = setTimeout(() => {\n      onAppNavVisibilityChange?.(false);\n      appNavHideTimer.current = null;\n    }, 1800);\n  };\n\n  const revealAppNav = () => {\n    if (screen === "reader" || screen === "radio") return;\n    onAppNavVisibilityChange?.(true);\n    if (screen !== "home") scheduleAppNavHide();\n  };\n\n  useEffect(() => {\n    clearAppNavTimer();\n    if (screen === "reader" || screen === "radio") {\n      onAppNavVisibilityChange?.(false);\n      return;\n    }\n    onAppNavVisibilityChange?.(true);\n    if (screen !== "home") scheduleAppNavHide();\n    return clearAppNavTimer;\n  }, [screen, onAppNavVisibilityChange]);\n\n  useEffect(() => () => {\n    clearAppNavTimer();\n    onAppNavVisibilityChange?.(true);\n  }, [onAppNavVisibilityChange]);`,
  "navigation visibility behavior"
);

patch(
  "mobile/src/quran/QuranV3.tsx",
  `    <View style={styles.flex}>\n      {body}\n      {miniPlayer}\n      {quranDock}`,
  `    <View style={styles.flex} onTouchStart={revealAppNav} onTouchMove={revealAppNav}>\n      {body}\n      {miniPlayer}\n      {(screen === "reader" || screen === "radio") ? quranDock : null}`,
  "Quran root navigation rendering"
);

patch(
  "mobile/App.tsx",
  `  const [activeTab, setActiveTab] = useState<AppTab>("home");\n  const [quizStats, setQuizStats] = useState<QuizStats>(EMPTY_QUIZ_STATS);`,
  `  const [activeTab, setActiveTab] = useState<AppTab>("home");\n  const [quranAppNavVisible, setQuranAppNavVisible] = useState(true);\n  const [quizStats, setQuizStats] = useState<QuizStats>(EMPTY_QUIZ_STATS);`,
  "App Quran nav state"
);

patch(
  "mobile/App.tsx",
  `    ? <Quran locale={locale} onBackHome={() => setActiveTab("home")} />`,
  `    ? <Quran locale={locale} onBackHome={() => { setQuranAppNavVisible(true); setActiveTab("home"); }} onAppNavVisibilityChange={setQuranAppNavVisible} />`,
  "Quran visibility callback"
);

patch(
  "mobile/App.tsx",
  `{activeTab !== "quran" ? (`,
  `{(activeTab !== "quran" || quranAppNavVisible) ? (`,
  "bottom nav visibility condition"
);

patch(
  "mobile/app.config.ts",
  `  version: "0.3.6",`,
  `  version: "0.3.7",`,
  "app version"
);

patch(
  "mobile/app.config.ts",
  `    versionCode: 9,`,
  `    versionCode: 10,`,
  "Android version code"
);

console.log("Applied Quran v0.3.7 navigation behavior: index main nav, hidden reader/radio nav, transient nav elsewhere.");
