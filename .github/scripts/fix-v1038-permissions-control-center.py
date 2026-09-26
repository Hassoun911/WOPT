from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "mobile/src/PermissionsStatusPage.tsx"

PAGE.write_text(r'''import { useCallback, useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import {
  AppState,
  Linking,
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
type LocationLevel = "off" | "approximate" | "precise";
type Status = {
  location: LocationLevel;
  notifications: boolean;
  exactAlarm: boolean;
  camera: boolean;
  microphone: boolean;
};

const emptyStatus: Status = {
  location: "off",
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
    const [fine, coarse, camera, microphone, notificationPermission] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO),
      Notifications.getPermissionsAsync()
    ]);
    setStatus({
      location: fine ? "precise" : coarse ? "approximate" : "off",
      notifications: Number(Platform.Version) < 33 ? notificationPermission.status !== "denied" : notificationPermission.granted,
      exactAlarm: canScheduleAndroidExactAlarms(),
      camera,
      microphone
    });
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setTimeout(() => void refresh(), 300);
    });
    return () => sub.remove();
  }, [refresh]);

  const openAppSettings = async () => {
    try { await Linking.openSettings(); } catch {}
  };

  const openLocationServices = async () => {
    try {
      await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
    } catch {
      await openAppSettings();
    }
  };

  const requestLocation = async () => {
    if (busy) return;
    setBusy("location");
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      ]);
      const fine = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const coarse = result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
      if (fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN || coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        await openAppSettings();
      }
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const requestNotifications = async () => {
    if (busy) return;
    setBusy("notifications");
    try {
      const result = await Notifications.requestPermissionsAsync();
      if (!result.granted && result.canAskAgain === false) await openAppSettings();
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const requestRuntime = async (key: "camera" | "microphone") => {
    if (busy) return;
    const permission = key === "camera" ? PermissionsAndroid.PERMISSIONS.CAMERA : PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    setBusy(key);
    try {
      const result = await PermissionsAndroid.request(permission);
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) await openAppSettings();
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const permissionCard = (
    key: string,
    emoji: string,
    title: string,
    description: string,
    enabled: boolean,
    actionLabel: string,
    action: () => void,
    secondaryLabel?: string,
    secondaryAction?: () => void
  ) => (
    <View key={key} style={styles.card}>
      <View style={styles.icon}><Text style={styles.iconText}>{emoji}</Text></View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle}>{title}</Text>
          <View style={[styles.badge, enabled ? styles.badgeOn : styles.badgeOff]}>
            <Text style={[styles.badgeText, enabled ? styles.badgeTextOn : styles.badgeTextOff]}>
              {enabled ? t("ENABLED", "مفعّل") : t("OFF / NEEDS ATTENTION", "متوقف / يحتاج انتباه")}
            </Text>
          </View>
        </View>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.actions}>
          <Pressable disabled={busy === key} onPress={action} style={styles.enableButton}>
            <Text style={styles.enableText}>{busy === key ? t("Checking…", "جارٍ التحقق…") : actionLabel}</Text>
          </Pressable>
          {secondaryLabel && secondaryAction ? (
            <Pressable onPress={secondaryAction} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  const locationEnabled = status.location !== "off";
  const locationLabel = status.location === "precise"
    ? t("Precise location is allowed. Hassoun can use exact GPS coordinates for local prayer times.", "الموقع الدقيق مسموح. يمكن لحسّون استخدام إحداثيات GPS الدقيقة لمواقيت الصلاة المحلية.")
    : status.location === "approximate"
      ? t("Approximate location is allowed. Enable Precise location for the most accurate automatic prayer source.", "الموقع التقريبي مسموح. فعّل الموقع الدقيق للحصول على أدق مصدر تلقائي لمواقيت الصلاة.")
      : t("Location is off. Hassoun needs it for automatic local prayer times, Qibla and nearby mosques.", "الموقع متوقف. يحتاجه حسّون للمواقيت المحلية التلقائية والقبلة والمساجد القريبة.");

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>HASSOUN • ANDROID</Text>
          <Text style={styles.title}>{t("Permissions", "الأذونات")}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>{t("Live status and controls for every phone permission Hassoun uses. Enable missing access here, or open Android settings to change or disable access that is already enabled.", "حالة مباشرة وتحكم بكل إذن يستخدمه حسّون. فعّل الأذونات الناقصة من هنا أو افتح إعدادات Android لتغيير أو تعطيل الإذن المفعّل.")}</Text>

      {permissionCard(
        "location", "📍", t("Location", "الموقع"), locationLabel, locationEnabled,
        status.location === "precise" ? t("Manage / Disable", "إدارة / تعطيل") : status.location === "approximate" ? t("Enable precise location", "تفعيل الموقع الدقيق") : t("Enable location", "تفعيل الموقع"),
        () => { if (status.location === "precise") void openAppSettings(); else void requestLocation(); },
        t("Location Services", "خدمات الموقع"), () => { void openLocationServices(); }
      )}

      {permissionCard(
        "notifications", "🔔", t("Notifications", "الإشعارات"),
        t("Prayer reminders, Adhan notifications, Islamic-event reminders and other Hassoun alerts.", "تنبيهات الصلاة وإشعارات الأذان والمناسبات الإسلامية وتنبيهات حسّون الأخرى."),
        status.notifications,
        status.notifications ? t("Manage / Disable", "إدارة / تعطيل") : t("Enable notifications", "تفعيل الإشعارات"),
        () => { if (status.notifications) void openAppSettings(); else void requestNotifications(); }
      )}

      {permissionCard(
        "exactAlarm", "⏰", t("Alarms & reminders", "المنبهات والتذكيرات"),
        t("Special Android access that lets the full Adhan start at the exact prayer time, including while Hassoun is closed or the phone is locked.", "إذن Android خاص يسمح ببدء الأذان الكامل في وقت الصلاة المحدد حتى عند إغلاق حسّون أو قفل الهاتف."),
        status.exactAlarm,
        status.exactAlarm ? t("Manage / Disable", "إدارة / تعطيل") : t("Enable Alarms & reminders", "تفعيل المنبهات والتذكيرات"),
        () => openExactAlarmSettings()
      )}

      {permissionCard(
        "camera", "📷", t("Camera", "الكاميرا"),
        t("Used only when you choose to scan a QR code for a Masjid / wall display.", "تستخدم فقط عندما تختار مسح رمز QR لشاشة المسجد أو الحائط."),
        status.camera,
        status.camera ? t("Manage / Disable", "إدارة / تعطيل") : t("Enable camera", "تفعيل الكاميرا"),
        () => { if (status.camera) void openAppSettings(); else void requestRuntime("camera"); }
      )}

      {permissionCard(
        "microphone", "🎙️", t("Microphone", "الميكروفون"),
        t("Used only for Qur’an recitation and memorization practice features that listen to your recitation.", "يستخدم فقط لميزات تلاوة القرآن وتدريب الحفظ التي تستمع إلى تلاوتك."),
        status.microphone,
        status.microphone ? t("Manage / Disable", "إدارة / تعطيل") : t("Enable microphone", "تفعيل الميكروفون"),
        () => { if (status.microphone) void openAppSettings(); else void requestRuntime("microphone"); }
      )}

      <View style={styles.systemCard}>
        <Text style={styles.systemTitle}>{t("System-managed access", "أذونات يديرها النظام")}</Text>
        <Text style={styles.systemText}>{t("Hassoun also declares the Android access needed for vibration, wake lock, foreground audio service and restoring prayer schedules after a reboot. Android grants these at install time; they do not have separate user permission switches.", "يعلن حسّون أيضاً أذونات Android اللازمة للاهتزاز ومنع السكون وخدمة الصوت في الخلفية واستعادة جداول الصلاة بعد إعادة التشغيل. يمنح Android هذه عند التثبيت ولا توجد لها مفاتيح أذونات منفصلة للمستخدم.")}</Text>
      </View>

      <Pressable onPress={() => void refresh()} style={styles.refreshButton}><Text style={styles.refreshText}>{t("Refresh all permission status", "تحديث حالة جميع الأذونات")}</Text></Pressable>
      <Text style={styles.note}>{t("Android does not let an app revoke most permissions itself. When access is already enabled, Manage / Disable opens Android's app settings so you remain in control.", "لا يسمح Android للتطبيق بإلغاء معظم الأذونات بنفسه. عندما يكون الإذن مفعلاً يفتح زر إدارة / تعطيل إعدادات التطبيق في Android لتبقى أنت المتحكم.")}</Text>
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
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  enableButton: { minHeight: 36, borderRadius: 11, paddingHorizontal: 12, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" },
  enableText: { color: "#fff", fontSize: 9.5, fontWeight: "900" },
  secondaryButton: { minHeight: 36, borderRadius: 11, paddingHorizontal: 12, backgroundColor: "#edf5f1", borderWidth: 1, borderColor: "#cfe0d8", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#0b654f", fontSize: 9.5, fontWeight: "900" },
  systemCard: { borderRadius: 18, padding: 14, marginBottom: 10, backgroundColor: "#f0ece1", borderWidth: 1, borderColor: "#dfd7c5" },
  systemTitle: { color: "#665323", fontSize: 11, fontWeight: "900" },
  systemText: { color: "#7a7058", fontSize: 9.5, lineHeight: 15, marginTop: 5 },
  refreshButton: { marginTop: 5, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#0b654f", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#0b654f", fontSize: 11, fontWeight: "900" },
  note: { color: "#7b8782", fontSize: 9.5, lineHeight: 15, marginTop: 10, textAlign: "center" }
});
''', encoding="utf-8")

print("Installed Android v1.0.38 functional permissions control center")
