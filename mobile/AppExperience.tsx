import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppWithEmail from "./AppWithEmail";
import AskSheikh from "./src/AskSheikh";
import { STORAGE_KEYS } from "./src/config";
import { DEFAULT_RUNTIME_CONFIG, loadHassounRuntimeConfig, type HassounRuntimeConfig } from "./src/remoteConfig";

export default function AppExperience() {
  const [runtime, setRuntime] = useState<HassounRuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void loadHassounRuntimeConfig().then(setRuntime).catch(() => undefined);
    void AsyncStorage.getItem(STORAGE_KEYS.locale).then((value) => setLocale(value === "ar" ? "ar" : "en")).catch(() => undefined);
  }, []);

  const show = async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale).catch(() => null);
    setLocale(saved === "ar" ? "ar" : "en");
    const fresh = await loadHassounRuntimeConfig().catch(() => runtime);
    setRuntime(fresh);
    if (fresh.askSheikhEnabled) setOpen(true);
  };

  return (
    <View style={styles.root}>
      <AppWithEmail />
      {runtime.askSheikhEnabled ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Ask the Sheikh" onPress={() => void show()} style={styles.fab}>
          <Text style={styles.fabIcon}>✨</Text>
          <View><Text style={styles.fabTitle}>{locale === "ar" ? "اسأل الشيخ" : "Ask the Sheikh"}</Text><Text style={styles.fabSub}>{locale === "ar" ? "القرآن والحديث" : "Qur’an + Hadith"}</Text></View>
        </Pressable>
      ) : null}
      <Modal visible={open && runtime.askSheikhEnabled} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={["top", "bottom", "left", "right"]}>
          <AskSheikh locale={locale} runtime={runtime} onClose={() => setOpen(false)} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modal: { flex: 1, backgroundColor: "#f5f0e6" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 22,
    zIndex: 130,
    minHeight: 58,
    maxWidth: 188,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 19,
    backgroundColor: "#073f34",
    borderWidth: 1,
    borderColor: "#d6b85f",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14
  },
  fabIcon: { fontSize: 21 },
  fabTitle: { color: "#fffdf7", fontSize: 12, fontWeight: "900" },
  fabSub: { color: "#dfc36c", fontSize: 9, fontWeight: "800", marginTop: 2 }
});