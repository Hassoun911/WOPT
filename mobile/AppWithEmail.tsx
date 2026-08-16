import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import App from "./App";
import EmailSignupCard from "./src/EmailSignupCard";
import { STORAGE_KEYS } from "./src/config";
import { configureNotificationChannels } from "./src/notifications";
import { registerDeviceForServerPush } from "./src/push";

export default function AppWithEmail() {
  const [visible, setVisible] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">("en");

  useEffect(() => {
    void (async () => {
      await configureNotificationChannels();
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);
      const currentLocale = saved === "ar" ? "ar" : "en";
      setLocale(currentLocale);

      // Do not prompt for notification permission here. If the user has already
      // granted permission, make sure the server registration is fresh so admin
      // broadcasts can reach the device even after preferences change.
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

  return (
    <View style={styles.root}>
      <App />
      <Pressable onPress={() => void open()} style={styles.floatingButton}>
        <Text style={styles.floatingIcon}>✉</Text>
        <Text style={styles.floatingText}>{locale === "ar" ? "تنبيهات البريد" : "Email alerts"}</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>WOPT</Text>
              <Text style={styles.modalTitle}>{locale === "ar" ? "تنبيهات الصلاة عبر البريد" : "Prayer email alerts"}</Text>
            </View>
            <Pressable onPress={() => setVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>{locale === "ar" ? "إغلاق" : "Close"}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <EmailSignupCard locale={locale} />
            <Text style={styles.privacyNote}>
              {locale === "ar"
                ? "يُستخدم الموقع فقط لتحديد مواقيت الصلاة المحلية والمنطقة الزمنية عند الاشتراك أو تحديث الموقع. لا توجد متابعة مستمرة للموقع."
                : "Location is used only to set your local prayer times and time zone when you subscribe or refresh your location. WOPT does not continuously track your location."}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  floatingButton: {
    position: "absolute",
    right: 18,
    bottom: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#173f35",
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  floatingIcon: { color: "#fff", fontSize: 16 },
  floatingText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  modalSafe: { flex: 1, backgroundColor: "#f5f2e9" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 10
  },
  modalEyebrow: { color: "#17705b", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  modalTitle: { color: "#173f35", fontSize: 22, fontWeight: "900", marginTop: 4 },
  closeButton: { borderWidth: 1, borderColor: "#cfd9d3", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  closeText: { color: "#0b5b47", fontSize: 13, fontWeight: "900" },
  modalContent: { paddingHorizontal: 20, paddingBottom: 40 },
  privacyNote: { color: "#71837d", fontSize: 12, lineHeight: 18, marginTop: 14, paddingHorizontal: 4 }
});
