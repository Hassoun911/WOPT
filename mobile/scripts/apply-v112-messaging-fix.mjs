import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}

const appPath = 'AppWithEmail.tsx';
let app = fs.readFileSync(appPath, 'utf8');

app = replaceOnce(
  app,
  'import {\n  Modal,',
  'import {\n  AppState,\n  Modal,',
  'AppState import'
);

app = replaceOnce(
  app,
  'import { registerDeviceForServerPush } from "./src/push";\n',
  'import { registerDeviceForServerPush } from "./src/push";\nimport SystemMessageTicker from "./src/SystemMessageTicker";\n',
  'ticker import'
);

const helperAnchor = `import {\n  DEFAULT_RUNTIME_CONFIG,\n  loadHassounRuntimeConfig,\n  versionIsBelow,\n  type HassounRuntimeConfig\n} from "./src/remoteConfig";\n\n`;
const helper = `async function syncServerPush(locale: "en" | "ar", allowPrompt: boolean) {\n  let permission = await Notifications.getPermissionsAsync();\n  if (!permission.granted && allowPrompt && permission.canAskAgain) {\n    permission = await Notifications.requestPermissionsAsync();\n  }\n  if (!permission.granted) return false;\n  await registerDeviceForServerPush(locale);\n  return true;\n}\n\n`;
app = replaceOnce(app, helperAnchor, helperAnchor + helper, 'push sync helper');

const oldEffect = `  useEffect(() => {\n    void loadHassounRuntimeConfig().then(setRuntime).catch(() => undefined);\n    void (async () => {\n      await configureNotificationChannels();\n      const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);\n      const currentLocale = saved === "ar" ? "ar" : "en";\n      setLocale(currentLocale);\n\n      const permission = await Notifications.getPermissionsAsync();\n      if (permission.granted) {\n        await registerDeviceForServerPush(currentLocale).catch(() => undefined);\n      }\n    })().catch(() => undefined);\n  }, []);`;

const newEffect = `  useEffect(() => {\n    void loadHassounRuntimeConfig().then(setRuntime).catch(() => undefined);\n\n    void (async () => {\n      await configureNotificationChannels();\n      const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);\n      const currentLocale = saved === "ar" ? "ar" : "en";\n      setLocale(currentLocale);\n      await syncServerPush(currentLocale, true).catch(() => false);\n    })().catch(() => undefined);\n\n    const subscription = AppState.addEventListener("change", state => {\n      if (state !== "active") return;\n      void loadHassounRuntimeConfig().then(setRuntime).catch(() => undefined);\n      void AsyncStorage.getItem(STORAGE_KEYS.locale).then(saved => {\n        const currentLocale = saved === "ar" ? "ar" : "en";\n        setLocale(currentLocale);\n        return syncServerPush(currentLocale, false);\n      }).catch(() => undefined);\n    });\n\n    const refreshTimer = setInterval(() => {\n      void AsyncStorage.getItem(STORAGE_KEYS.locale).then(saved => {\n        const currentLocale = saved === "ar" ? "ar" : "en";\n        return syncServerPush(currentLocale, false);\n      }).catch(() => undefined);\n    }, 6 * 60 * 60 * 1000);\n\n    return () => {\n      subscription.remove();\n      clearInterval(refreshTimer);\n    };\n  }, []);`;
app = replaceOnce(app, oldEffect, newEffect, 'automatic push registration');

app = replaceOnce(
  app,
  '    <View style={styles.root}>\n      <App onOpenEmailAlerts={runtime.emailEnabled ? () => void open() : undefined} />',
  '    <View style={styles.root}>\n      <SystemMessageTicker locale={locale} />\n      <App onOpenEmailAlerts={runtime.emailEnabled ? () => void open() : undefined} />',
  'CRM ticker mount'
);

fs.writeFileSync(appPath, app);

const configPath = 'app.config.ts';
let config = fs.readFileSync(configPath, 'utf8');
config = replaceOnce(config, 'version: "1.0.11"', 'version: "1.0.12"', 'version');
config = replaceOnce(config, 'versionCode: 52', 'versionCode: 53', 'versionCode');
fs.writeFileSync(configPath, config);

console.log('Applied messaging-only v1.0.12 patch to exact v1.0.11 golden lineage');
