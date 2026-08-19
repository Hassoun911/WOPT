import Constants from "expo-constants";
import { useEffect, useMemo, useState } from "react";
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import AppWithEmail from "./AppWithEmail";
import { DEFAULT_REMOTE_CONTROL, loadRemoteControlConfig, type RemoteControlConfig } from "./src/remoteConfig";

function versionParts(value: string) {
  return value.split(".").map((part) => Number(part.replace(/[^0-9].*$/, "")) || 0).slice(0, 3);
}

function versionLessThan(current: string, required: string) {
  const left = versionParts(current);
  const right = versionParts(required);
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}

export default function StoreControlledRoot() {
  const [config, setConfig] = useState<RemoteControlConfig>(DEFAULT_REMOTE_CONTROL);
  const [loaded, setLoaded] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadRemoteControlConfig().then((next) => {
      if (!cancelled) {
        setConfig(next);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [refreshTick]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setRefreshTick((value) => value + 1);
    });
    const interval = setInterval(() => setRefreshTick((value) => value + 1), 5 * 60 * 1000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const localVersion = Constants.expoConfig?.version ?? "1.0.0";
  const minimumVersion = Platform.OS === "ios" ? config.store.iosMinimumVersion : config.store.androidMinimumVersion;
  const updateRequired = config.store.forceUpdate && versionLessThan(localVersion, minimumVersion);
  const storeUrl = Platform.OS === "ios" ? config.store.iosStoreUrl : config.store.androidStoreUrl;

  const notice = useMemo(() => {
    if (!config.appUi.homeAnnouncementEnabled) return "";
    return config.appUi.homeAnnouncementEn || config.appUi.homeAnnouncementAr;
  }, [config.appUi]);

  if (config.appUi.maintenanceMode) {
    return (
      <View style={styles.blockingPage}>
        <View style={styles.logoCircle}><Text style={styles.logo}>و</Text></View>
        <Text style={styles.eyebrow}>HASSOUN</Text>
        <Text style={styles.title}>Temporarily unavailable</Text>
        <Text style={styles.body}>{config.appUi.maintenanceMessageEn || DEFAULT_REMOTE_CONTROL.appUi.maintenanceMessageEn}</Text>
        <Text style={styles.arabic}>{config.appUi.maintenanceMessageAr || DEFAULT_REMOTE_CONTROL.appUi.maintenanceMessageAr}</Text>
        <Pressable onPress={() => setRefreshTick((value) => value + 1)} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (updateRequired) {
    return (
      <View style={styles.blockingPage}>
        <View style={styles.logoCircle}><Text style={styles.logo}>و</Text></View>
        <Text style={styles.eyebrow}>HASSOUN UPDATE</Text>
        <Text style={styles.title}>An update is required</Text>
        <Text style={styles.body}>Please update Hassoun to continue. Installed: {localVersion} • Required: {minimumVersion}</Text>
        {storeUrl ? (
          <Pressable onPress={() => void Linking.openURL(storeUrl)} style={styles.button}>
            <Text style={styles.buttonText}>Open store</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppWithEmail />
      {loaded && notice ? (
        <View pointerEvents="none" style={styles.announcement}>
          <Text style={styles.announcementText} numberOfLines={2}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blockingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    backgroundColor: "#f7f4ec"
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b654f",
    marginBottom: 18
  },
  logo: { color: "#fff", fontSize: 42, fontWeight: "900" },
  eyebrow: { color: "#b27a23", fontWeight: "900", letterSpacing: 1.8, marginBottom: 8 },
  title: { color: "#173f35", fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 12 },
  body: { color: "#63736d", fontSize: 16, lineHeight: 24, textAlign: "center", maxWidth: 480 },
  arabic: { color: "#173f35", fontSize: 18, lineHeight: 28, textAlign: "center", marginTop: 14, maxWidth: 480 },
  button: { marginTop: 24, backgroundColor: "#0b654f", borderRadius: 16, paddingHorizontal: 24, paddingVertical: 13 },
  buttonText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  announcement: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 54,
    zIndex: 1000,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#fff8df",
    borderWidth: 1,
    borderColor: "#d8b875",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 }
  },
  announcementText: { color: "#604a1d", textAlign: "center", fontWeight: "800", fontSize: 13 }
});
