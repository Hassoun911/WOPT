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
import EmailSignupCard from "./src/EmailSignupCard";
import { STORAGE_KEYS } from "./src/config";
import { configureNotificationChannels } from "./src/notifications";
import { registerDeviceForServerPush } from "./src/push";

function AppWithEmailShell() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">("en");

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

  const open = async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);
    setLocale(saved === "ar" ? "ar" : "en");
    setVisible(true);
  };

  const launcherBottom = Math.max(insets.bottom, 10) + 12;

  return (
    <View style={styles.root}>
      <App />

      <Pressable
        onPress={() => void open()}
        accessibilityRole="button"
        accessibilityLabel={locale === "ar" ? "تنبيهات الصلاة عبر البريد" : "Prayer email alerts"}
        style={({ pressed }) => [
          styles.floatingButton,
          { bottom: launcherBottom },
          pressed && styles.floatingButtonPressed
        ]}
      >
        <View style={styles.floatingIconWrap}>
          <Text style={styles.floatingIcon}>✉</Text>
        </View>
        <View style={styles.floatingCopy}>
          <Text style={styles.floatingTitle}>
            {locale === "ar" ? "تنبيهات الصلاة عبر البريد" : "Prayer email alerts"}
          </Text>
          <Text style={styles.floatingSubtitle} numberOfLines={1}>
            {locale === "ar" ? "حسب موقعك ومواقيت الصلاة المحلية" : "Automatic local prayer times wherever you are"}
          </Text>
        </View>
        <Text style={styles.floatingArrow}>{locale === "ar" ? "‹" : "›"}</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalHero}>
            <View style={styles.modalBrandRow}>
              <View style={styles.modalLogo}>
                <Text style={styles.modalLogoText}>و</Text>
              </View>
              <View style={styles.modalHeadingWrap}>
                <Text style={styles.modalEyebrow}>WOPT</Text>
                <Text style={styles.modalTitle}>
                  {locale === "ar" ? "تنبيهات الصلاة عبر البريد" : "Prayer email alerts"}
                </Text>
              </View>
              <Pressable onPress={() => setVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.modalIntro}>
              {locale === "ar"
                ? "اشترك مرة واحدة وسنستخدم موقع هاتفك تلقائياً لتحديد مواقيت الصلاة والمنطقة الزمنية الصحيحة."
                : "Subscribe once. WOPT automatically uses your phone location to match the correct prayer times and time zone."}
            </Text>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 18) + 28 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <EmailSignupCard locale={locale} />
            <View style={styles.privacyCard}>
              <Text style={styles.privacyIcon}>◎</Text>
              <Text style={styles.privacyNote}>
                {locale === "ar"
                  ? "يُستخدم موقعك فقط لضبط مواقيت الصلاة والمنطقة الزمنية عند الاشتراك أو تحديث الموقع. لا يتتبع WOPT موقعك بشكل مستمر."
                  : "Your location is used only to set prayer times and your time zone when you subscribe or refresh location. WOPT does not continuously track you."}
              </Text>
            </View>
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
  floatingButton: {
    position: "absolute",
    left: 18,
    right: 18,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0b5b47",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
    zIndex: 50
  },
  floatingButtonPressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  floatingIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center"
  },
  floatingIcon: { color: "#fff", fontSize: 18, fontWeight: "900" },
  floatingCopy: { flex: 1, minWidth: 0 },
  floatingTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  floatingSubtitle: { color: "#d6e9e3", fontSize: 11, fontWeight: "600", marginTop: 2 },
  floatingArrow: { color: "#fff", fontSize: 27, lineHeight: 28, fontWeight: "400", opacity: 0.9 },
  modalSafe: { flex: 1, backgroundColor: "#f5f2e9" },
  modalHero: {
    backgroundColor: "#0b5b47",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  },
  modalBrandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalLogo: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#f3c96b",
    alignItems: "center",
    justifyContent: "center"
  },
  modalLogoText: { color: "#0b5b47", fontSize: 27, fontWeight: "900" },
  modalHeadingWrap: { flex: 1 },
  modalEyebrow: { color: "#cfe3dc", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 2 },
  modalIntro: { color: "#d6e9e3", fontSize: 13, lineHeight: 19, marginTop: 15, paddingRight: 8 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  modalScroll: { flex: 1 },
  modalContent: { paddingHorizontal: 16, paddingTop: 16 },
  privacyCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#e8f1ed",
    borderRadius: 18,
    padding: 14,
    marginTop: 12
  },
  privacyIcon: { color: "#0b5b47", fontSize: 19, fontWeight: "900", marginTop: 1 },
  privacyNote: { flex: 1, color: "#667b74", fontSize: 11, lineHeight: 17 }
});
