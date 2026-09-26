from pathlib import Path
import re
import subprocess

ROOT=Path('.')

def from_main(rel: str) -> str:
    return subprocess.check_output(['git','show',f'origin/main:{rel}'], text=True)

# Shared, cross-platform pages that are present in the current Android feature stack
# but missing from the dedicated iOS tree.
shared = {
    'src/VoiceAssistantsPage.tsx': 'mobile/src/VoiceAssistantsPage.tsx',
    'src/ConnectDisplayPage.tsx': 'mobile/src/ConnectDisplayPage.tsx',
    'src/MasjidDisplayPage.tsx': 'mobile/src/MasjidDisplayPage.tsx',
    'src/DailyIslamicCards.tsx': 'mobile/src/DailyIslamicCards.tsx',
    'src/dailyIslamicContent.ts': 'mobile/src/dailyIslamicContent.ts',
    'src/displayCalculationSync.ts': 'mobile/src/displayCalculationSync.ts',
}
for target, source in shared.items():
    Path(target).write_text(from_main(source), encoding='utf-8')
    print(f'Installed shared parity source: {target}')

# iOS camera permission path for QR pairing. Android keeps its direct runtime path.
pair_path=Path('src/ConnectDisplayPage.tsx')
pair=pair_path.read_text(encoding='utf-8')
pair=pair.replace('import { CameraView } from "expo-camera";', 'import { CameraView, useCameraPermissions } from "expo-camera";', 1)
state_anchor='  const [code,setCode]=useState("")'
idx=pair.find(state_anchor)
if idx<0: raise SystemExit('ConnectDisplay state anchor missing')
line_end=pair.find('\n',idx)
if 'useCameraPermissions()' not in pair:
    pair=pair[:line_end+1]+'  const [iosCameraPermission, requestIosCameraPermission] = useCameraPermissions();\n'+pair[line_end+1:]
old='  const ensureCamera=async()=>{if(Platform.OS!=="android"){setCameraReady(true);setScannerOpen(true);return}'
new='  const ensureCamera=async()=>{if(Platform.OS!=="android"){let granted=iosCameraPermission?.granted===true;if(!granted){const result=await requestIosCameraPermission();granted=result.granted}if(!granted){Alert.alert(t("Camera permission needed","مطلوب إذن الكاميرا"),t("Allow camera access to scan the display QR code, or enter the 6-digit code manually.","اسمح بالكاميرا لمسح رمز QR أو أدخل الرمز المكوّن من 6 أرقام يدوياً."));return}setCameraReady(true);setScannerOpen(true);return}'
if old not in pair: raise SystemExit('ConnectDisplay ensureCamera anchor missing')
pair=pair.replace(old,new,1)
pair=pair.replace('useState("Hassoun Android")','useState(Platform.OS === "ios" ? "Hassoun iPhone / iPad" : "Hassoun Android")',1)
pair=pair.replace('(controllerName.trim()||"Hassoun Android")','(controllerName.trim()||(Platform.OS === "ios" ? "Hassoun iPhone / iPad" : "Hassoun Android"))')
pair=pair.replace('Every change is sent to the connected tablet/iPad automatically.','Every change is sent to the connected tablet or iPad automatically.')
pair_path.write_text(pair,encoding='utf-8')

# Sync Prayer Calculation choices to any paired displays, matching Android behavior.
settings_path=Path('src/prayerCalculationSettings.ts')
settings=settings_path.read_text(encoding='utf-8')
if 'syncCalculationToPairedDisplays' not in settings:
    settings=settings.replace('import AsyncStorage from "@react-native-async-storage/async-storage";','import AsyncStorage from "@react-native-async-storage/async-storage";\nimport { syncCalculationToPairedDisplays } from "./displayCalculationSync";',1)
    settings=settings.replace('  listeners.forEach((listener) => { try { listener(); } catch {} });','  listeners.forEach((listener) => { try { listener(); } catch {} });\n  await syncCalculationToPairedDisplays(value).catch(() => undefined);',1)
settings_path.write_text(settings,encoding='utf-8')

# Expand iOS Permissions with Camera as a live, functional permission.
perm_path=Path('src/PermissionsStatusPage.tsx')
perm=perm_path.read_text(encoding='utf-8')
if 'useCameraPermissions' not in perm:
    perm=perm.replace('import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";','import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";\nimport { useCameraPermissions } from "expo-camera";',1)
    anchor=' const ar=locale==="ar",t=(en:string,a:string)=>ar?a:en; const [state,setState]=useState<State>(empty),[busy,setBusy]=useState("");'
    if anchor not in perm: raise SystemExit('Permissions hook anchor missing')
    perm=perm.replace(anchor,anchor+' const [cameraPermission, requestCameraPermission] = useCameraPermissions();',1)
    speech='<Card emoji="🗣️" title={t("Speech Recognition","التعرف على الكلام")}'
    pos=perm.find(speech)
    if pos<0: raise SystemExit('Permissions speech card anchor missing')
    camera='''<Card emoji="📷" title={t("Camera","الكاميرا")} body={t("Used only to scan a Masjid / wall-display QR pairing code.","تستخدم فقط لمسح رمز QR لربط شاشة المسجد أو الحائط.")} enabled={cameraPermission?.granted===true} action={()=>cameraPermission?.granted?void Linking.openSettings():void requestCameraPermission()} label={cameraPermission?.granted?t("Manage / Disable in iPhone Settings","إدارة / تعطيل من إعدادات iPhone"):t("Enable camera","تفعيل الكاميرا")}/>\n '''
    perm=perm[:pos]+camera+perm[pos:]
perm_path.write_text(perm,encoding='utf-8')

# Settings: Displays submenu + Voice Assistants, while preserving the new Prayer Calculation
# and Permissions routes already installed by v1.0.37.
hub_path=Path('src/SettingsHub.tsx')
hub=hub_path.read_text(encoding='utf-8')
imports=[
    'import VoiceAssistantsPage from "./VoiceAssistantsPage";',
    'import ConnectDisplayPage from "./ConnectDisplayPage";',
    'import MasjidDisplayPage from "./MasjidDisplayPage";',
]
anchor='import AboutHassounPage from "./AboutHassounPage";'
for imp in imports:
    if imp not in hub:
        hub=hub.replace(anchor,anchor+'\n'+imp,1)
        anchor=imp
m=re.search(r'type SettingsPage = ([^;]+);',hub)
if not m: raise SystemExit('SettingsPage union missing')
union=m.group(1)
for page in ['"voiceAssistants"','"displays"','"connectDisplay"','"masjidDisplay"']:
    if page not in union: union += ' | '+page
hub=hub[:m.start(1)]+union+hub[m.end(1):]
widgets='        <Row emoji="🧩" title={t("Widgets", "الويدجت")} text={t("Choose layout and what appears on home and supported lock screens", "اختر التصميم والمعلومات التي تظهر على الشاشة الرئيسية وشاشة القفل المدعومة")} onPress={() => setPage("widgets")} />'
if 'title={t("Displays", "الشاشات")}' not in hub:
    if widgets not in hub: raise SystemExit('Widgets row missing for Displays')
    hub=hub.replace(widgets,widgets+'\n        <Row emoji="🖥️" title={t("Displays", "الشاشات")} text={t("Open this device as a prayer display or connect and control another display", "افتح هذا الجهاز كشاشة صلاة أو اربط وتحكم بشاشة أخرى")} onPress={() => setPage("displays")} />',1)
alerts='        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />'
if 'title={t("Voice Assistants"' not in hub:
    if alerts not in hub: raise SystemExit('Prayer alert row missing for Voice Assistants')
    hub=hub.replace(alerts,alerts+'\n        <Row emoji="🎙️" title={t("Voice Assistants", "المساعدات الصوتية")} text={t("Alexa and Google Home status and setup", "حالة وإعداد Alexa وGoogle Home")} onPress={() => setPage("voiceAssistants")} />',1)
root_anchor='  if (page === "root") return root;\n\n'
if root_anchor not in hub: raise SystemExit('Settings root route anchor missing')
routes='''  if (page === "voiceAssistants") return <VoiceAssistantsPage locale={locale} onBack={() => setPage("root")} />;\n\n  if (page === "connectDisplay") return <ConnectDisplayPage locale={locale} onBack={() => setPage("displays")} />;\n\n  if (page === "masjidDisplay") return <MasjidDisplayPage locale={locale} onBack={() => setPage("displays")} />;\n\n  if (page === "displays") {\n    return (\n      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>\n        <BackHeader title={t("Displays", "الشاشات")} onBack={() => setPage("root")} />\n        <Text style={styles.subtitle}>{t("Use this iPhone or iPad as a prayer wall display, or pair and remotely control another display.", "استخدم هذا iPhone أو iPad كشاشة صلاة أو اربط وتحكم بشاشة أخرى عن بُعد.")}</Text>\n        <Section title={t("DISPLAY OPTIONS", "خيارات الشاشة")}>\n          <Row emoji="🕌" title={t("Tablet / Wall Display", "شاشة الجهاز اللوحي / الحائط")} text={t("Open the full-screen rotating prayer display on this device", "افتح شاشة الصلاة الدوارة بملء الشاشة على هذا الجهاز")} onPress={() => setPage("masjidDisplay")} />\n          <Row emoji="🔗" title={t("Connect Display", "ربط شاشة")} text={t("Scan a QR code or enter the 6-digit pairing code", "امسح رمز QR أو أدخل رمز الربط المكوّن من 6 أرقام")} onPress={() => setPage("connectDisplay")} />\n          <Row emoji="🖥️" title={t("Manage Wall & Masjid Displays", "إدارة شاشات الحائط والمسجد")} text={t("Open saved displays and live remote controls", "افتح الشاشات المحفوظة وأدوات التحكم المباشرة")} onPress={() => setPage("connectDisplay")} />\n        </Section>\n      </ScrollView>\n    );\n  }\n\n'''
if 'page === "voiceAssistants"' not in hub:
    hub=hub.replace(root_anchor,root_anchor+routes,1)
hub_path.write_text(hub,encoding='utf-8')

# App parity: Daily Qur'an/Hadith cards, pull-to-refresh, and active-tab resume.
app_path=Path('App.tsx')
app=app_path.read_text(encoding='utf-8')
app=app.replace('import { useEffect, useMemo, useState } from "react";','import { useCallback, useEffect, useMemo, useState } from "react";',1)
if 'RefreshControl' not in app.split('} from "react-native";')[0]:
    app=app.replace('  Pressable,\n  ScrollView,','  Pressable,\n  RefreshControl,\n  ScrollView,',1)
if 'import DailyIslamicCards from "./src/DailyIslamicCards";' not in app:
    app=app.replace('import HomePrayerPanel from "./src/HomePrayerPanel";','import HomePrayerPanel from "./src/HomePrayerPanel";\nimport DailyIslamicCards from "./src/DailyIslamicCards";',1)
state='  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
if 'const [refreshingHome, setRefreshingHome]' not in app:
    if state not in app: raise SystemExit('App state anchor missing')
    app=app.replace(state,state+'\n  const [refreshingHome, setRefreshingHome] = useState(false);\n  const [runtimeNavRestored, setRuntimeNavRestored] = useState(false);',1)
# refresh callback before first effect
if 'const refreshHome = useCallback' not in app:
    first=app.find('  useEffect(() => {')
    if first<0: raise SystemExit('App effect anchor missing')
    refresh='''  const refreshHome = useCallback(async () => {\n    if (refreshingHome) return;\n    setRefreshingHome(true);\n    try {\n      const refreshed = await loadPrayerTimes({ forceLocation: true });\n      setPrayerTimes(refreshed.prayerTimes);\n      setPrayerLocation(refreshed.location);\n      setLive(refreshed.live);\n      setNow(new Date());\n      if (alertsEnabled && Object.keys(refreshed.prayerTimes).length) {\n        const result = await schedulePrayerNotifications(refreshed.prayerTimes, locale, phoneAlertPreferences, { timeZone: refreshed.location.timezone, locationLabel: refreshed.location.label });\n        setScheduledCount(result.count);\n      }\n    } finally { setRefreshingHome(false); }\n  }, [alertsEnabled, locale, phoneAlertPreferences, refreshingHome]);\n\n  useEffect(() => {\n    let alive = true;\n    void AsyncStorage.getItem("hassoun:last-active-tab:v2").then((saved) => {\n      if (!alive || !saved) return;\n      const allowed: AppTab[] = ["home","quran","quiz","alerts","events","qibla","more"];\n      if (allowed.includes(saved as AppTab)) setActiveTab(saved as AppTab);\n    }).finally(() => { if (alive) setRuntimeNavRestored(true); });\n    return () => { alive = false; };\n  }, []);\n\n  useEffect(() => {\n    if (!runtimeNavRestored) return;\n    void AsyncStorage.setItem("hassoun:last-active-tab:v2", activeTab).catch(() => undefined);\n  }, [activeTab, runtimeNavRestored]);\n\n'''
    app=app[:first]+refresh+app[first:]
home_scroll='  const homeScreen = (\n    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>'
if home_scroll in app:
    app=app.replace(home_scroll,'  const homeScreen = (\n    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshingHome} onRefresh={() => { void refreshHome(); }} />}>',1)
else:
    raise SystemExit('Home ScrollView anchor missing')
if '<DailyIslamicCards locale={locale}' not in app:
    panel_end='      />\n\n      <Pressable onPress={() => setActiveTab("quiz")}'
    if panel_end not in app: raise SystemExit('Home prayer panel/quiz boundary missing')
    app=app.replace(panel_end,'      />\n\n      <DailyIslamicCards locale={locale} date={now} timeZone={activeTimeZone} />\n\n      <Pressable onPress={() => setActiveTab("quiz")}',1)
# Correct Android-only wording visible on iOS.
app=app.replace('Native Android reader','Native Qur’an reader').replace('قارئ أندرويد أصلي','قارئ قرآن أصلي')
app_path.write_text(app,encoding='utf-8')

# iPad + camera privacy description.
cfg_path=Path('app.config.ts')
cfg=cfg_path.read_text(encoding='utf-8')
cfg=cfg.replace('supportsTablet: false','supportsTablet: true',1)
if 'NSCameraUsageDescription' not in cfg:
    anchor='      NSLocationWhenInUseUsageDescription: "Hassoun uses your location to support location-aware features and prayer-time settings when you choose to use them.",'
    if anchor not in cfg: raise SystemExit('iOS Info.plist location anchor missing')
    cfg=cfg.replace(anchor,anchor+'\n      NSCameraUsageDescription: "Hassoun uses the camera only when you choose to scan a QR code to pair a Masjid or wall display.",',1)
cfg_path.write_text(cfg,encoding='utf-8')

checks={
 'src/SettingsHub.tsx':['VoiceAssistantsPage','title={t("Displays"','MasjidDisplayPage','ConnectDisplayPage'],
 'src/ConnectDisplayPage.tsx':['useCameraPermissions','Hassoun iPhone / iPad'],
 'src/MasjidDisplayPage.tsx':['Tablet Wall Display','/masjid-displays/register'],
 'src/PermissionsStatusPage.tsx':['Enable camera','useCameraPermissions'],
 'src/prayerCalculationSettings.ts':['syncCalculationToPairedDisplays'],
 'App.tsx':['DailyIslamicCards','RefreshControl','hassoun:last-active-tab:v2','refreshHome'],
 'app.config.ts':['supportsTablet: true','NSCameraUsageDescription'],
}
for rel,needles in checks.items():
    text=Path(rel).read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text: raise SystemExit(f'Missing parity marker {needle!r} in {rel}')
print('Applied iOS v1.0.38 shared feature parity layer')
