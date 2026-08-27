import fs from 'node:fs';

const path = 'App.tsx';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`Missing expected source for ${label}`);
  s = s.replace(from, to);
}

replaceOnce(
`  Image,\n  Pressable,\n  ScrollView,`,
`  Image,\n  Linking,\n  Platform,\n  Pressable,\n  ScrollView,`,
'import iOS platform/settings helpers'
);

replaceOnce(
`  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);`,
`  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n  const [masterAlertBusy, setMasterAlertBusy] = useState(false);`,
'master alert busy state'
);

replaceOnce(
`  const toggleAlerts = async (enabled: boolean) => {\n    setBusy(true);\n    try {`,
`  const toggleAlerts = async (enabled: boolean) => {\n    if (masterAlertBusy) return;\n    setMasterAlertBusy(true);\n    try {`,
'master toggle independent busy state'
);

replaceOnce(
`      if (!result.granted) {\n        Alert.alert("Notifications are off", "Allow notifications in your phone settings to receive prayer alerts.");\n        return;\n      }`,
`      if (!result.granted) {\n        if (Platform.OS === "ios") {\n          Alert.alert(\n            "Notifications are off",\n            "Allow notifications for Hassoun in iPhone Settings to receive prayer alerts.",\n            [\n              { text: "Not now", style: "cancel" },\n              { text: "Open Settings", onPress: () => void Linking.openSettings() }\n            ]\n          );\n        } else {\n          Alert.alert("Notifications are off", "Allow notifications in your phone settings to receive prayer alerts.");\n        }\n        return;\n      }`,
'iOS notification permission recovery'
);

replaceOnce(
`      if (!result.exactAlarmGranted && PRAYER_KEYS.some((prayer) => preferences[prayer].athan)) {`,
`      if (Platform.OS === "android" && !result.exactAlarmGranted && PRAYER_KEYS.some((prayer) => preferences[prayer].athan)) {`,
'Android-only exact alarm prompt'
);

replaceOnce(
`    } finally { setBusy(false); }\n  };`,
`    } finally { setMasterAlertBusy(false); }\n  };`,
'master toggle finally state'
);

replaceOnce(
`      <View style={styles.alertMasterCard}>`,
`      <Pressable\n        accessibilityRole="switch"\n        accessibilityState={{ checked: alertsEnabled, disabled: masterAlertBusy || alertPreferencesBusy }}\n        onPress={() => void toggleAlerts(!alertsEnabled)}\n        disabled={masterAlertBusy || alertPreferencesBusy}\n        style={styles.alertMasterCard}\n      >`,
'make full master card tappable'
);

replaceOnce(
`        <Switch value={alertsEnabled} onValueChange={toggleAlerts} disabled={busy || alertPreferencesBusy} trackColor={{ false: "#d9ddd9", true: "#95c3b4" }} thumbColor={alertsEnabled ? "#0b5b47" : "#f8faf8"} />\n      </View>`,
`        <Switch\n          value={alertsEnabled}\n          onValueChange={(value) => void toggleAlerts(value)}\n          disabled={masterAlertBusy || alertPreferencesBusy}\n          pointerEvents="none"\n          trackColor={{ false: "#d9ddd9", true: "#95c3b4" }}\n          thumbColor={alertsEnabled ? "#0b5b47" : "#f8faf8"}\n        />\n      </Pressable>`,
'master switch touch handling'
);

fs.writeFileSync(path, s);
console.log('Applied iOS master prayer alert toggle fix');
