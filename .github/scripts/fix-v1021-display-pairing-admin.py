from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "mobile/src/ConnectDisplayPage.tsx"

P.write_text(r'''import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import BrandMark from "./BrandMark";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const STORAGE_KEY = "hassoun:paired-displays:v2";

type Display = {
  id: string;
  code: string;
  name: string;
  token: string;
  pairedAt: string;
  location?: string;
  lastSeenAt?: string;
};

type Remote = {
  name: string;
  settings: Record<string, any>;
  revision?: number;
  lastSeenAt?: string;
};

type Props = { locale: "en" | "ar"; onBack: () => void };

function codeFromScan(raw: string) {
  const direct = raw.match(/^\s*(\d{6})\s*$/)?.[1];
  if (direct) return direct;
  try {
    const url = new URL(raw);
    const queryCode = url.searchParams.get("code") || "";
    if (/^\d{6}$/.test(queryCode)) return queryCode;
  } catch {}
  return raw.match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1] || "";
}

function locationFromSettings(settings: Record<string, any> | undefined) {
  if (!settings) return "";
  return String(settings.mosqueLocation || settings.location || settings.city || "").trim();
}

export default function ConnectDisplayPage({ locale, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [code, setCode] = useState("");
  const [controllerName, setControllerName] = useState("Hassoun Android");
  const [paired, setPaired] = useState<Display[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState<Display | null>(null);
  const [remote, setRemote] = useState<Remote | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const valid = useMemo(() => /^\d{6}$/.test(code), [code]);

  const save = useCallback(async (next: Display[]) => {
    setPaired(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const fetchRemote = useCallback(async (item: Display) => {
    const response = await fetch(`${API}/masjid-displays/control/${encodeURIComponent(item.id)}`, {
      headers: { Authorization: `Bearer ${item.token}` }
    });
    const data = await response.json() as Remote & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not load display");
    return data;
  }, []);

  const refreshSaved = useCallback(async (items: Display[]) => {
    const next = await Promise.all(items.map(async (item) => {
      try {
        const data = await fetchRemote(item);
        return {
          ...item,
          name: data.name || item.name,
          location: locationFromSettings(data.settings) || item.location,
          lastSeenAt: data.lastSeenAt || item.lastSeenAt
        };
      } catch {
        return item;
      }
    }));
    await save(next);
  }, [fetchRemote, save]);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!value) return;
      try {
        const items = JSON.parse(value) as Display[];
        setPaired(items);
        void refreshSaved(items);
      } catch {}
    });
  }, [refreshSaved]);

  const pair = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API}/masjid-displays/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, controllerName: (controllerName.trim() || "Hassoun Android").slice(0, 50) })
      });
      const data = await response.json() as {
        ok?: boolean;
        deviceId?: string;
        name?: string;
        token?: string;
        settings?: Record<string, any>;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.deviceId || !data.token) {
        throw new Error(data.error || t("Could not pair display", "تعذر ربط الشاشة"));
      }
      const item: Display = {
        id: data.deviceId,
        code,
        name: (data.name || "Masjid Display").slice(0, 40),
        token: data.token,
        pairedAt: new Date().toISOString(),
        location: locationFromSettings(data.settings)
      };
      const next = [item, ...paired.filter((entry) => entry.id !== item.id)];
      await save(next);
      setCode("");
      setMessage(t("Connected. Tap the display below to open its admin panel.", "تم الاتصال. اضغط على الشاشة أدناه لفتح لوحة الإدارة."));
      await openAdmin(item);
    } catch (error) {
      const text = error instanceof Error ? error.message : t("Could not pair display", "تعذر ربط الشاشة");
      setMessage(text);
      Alert.alert(t("Connection failed", "فشل الاتصال"), text);
    } finally {
      setBusy(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(t("Camera permission needed", "مطلوب إذن الكاميرا"), t("Allow camera access to scan the display QR code.", "اسمح بالوصول إلى الكاميرا لمسح رمز QR الخاص بالشاشة."));
        return;
      }
    }
    setScannerOpen(true);
  };

  const onScanned = ({ data }: { data: string }) => {
    const found = codeFromScan(data);
    if (!found) return;
    setScannerOpen(false);
    setCode(found);
    setMessage(t("Code scanned. Tap Pair display to connect.", "تم مسح الرمز. اضغط ربط الشاشة للاتصال."));
  };

  const openAdmin = async (item: Display) => {
    setActive(item);
    setRemote(null);
    setAdminMessage("");
    setAdminBusy(true);
    try {
      const data = await fetchRemote(item);
      setRemote(data);
      const updated = paired.map((entry) => entry.id === item.id ? {
        ...entry,
        name: data.name || entry.name,
        location: locationFromSettings(data.settings) || entry.location,
        lastSeenAt: data.lastSeenAt || entry.lastSeenAt
      } : entry);
      if (updated.length) await save(updated);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : t("Could not load display", "تعذر تحميل الشاشة"));
    } finally {
      setAdminBusy(false);
    }
  };

  const updateRemote = (key: string, value: any) => {
    setRemote((current) => current ? { ...current, settings: { ...current.settings, [key]: value } } : current);
  };

  const saveAdmin = async () => {
    if (!active || !remote || adminBusy) return;
    setAdminBusy(true);
    setAdminMessage(t("Saving…", "جارٍ الحفظ…"));
    try {
      const response = await fetch(`${API}/masjid-displays/control/${encodeURIComponent(active.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${active.token}` },
        body: JSON.stringify({ name: remote.name, settings: remote.settings })
      });
      const data = await response.json() as { ok?: boolean; revision?: number; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not save display");
      const next = paired.map((entry) => entry.id === active.id ? {
        ...entry,
        name: remote.name,
        location: locationFromSettings(remote.settings)
      } : entry);
      await save(next);
      setActive(next.find((entry) => entry.id === active.id) || active);
      setAdminMessage(t("Saved and sent live to the display.", "تم الحفظ والإرسال مباشرة إلى الشاشة."));
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : t("Could not save display", "تعذر حفظ الشاشة"));
    } finally {
      setAdminBusy(false);
    }
  };

  const remove = async (id: string) => {
    await save(paired.filter((entry) => entry.id !== id));
    if (active?.id === id) { setActive(null); setRemote(null); }
  };

  if (active) {
    const s = remote?.settings || {};
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => { setActive(null); setRemote(null); }} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <BrandMark size={48} />
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>DISPLAY ADMIN</Text><Text style={styles.title} numberOfLines={1}>{active.name}</Text></View>
        </View>
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>{t("Connected display", "الشاشة المتصلة")}</Text>
          <Text style={styles.statusName}>{active.name}</Text>
          <Text style={styles.statusMeta}>📍 {active.location || locationFromSettings(s) || t("Location not set", "الموقع غير محدد")}</Text>
          <Text style={styles.statusMeta}>{t("Pair code", "رمز الربط")}: {active.code}</Text>
          {active.lastSeenAt ? <Text style={styles.statusMeta}>{t("Last seen", "آخر اتصال")}: {active.lastSeenAt}</Text> : null}
        </View>

        {adminBusy && !remote ? <View style={styles.loadingRow}><ActivityIndicator /><Text>{t("Loading admin panel…", "جارٍ تحميل لوحة الإدارة…")}</Text></View> : null}
        {remote ? <View style={styles.card}>
          <Text style={styles.label}>{t("DISPLAY NAME", "اسم الشاشة")}</Text>
          <TextInput value={remote.name} onChangeText={(name) => setRemote((cur) => cur ? { ...cur, name: name.slice(0, 40) } : cur)} style={styles.input} />
          <Text style={styles.label}>{t("MASJID NAME", "اسم المسجد")}</Text>
          <TextInput value={String(s.mosqueName || "")} onChangeText={(v) => updateRemote("mosqueName", v)} style={styles.input} />
          <Text style={styles.label}>{t("LOCATION", "الموقع")}</Text>
          <TextInput value={String(s.mosqueLocation || "")} onChangeText={(v) => updateRemote("mosqueLocation", v)} placeholder={t("City / masjid location", "المدينة / موقع المسجد")} placeholderTextColor="#91a39d" style={styles.input} />
          {[
            ["showClock", t("Show clock", "إظهار الساعة")],
            ["showDate", t("Show date", "إظهار التاريخ")],
            ["showNextPrayer", t("Show next prayer", "إظهار الصلاة القادمة")],
            ["showPrayerCards", t("Show prayer cards", "إظهار بطاقات الصلاة")],
            ["showAnnouncements", t("Show announcements", "إظهار الإعلانات")],
            ["showDonation", t("Show donation panel", "إظهار لوحة التبرع")]
          ].map(([key, label]) => (
            <View key={String(key)} style={styles.switchRow}><Text style={styles.switchText}>{label}</Text><Switch value={s[String(key)] !== false} onValueChange={(v) => updateRemote(String(key), v)} /></View>
          ))}
          <Pressable onPress={saveAdmin} disabled={adminBusy} style={[styles.connect, adminBusy && styles.disabled]}>
            {adminBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.connectText}>{t("Save to display", "حفظ على الشاشة")}</Text>}
          </Pressable>
          {adminMessage ? <Text style={styles.message}>{adminMessage}</Text> : null}
        </View> : null}
        <Pressable onPress={() => void remove(active.id)} style={styles.dangerButton}><Text style={styles.dangerText}>{t("Remove this display from phone", "حذف هذه الشاشة من الهاتف")}</Text></Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <BrandMark size={48} />
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>WALL & MASJID DISPLAY</Text><Text style={styles.title}>{t("Connect a display", "ربط شاشة")}</Text></View>
      </View>
      <Text style={styles.subtitle}>{t("Scan the QR code shown on the display, or enter its 6-digit pairing code. Saved displays appear below with their name and location.", "امسح رمز QR الظاهر على الشاشة أو أدخل رمز الربط المكوّن من 6 أرقام. تظهر الشاشات المحفوظة أدناه مع الاسم والموقع.")}</Text>

      <View style={styles.scanRow}>
        <Pressable onPress={() => void openScanner()} style={styles.scanButton}><Text style={styles.scanIcon}>▣</Text><Text style={styles.scanText}>{t("Scan QR code", "مسح رمز QR")}</Text></Pressable>
        <View style={styles.orPill}><Text style={styles.orText}>{t("OR", "أو")}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t("6-DIGIT PAIRING CODE", "رمز الربط المكوّن من 6 أرقام")}</Text>
        <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor="#91a39d" style={styles.codeInput} />
        <Text style={styles.label}>{t("THIS PHONE / CONTROLLER", "اسم هذا الهاتف / وحدة التحكم")}</Text>
        <TextInput value={controllerName} onChangeText={setControllerName} maxLength={50} style={styles.input} />
        <Pressable onPress={pair} disabled={!valid || busy} style={[styles.connect, (!valid || busy) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.connectText}>{t("Pair display", "ربط الشاشة")}</Text>}
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t("CONNECTED DISPLAYS", "الشاشات المتصلة")}</Text><Pressable onPress={() => void refreshSaved(paired)}><Text style={styles.refreshText}>↻ {t("Refresh", "تحديث")}</Text></Pressable></View>
      {paired.length ? paired.map((item) => (
        <Pressable key={item.id} onPress={() => void openAdmin(item)} style={styles.savedCard}>
          <View style={styles.deviceIcon}><Text style={styles.deviceEmoji}>🕌</Text></View>
          <View style={styles.savedCopy}>
            <Text style={styles.savedName}>{item.name}</Text>
            <Text style={styles.savedLocation}>📍 {item.location || t("Location not set", "الموقع غير محدد")}</Text>
            <Text style={styles.savedMeta}>{t("Tap to open admin panel", "اضغط لفتح لوحة الإدارة")}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )) : <View style={styles.empty}><Text style={styles.emptyText}>{t("No connected displays yet. Scan a QR code or enter the 6-digit code above.", "لا توجد شاشات متصلة بعد. امسح رمز QR أو أدخل الرمز المكوّن من 6 أرقام أعلاه.")}</Text></View>}

      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.scannerRoot}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScanned} />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerTitle}>{t("Scan Hassoun display QR code", "امسح رمز QR لشاشة حسّون")}</Text>
            <View style={styles.scanFrame} />
            <Pressable onPress={() => setScannerOpen(false)} style={styles.closeScanner}><Text style={styles.closeScannerText}>{t("Cancel", "إلغاء")}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" },
  content: { padding: 18, paddingBottom: 42 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd9d0", alignItems: "center", justifyContent: "center" },
  backText: { color: "#0b5b47", fontSize: 30, lineHeight: 32, fontWeight: "800" },
  headerCopy: { flex: 1 }, eyebrow: { color: "#9b7a39", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  title: { color: "#173f35", fontSize: 23, fontWeight: "900", marginTop: 2 },
  subtitle: { color: "#74817c", fontSize: 12, lineHeight: 18, marginTop: 14 },
  scanRow: { marginTop: 18, alignItems: "center" },
  scanButton: { minHeight: 58, width: "100%", borderRadius: 18, backgroundColor: "#0b654f", flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  scanIcon: { color: "#f4d078", fontSize: 25, fontWeight: "900" }, scanText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  orPill: { marginTop: -1, backgroundColor: "#f7f4ec", paddingHorizontal: 12, paddingVertical: 4 }, orText: { color: "#8f8c84", fontSize: 9, fontWeight: "900" },
  card: { marginTop: 8, borderRadius: 23, backgroundColor: "#0b3b33", padding: 16, borderWidth: 1, borderColor: "#8a7548" },
  label: { color: "#e4c576", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 10, marginBottom: 6 },
  codeInput: { minHeight: 62, borderRadius: 15, borderWidth: 1, borderColor: "#52786d", backgroundColor: "#082b26", color: "#f2cb73", fontSize: 28, fontWeight: "900", letterSpacing: 7, textAlign: "center" },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#52786d", backgroundColor: "#082b26", color: "#fff", fontSize: 15, paddingHorizontal: 12 },
  connect: { minHeight: 50, borderRadius: 999, backgroundColor: "#0b654f", marginTop: 18, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: .45 }, connectText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  message: { color: "#dff4ea", fontSize: 11, lineHeight: 16, marginTop: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 8 },
  sectionTitle: { color: "#8f7136", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, refreshText: { color: "#0b654f", fontSize: 10, fontWeight: "900" },
  savedCard: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 19, borderWidth: 1, borderColor: "#dfddd5", padding: 13, marginBottom: 9 },
  deviceIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#e7f2ec", alignItems: "center", justifyContent: "center" }, deviceEmoji: { fontSize: 23 },
  savedCopy: { flex: 1 }, savedName: { color: "#173f35", fontSize: 15, fontWeight: "900" }, savedLocation: { color: "#667b73", fontSize: 10, marginTop: 4 }, savedMeta: { color: "#9a9f9b", fontSize: 8.5, marginTop: 4 }, chevron: { color: "#0b654f", fontSize: 30, fontWeight: "500" },
  empty: { minHeight: 86, borderRadius: 18, backgroundColor: "#eeeae1", padding: 18, alignItems: "center", justifyContent: "center" }, emptyText: { color: "#7a8580", fontSize: 11, lineHeight: 17, textAlign: "center" },
  statusCard: { marginTop: 18, borderRadius: 20, backgroundColor: "#e7f2ec", borderWidth: 1, borderColor: "#cadfd4", padding: 15 }, statusTitle: { color: "#8f7136", fontSize: 8, fontWeight: "900", letterSpacing: 1 }, statusName: { color: "#173f35", fontSize: 20, fontWeight: "900", marginTop: 4 }, statusMeta: { color: "#60756d", fontSize: 10, marginTop: 5 },
  switchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#31594f" }, switchText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  loadingRow: { minHeight: 90, alignItems: "center", justifyContent: "center", gap: 10 },
  dangerButton: { minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: "#caa59d", alignItems: "center", justifyContent: "center", marginTop: 16 }, dangerText: { color: "#8f4d40", fontSize: 11, fontWeight: "900" },
  scannerRoot: { flex: 1, backgroundColor: "#000" }, scannerOverlay: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingTop: 80, paddingBottom: 50, backgroundColor: "rgba(0,0,0,.25)" }, scannerTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center", paddingHorizontal: 22 }, scanFrame: { width: 260, height: 260, borderWidth: 4, borderColor: "#e4c576", borderRadius: 26, backgroundColor: "transparent" }, closeScanner: { minWidth: 160, minHeight: 50, borderRadius: 999, backgroundColor: "rgba(255,255,255,.92)", alignItems: "center", justifyContent: "center" }, closeScannerText: { color: "#173f35", fontSize: 14, fontWeight: "900" }
});
''', encoding="utf-8")

print("Added QR/manual Wall & Masjid pairing, connected device location cards, and native admin panel")
