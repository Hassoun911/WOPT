import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandMark from "./BrandMark";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const STORAGE_KEY = "hassoun:paired-displays:v2";

type Display = { id: string; code: string; name: string; token: string; pairedAt: string };
type Props = { locale: "en" | "ar"; onBack: () => void };

export default function ConnectDisplayPage({ locale, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("Masjid Display");
  const [controllerName, setControllerName] = useState("Hassoun Android");
  const [paired, setPaired] = useState<Display[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const valid = useMemo(() => /^\d{6}$/.test(code), [code]);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!value) return;
      try { setPaired(JSON.parse(value) as Display[]); } catch {}
    });
  }, []);

  const save = async (next: Display[]) => {
    setPaired(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

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
      const data = await response.json() as { ok?: boolean; deviceId?: string; name?: string; token?: string; error?: string };
      if (!response.ok || !data.ok || !data.deviceId || !data.token) throw new Error(data.error || t("Could not pair display", "تعذر ربط الشاشة"));
      const item: Display = {
        id: data.deviceId,
        code,
        name: (displayName.trim() || data.name || "Masjid Display").slice(0, 40),
        token: data.token,
        pairedAt: new Date().toISOString()
      };
      const next = [item, ...paired.filter((entry) => entry.id !== item.id)];
      await save(next);
      if (item.name !== data.name) {
        await fetch(`${API}/masjid-displays/control/${encodeURIComponent(item.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${item.token}` },
          body: JSON.stringify({ name: item.name })
        }).catch(() => undefined);
      }
      setCode("");
      setMessage(t("Connected. This display is now saved on this phone.", "تم الاتصال. تم حفظ هذه الشاشة على الهاتف."));
    } catch (error) {
      const text = error instanceof Error ? error.message : t("Could not pair display", "تعذر ربط الشاشة");
      setMessage(text);
      Alert.alert(t("Connection failed", "فشل الاتصال"), text);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => save(paired.filter((entry) => entry.id !== id));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <BrandMark size={48} />
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>HASSOUN DISPLAY</Text><Text style={styles.title}>{t("Connect a TV or display", "ربط تلفاز أو شاشة")}</Text></View>
      </View>
      <Text style={styles.subtitle}>{t("Enter the 6-digit code shown on a Hassoun Masjid TV, iPad, tablet or computer display. The Android app uses the same pairing system as the website.", "أدخل الرمز المكوّن من 6 أرقام الظاهر على شاشة حسّون في المسجد أو التلفاز أو الآيباد أو الكمبيوتر. يستخدم تطبيق أندرويد نفس نظام الربط الموجود في الموقع.")}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{t("PAIRING CODE", "رمز الربط")}</Text>
        <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor="#91a39d" style={styles.codeInput} />
        <Text style={styles.label}>{t("DISPLAY NAME", "اسم الشاشة")}</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} maxLength={40} style={styles.input} />
        <Text style={styles.label}>{t("THIS CONTROLLER", "اسم هذا الجهاز")}</Text>
        <TextInput value={controllerName} onChangeText={setControllerName} maxLength={50} style={styles.input} />
        <Pressable onPress={pair} disabled={!valid || busy} style={[styles.connect, (!valid || busy) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.connectText}>{t("Pair display", "ربط الشاشة")}</Text>}
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>{t("SAVED DISPLAYS", "الشاشات المحفوظة")}</Text>
      {paired.length ? paired.map((item) => (
        <View key={item.id} style={styles.savedCard}>
          <View style={styles.savedCopy}><Text style={styles.savedName}>{item.name}</Text><Text style={styles.savedMeta}>{t("Display ID", "معرّف الشاشة")}: {item.id}</Text></View>
          <Pressable onPress={() => void remove(item.id)} style={styles.remove}><Text style={styles.removeText}>{t("Remove", "حذف")}</Text></Pressable>
        </View>
      )) : <View style={styles.empty}><Text style={styles.emptyText}>{t("No paired displays yet.", "لا توجد شاشات مرتبطة بعد.")}</Text></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" },
  content: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd9d0", alignItems: "center", justifyContent: "center" },
  backText: { color: "#0b5b47", fontSize: 30, lineHeight: 32, fontWeight: "800" },
  headerCopy: { flex: 1 }, eyebrow: { color: "#9b7a39", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  title: { color: "#173f35", fontSize: 23, fontWeight: "900", marginTop: 2 },
  subtitle: { color: "#74817c", fontSize: 12, lineHeight: 18, marginTop: 14 },
  card: { marginTop: 18, borderRadius: 23, backgroundColor: "#0b3b33", padding: 16, borderWidth: 1, borderColor: "#8a7548" },
  label: { color: "#e4c576", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 10, marginBottom: 6 },
  codeInput: { minHeight: 62, borderRadius: 15, borderWidth: 1, borderColor: "#52786d", backgroundColor: "#082b26", color: "#f2cb73", fontSize: 28, fontWeight: "900", letterSpacing: 7, textAlign: "center" },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#52786d", backgroundColor: "#082b26", color: "#fff", fontSize: 15, paddingHorizontal: 12 },
  connect: { minHeight: 50, borderRadius: 999, backgroundColor: "#0b654f", marginTop: 18, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: .45 }, connectText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  message: { color: "#dff4ea", fontSize: 11, lineHeight: 16, marginTop: 12 },
  sectionTitle: { color: "#8f7136", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  savedCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#dfddd5", padding: 13, marginBottom: 8 },
  savedCopy: { flex: 1 }, savedName: { color: "#173f35", fontSize: 14, fontWeight: "900" }, savedMeta: { color: "#89938f", fontSize: 9, marginTop: 3 },
  remove: { borderRadius: 999, backgroundColor: "#f1e7df", paddingHorizontal: 12, paddingVertical: 8 }, removeText: { color: "#8f4d40", fontSize: 9, fontWeight: "900" },
  empty: { minHeight: 70, borderRadius: 18, backgroundColor: "#eeeae1", alignItems: "center", justifyContent: "center" }, emptyText: { color: "#7a8580", fontSize: 11 }
});
