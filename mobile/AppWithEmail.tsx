import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
  useSafeAreaInsets
} from "react-native-safe-area-context";
import App from "./App";
import EmailSignupCard, { type EmailSignupCompletion } from "./src/EmailSignupCard";
import { STORAGE_KEYS } from "./src/config";
import { configureNotificationChannels } from "./src/notifications";
import { registerDeviceForServerPush } from "./src/push";

function AppWithEmailShell() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [completion, setCompletion] = useState<EmailSignupCompletion | null>(null);

  useEffect(() => {
    void (async () => {
      await configureNotificationChannels();
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);
      const currentLocale = saved === "ar" ? "ar" : "en";
      setLocale(currentLocale);

      const permission = await Notifications.getPermissionsAsync();
      if (permission.granted) {
        await registerDeviceForServerPush(currentLocale).catch(() => undefined);
      }
    })().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!completion) return;
    const timer = setTimeout(() => setCompletion(null), 14000);
    return () => clearTimeout(timer);
  }, [completion]);

  const open = async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);
    setLocale(saved === "ar" ? "ar" : "en");
    setCompletion(null);
    setVisible(true);
  };

  const completeSignup = (summary: EmailSignupCompletion) => {
    setVisible(false);
    setCompletion(summary);
  };

  const receiptTop = Math.max(insets.top, 12) + 12;

  return (
    <View style={styles.root}>
      <App onOpenEmailAlerts={() => void open()} />

      {completion ? (
        <View style={[styles.receipt, { top: receiptTop }]}>
          <View style={styles.receiptTopRow}>
            <View style={styles.receiptCheck}><Text style={styles.receiptCheckText}>✓</Text></View>
            <View style={styles.receiptHeadingWrap}>
              <Text style={styles.receiptEyebrow}>WOPT EMAIL ALERTS</Text>
              <Text style={styles.receiptTitle}>
                {completion.alreadySubscribed
                  ? (locale === "ar" ? "تم إرسال رابط إدارة آمن" : "Manage link sent")
                  : (locale === "ar" ? "تم إرسال رسالة التأكيد" : "Confirmation email sent")}
              </Text>
            </View>
            <Pressable onPress={() => setCompletion(null)} style={styles.receiptClose}>
              <Text style={styles.receiptCloseText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.receiptDetails}>
            <View style={styles.receiptLine}>
              <Text style={styles.receiptLabel}>{locale === "ar" ? "البريد" : "Email"}</Text>
              <Text style={styles.receiptValue} numberOfLines={1}>{completion.email}</Text>
            </View>
            <View style={styles.receiptLine}>
              <Text style={styles.receiptLabel}>{locale === "ar" ? "موقع الصلاة" : "Prayer location"}</Text>
              <Text style={styles.receiptValue}>{completion.location}</Text>
            </View>
            <View style={styles.receiptLine}>
              <Text style={styles.receiptLabel}>{locale === "ar" ? "التنبيهات" : "Alerts"}</Text>
              <Text style={styles.receiptValue}>{completion.timing}</Text>
            </View>
          </View>

          <Text style={styles.receiptMessage}>
            {completion.alreadySubscribed
              ? (locale === "ar"
                  ? "افتح بريدك لإدارة تنبيهات الصلاة."
                  : "Open your email to manage your prayer alerts.")
              : (locale === "ar"
                  ? "افتح بريدك واضغط تأكيد التنبيهات لتفعيل الاشتراك."
                  : "Open your inbox and tap “Confirm email alerts” to activate your subscription.")}
          </Text>
        </View>
      ) : null}

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>WOPT</Text>
              <Text style={styles.modalTitle}>
                {locale === "ar" ? "تنبيهات الصلاة عبر البريد" : "Prayer email alerts"}
              </Text>
            </View>
            <Pressable onPress={() => setVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
              <Text style={styles.closeText}>{locale === "ar" ? "إغلاق" : "Close"}</Text>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{locale === "ar" ? "لا تفوّت أي صلاة" : "Never miss a prayer"}</Text>
              <Text style={styles.heroBody}>
                {locale === "ar"
                  ? "تنبيهات البريد تتبع موقعك ومواقيت الصلاة المحلية تلقائياً."
                  : "Prayer email alerts follow your location and local prayer times automatically."}
              </Text>
            </View>
            <View style={styles.heroIllustration}>
              <View style={styles.heroMoon}><Text style={styles.heroMoonText}>☾</Text></View>
              <View style={styles.heroDome}><Text style={styles.heroDomeText}>و</Text></View>
            </View>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 18) + 28 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <EmailSignupCard locale={locale} onComplete={completeSignup} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export default function AppWithEmail() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppWithEmailShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  receipt: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: "#fffdf8",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#d7dfd4",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16
  },
  receiptTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  receiptCheck: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#d9eee5", alignItems: "center", justifyContent: "center" },
  receiptCheckText: { color: "#087052", fontSize: 22, fontWeight: "900" },
  receiptHeadingWrap: { flex: 1 },
  receiptEyebrow: { color: "#8a806f", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  receiptTitle: { color: "#153f35", fontSize: 17, fontWeight: "900", marginTop: 2 },
  receiptClose: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#f2eee5", alignItems: "center", justifyContent: "center" },
  receiptCloseText: { color: "#4c5c56", fontSize: 14, fontWeight: "900" },
  receiptDetails: { backgroundColor: "#f8f4eb", borderRadius: 15, padding: 12, marginTop: 13, gap: 8 },
  receiptLine: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  receiptLabel: { width: 88, color: "#81796c", fontSize: 11, fontWeight: "800" },
  receiptValue: { flex: 1, color: "#254d43", fontSize: 11, fontWeight: "800" },
  receiptMessage: { color: "#5d7069", fontSize: 11, lineHeight: 17, marginTop: 11 },
  modalSafe: { flex: 1, backgroundColor: "#f6f0e5" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 },
  modalEyebrow: { color: "#9a8a70", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  modalTitle: { color: "#153f35", fontSize: 22, fontWeight: "900", marginTop: 2 },
  closeButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1.5, borderColor: "#cbbda7", borderRadius: 15, backgroundColor: "#fffdf8", paddingHorizontal: 13 },
  closeIcon: { color: "#173f35", fontSize: 13, fontWeight: "900" },
  closeText: { color: "#173f35", fontSize: 12, fontWeight: "900" },
  heroCard: { marginHorizontal: 16, marginTop: 4, borderRadius: 22, backgroundColor: "#efe6d5", borderWidth: 1, borderColor: "#dfd2bc", padding: 17, flexDirection: "row", alignItems: "center", gap: 12 },
  heroCopy: { flex: 1 },
  heroTitle: { color: "#173f35", fontSize: 24, lineHeight: 28, fontWeight: "900" },
  heroBody: { color: "#756d60", fontSize: 12, lineHeight: 18, marginTop: 6 },
  heroIllustration: { width: 82, height: 82, borderRadius: 24, backgroundColor: "#f8f4eb", alignItems: "center", justifyContent: "center", position: "relative" },
  heroMoon: { position: "absolute", right: 8, top: 5 },
  heroMoonText: { color: "#bf9a55", fontSize: 25, fontWeight: "800" },
  heroDome: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#dce8dc", alignItems: "center", justifyContent: "center", marginTop: 14 },
  heroDomeText: { color: "#0b6a53", fontSize: 28, fontWeight: "900" },
  modalScroll: { flex: 1 },
  modalContent: { paddingHorizontal: 16, paddingTop: 14 }
});
