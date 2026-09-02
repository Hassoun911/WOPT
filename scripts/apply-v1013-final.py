from pathlib import Path

# --- Settings: expose native Connect Display screen ---
settings_path = Path("mobile/src/SettingsHub.tsx")
settings = settings_path.read_text(encoding="utf-8")

if 'import ConnectDisplayPage from "./ConnectDisplayPage";' not in settings:
    settings = settings.replace('import BrandMark from "./BrandMark";\n', 'import BrandMark from "./BrandMark";\nimport ConnectDisplayPage from "./ConnectDisplayPage";\n', 1)

settings = settings.replace(
    'type SettingsPage = "root" | "about" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";',
    'type SettingsPage = "root" | "about" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets" | "display";',
    1,
)

row_anchor = '        <Row emoji="🧩" title={t("Widgets", "الويدجت")} text={t("Choose layout and what appears on home and supported lock screens", "اختر التصميم والمعلومات التي تظهر على الشاشة الرئيسية وشاشة القفل المدعومة")} onPress={() => setPage("widgets")} />\n'
if row_anchor in settings and 'title={t("Connect Display"' not in settings:
    settings = settings.replace(
        row_anchor,
        row_anchor + '        <Row emoji="📺" title={t("Connect Display", "ربط شاشة")} text={t("Pair this phone with a Masjid TV, iPad, tablet or computer using its 6-digit code", "اربط هذا الهاتف بتلفاز المسجد أو الآيباد أو الجهاز اللوحي أو الكمبيوتر باستخدام الرمز المكوّن من 6 أرقام")} onPress={() => setPage("display")} />\n',
        1,
    )

root_anchor = '  if (page === "root") return root;\n\n'
if root_anchor in settings and 'page === "display"' not in settings:
    settings = settings.replace(root_anchor, root_anchor + '  if (page === "display") return <ConnectDisplayPage locale={locale} onBack={() => setPage("root")} />;\n\n', 1)

settings_path.write_text(settings, encoding="utf-8")

# --- Quran controls: never silently ignore a user press ---
quran_path = Path("mobile/src/quran/QuranV3.tsx")
quran = quran_path.read_text(encoding="utf-8")

old_queue = '''  const playQueue = (queue: QuranAyah[], repeat = false) => {
    const first = queue[0];
    if (!first || !QuranAudio) return;
    setAudioQueue(queue);
    setAudioIndex(0);
    setRepeatQueue(repeat);
    completionRef.current = null;
    QuranAudio.playQueue(nativeQueuePayload(queue), 0, repeat, audioPrefs.speed);
  };'''
new_queue = '''  const playQueue = (queue: QuranAyah[], repeat = false) => {
    const first = queue[0];
    if (!first) return;
    if (!QuranAudio) {
      Alert.alert(tr("Audio unavailable", "الصوت غير متاح"), tr("Qur’an audio could not start on this device. Please restart Hassoun and try again.", "تعذر بدء صوت القرآن على هذا الجهاز. أعد تشغيل حسّون وحاول مرة أخرى."));
      return;
    }
    setAudioQueue(queue);
    setAudioIndex(0);
    setRepeatQueue(repeat);
    setAudioStatus((previous) => ({ ...previous, available: true, state: "loading", title: previous.title ?? tr("Preparing Qur’an audio…", "جارٍ تجهيز صوت القرآن…") }));
    completionRef.current = null;
    try {
      QuranAudio.playQueue(nativeQueuePayload(queue), 0, repeat, audioPrefs.speed);
    } catch (error) {
      setAudioStatus((previous) => ({ ...previous, state: "error" }));
      Alert.alert(tr("Playback failed", "فشل التشغيل"), error instanceof Error ? error.message : tr("Please try again.", "يرجى المحاولة مرة أخرى."));
    }
  };'''
if old_queue in quran:
    quran = quran.replace(old_queue, new_queue, 1)
elif 'setAudioStatus((previous) => ({ ...previous, available: true, state: "loading"' not in quran:
    raise SystemExit("playQueue anchor changed; refusing to build an unverified Google Play fix")

old_native = '''  const playNativeAyah = (ayah: QuranAyah, reciterId = audioPrefs.reciter) => {
    if (!QuranAudio) return;
    completionRef.current = null;
    QuranAudio.playQueue(nativeQueuePayload([ayah], reciterId), 0, false, audioPrefs.speed);
  };'''
new_native = '''  const playNativeAyah = (ayah: QuranAyah, reciterId = audioPrefs.reciter) => {
    if (!QuranAudio) {
      Alert.alert(tr("Audio unavailable", "الصوت غير متاح"), tr("Qur’an audio could not start on this device.", "تعذر بدء صوت القرآن على هذا الجهاز."));
      return;
    }
    setAudioStatus((previous) => ({ ...previous, available: true, state: "loading" }));
    completionRef.current = null;
    try { QuranAudio.playQueue(nativeQueuePayload([ayah], reciterId), 0, false, audioPrefs.speed); }
    catch (error) { Alert.alert(tr("Playback failed", "فشل التشغيل"), error instanceof Error ? error.message : tr("Please try again.", "يرجى المحاولة مرة أخرى.")); }
  };'''
if old_native in quran:
    quran = quran.replace(old_native, new_native, 1)

old_range_start = '''  const playFullQuranRange = (repeat = false) => {
    if (!QuranAudio) return;'''
new_range_start = '''  const playFullQuranRange = (repeat = false) => {
    if (!QuranAudio) {
      Alert.alert(tr("Audio unavailable", "الصوت غير متاح"), tr("Continuous Qur’an audio could not start on this device.", "تعذر بدء تشغيل القرآن المتواصل على هذا الجهاز."));
      return;
    }
    setAudioStatus((previous) => ({ ...previous, available: true, state: "loading", title: tr("Preparing continuous Qur’an…", "جارٍ تجهيز القرآن المتواصل…") }));'''
if old_range_start in quran:
    quran = quran.replace(old_range_start, new_range_start, 1)
elif 'Preparing continuous Qur’an' not in quran:
    raise SystemExit("playFullQuranRange anchor changed; refusing to build an unverified Google Play fix")

quran_path.write_text(quran, encoding="utf-8")
print("Applied v1.0.13 final fixes: Connect Display + responsive Quran audio controls.")
