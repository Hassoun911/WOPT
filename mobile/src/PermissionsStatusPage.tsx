import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { canScheduleAndroidExactAlarms, openExactAlarmSettings } from "./prayerAudio";

type Props = { locale: "en" | "ar"; onBack: () => void };
type Status = {
  location: boolean;
  notifications: boolean;
  exactAlarm: boolean;
  camera: boolean;
  microphone: boolean;
};

const emptyStatus: Status = {
  location: false,
  notifications: false,
  exactAlarm: false,
  camera: false,
  microphone: false
};

export default function PermissionsStatusPage({ locale, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [status, setStatus] = useState<Status>(emptyStatus);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (Platform.OS !== "android") return;
    const notifications = Number(Platform.Version) < 33
      ? true
      : await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    const [location, camera, microphone] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
    ]);
    setStatus({
      location,
      notifications,
      exactAlarm: canScheduleAndroidExactAlarms(),
      camera,
      microphone
    });
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setTimeout(() => void refresh(), 250);
    });
    return () => sub.remove();
  }, [refresh]);

  const request = async (key: keyof Status) => {
    if (Platform.OS !== "android" || busy) return;
    if (key === "exactAlarm") {
      openExactAlarmSettings();
      return;
    }
    const permission = key === "location"
      ? PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      : key === "camera"
        ? PermissionsAndroid.PERMISSIONS.CAMERA
        : key === "microphone"
          ? PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          : PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    setBusy(key);
    try {
      await PermissionsAndroid.request(permission);
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const rows: Array<[keyof Status, string, string, string]> = [
    ["location", "📍", t("Location", "الموقع"), t("Current city, local prayer times and Qibla.", "المدينة الحالية ومواقيت الصلاة المحلية والقبلة.")],
    ["notifications", "🔔", t("Notifications", "الإشعارات"), t("20-minute, 10-minute and prayer-time alerts.", "تنبيهات ٢٠ دقيقة و١٠ دقائق ووقت الصلاة.")],
    ["exactAlarm", "⏰", t("Alarms & reminders", "المنبهات والتذكيرات"), t("Lets the full Adhan start at the exact prayer time, even when Hassoun is closed.", "يسمح ببدء الأذان الكامل في وقت الصلاة المحدد حتى عند إغلاق حسّون.")],
    ["camera", "📷", t("Camera", "الكاميرا"), t("Only used when you scan a Masjid display QR code.", "تُستخدم فقط عند مسح رمز QR الخاص بشاشة المسجد.")],
    ["microphone", "🎙️", t("Microphone", "الميكروفون"), t("Used only for Qur’an recitation practice features.", "يُستخدم فقط لميزات تدريب تلاوة القرآن.")]
  ];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>HASSOUN • ANDROID</Text>
          <Text style={styles.title}>{t("Permissions", "الأذونات")}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>{t("See exactly what Hassoun can use on this phone. Anything missing can be enabled here.", "شاهد بالضبط ما هو مسموح لحسّون على هذا الهاتف. يمكنك تفعيل أي إذن ناقص من هنا.")}</Text>

      {rows.map(([key, emoji, title, description]) => {
        const enabled = status[key];
        return (
          <View key={key} style={styles.card}>
            <View style={styles.icon}><Text style={styles.iconText}>{emoji}</Text></View>
            <View style={styles.copy}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>{title}</Text>
                <View style={[styles.badge, enabled ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={[styles.badgeText, enabled ? styles.badgeTextOn : styles.badgeTextOff]}>{enabled ? t("ENABLED", "مفعّل") : t("NOT ENABLED", "غير مفعّل")}</Text>
                </View>
              </View>
              <Text style={styles.description}>{description}</Text>
              {!enabled ? (
                <Pressable disabled={busy === key} onPress={() => void request(key)} style={styles.enableButton}>
                  <Text style={styles.enableText}>{busy === key ? t("Opening…", "جارٍ الفتح…") : key === "exactAlarm" ? t("Open Alarms & reminders", "فتح المنبهات والتذكيرات") : t("Enable now", "تفعيل الآن")}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      <Pressable onPress={() => void refresh()} style={styles.refreshButton}><Text style={styles.refreshText}>{t("Refresh permission status", "تحديث حالة الأذونات")}</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" },
  content: { padding: 18, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd9cf", alignItems: "center", justifyContent: "center" },
  backText: { color: "#0b654f", fontSize: 30, lineHeight: 32, fontWeight: "900" },
  eyebrow: { color: "#9b7a39", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: "#173f35", fontSize: 23, fontWeight: "900", marginTop: 2 },
  subtitle: { color: "#6f7c77", fontSize: 12, lineHeight: 18, marginTop: 14, marginBottom: 14 },
  card: { flexDirection: "row", gap: 12, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#deddd6", padding: 14, marginBottom: 10 },
  icon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#eef5f1", alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 22 },
  copy: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeOn: { backgroundColor: "#e6f5ee" },
  badgeOff: { backgroundColor: "#fff0e7" },
  badgeText: { fontSize: 7, fontWeight: "900", letterSpacing: .5 },
  badgeTextOn: { color: "#0b6b51" },
  badgeTextOff: { color: "#a05432" },
  description: { color: "#78827e", fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  enableButton: { alignSelf: "flex-start", marginTop: 10, minHeight: 36, borderRadius: 11, paddingHorizontal: 12, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" },
  enableText: { color: "#fff", fontSize: 9.5, fontWeight: "900" },
  refreshButton: { marginTop: 8, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#0b654f", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#0b654f", fontSize: 11, fontWeight: "900" }
});
