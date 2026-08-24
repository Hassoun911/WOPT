import fs from 'node:fs';

const path = 'App.tsx';
let s = fs.readFileSync(path, 'utf8');

const importNeedle = 'import { loadPrayerTimes } from "./src/prayerData";';
if (!s.includes(importNeedle)) throw new Error('prayerData import anchor not found');
s = s.replace(importNeedle, 'import { loadInitialPrayerTimes, loadPrayerTimes } from "./src/prayerData";');

const oldStartup = `      const [savedLocale, savedAlerts, savedPhoneAlertPreferences, loaded, storedQuizStats] = await Promise.all([\n        AsyncStorage.getItem(STORAGE_KEYS.locale),\n        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),\n        loadPhonePrayerAlertPreferences(),\n        loadPrayerTimes(),\n        loadQuizStats()\n      ]);`;
if (!s.includes(oldStartup)) throw new Error('startup Promise.all anchor not found');
const newStartup = `      // Render immediately from cached/bundled prayer data. GPS + network refresh runs after Home is visible.\n      const [savedLocale, savedAlerts, savedPhoneAlertPreferences, loaded, storedQuizStats] = await Promise.all([\n        AsyncStorage.getItem(STORAGE_KEYS.locale),\n        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),\n        loadPhonePrayerAlertPreferences(),\n        loadInitialPrayerTimes(),\n        loadQuizStats()\n      ]);`;
s = s.replace(oldStartup, newStartup);

const busyNeedle = `      setPhoneAlertPreferences(savedPhoneAlertPreferences);\n      setBusy(false);\n      if (savedAlerts === "on") {`;
if (!s.includes(busyNeedle)) throw new Error('busy startup anchor not found');
const busyReplacement = `      setPhoneAlertPreferences(savedPhoneAlertPreferences);\n      setBusy(false);\n\n      // Do not block widget/cold launch on GPS, reverse geocoding, or prayer API calls.\n      // Refresh live data silently once the usable Home screen is already visible.\n      void loadPrayerTimes().then(async (refreshed) => {\n        setPrayerTimes(refreshed.prayerTimes);\n        setLive(refreshed.live);\n        if (savedAlerts === "on") {\n          const refreshedResult = await schedulePrayerNotifications(refreshed.prayerTimes, chosenLocale, savedPhoneAlertPreferences).catch(() => null);\n          if (refreshedResult) setScheduledCount(refreshedResult.count);\n        }\n      }).catch(() => undefined);\n\n      if (savedAlerts === "on") {`;
s = s.replace(busyNeedle, busyReplacement);

fs.writeFileSync(path, s);
console.log('Applied fast widget/cold-start prayer-data loading');
