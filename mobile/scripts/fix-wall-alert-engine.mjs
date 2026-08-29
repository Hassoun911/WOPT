import fs from "node:fs";

const appPath = new URL("../App.tsx", import.meta.url);
let app = fs.readFileSync(appPath, "utf8");
const oldToggle = `  const togglePrayerAudio = async (prayer: PrayerKey) => {\n    const nextPreferences: PrayerAlertPreferences = {\n      ...phoneAlertPreferences,\n      [prayer]: { ...phoneAlertPreferences[prayer], athan: !phoneAlertPreferences[prayer].athan }\n    };\n    await updatePhoneAlertPreferences(nextPreferences);\n  };`;
const newToggle = `  const togglePrayerAudio = async (prayer: PrayerKey) => {\n    const turningOn = !phoneAlertPreferences[prayer].athan;\n    const nextPreferences: PrayerAlertPreferences = {\n      ...phoneAlertPreferences,\n      [prayer]: { ...phoneAlertPreferences[prayer], athan: turningOn }\n    };\n\n    setPhoneAlertPreferences(nextPreferences);\n    await savePhonePrayerAlertPreferences(nextPreferences);\n\n    if (!turningOn) {\n      await updatePhoneAlertPreferences(nextPreferences);\n      return;\n    }\n\n    if (!Object.keys(prayerTimes).length) {\n      Alert.alert(\"Prayer times not ready\", \"Refresh prayer times, then enable Adhan again.\");\n      return;\n    }\n\n    setAlertPreferencesBusy(true);\n    try {\n      const result = await schedulePrayerNotifications(prayerTimes, locale, nextPreferences);\n      if (!result.granted) {\n        setAlertsEnabled(false);\n        setScheduledCount(0);\n        Alert.alert(\"Notifications are off\", \"Allow notifications for Hassoun so the real prayer-time alerts can run.\");\n        return;\n      }\n      setAlertsEnabled(true);\n      setScheduledCount(result.count);\n      await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);\n      void registerDeviceForServerPush(locale).catch(() => undefined);\n      if (!result.exactAlarmGranted) {\n        Alert.alert(\"Allow exact prayer alarms\", \"Adhan is selected, but Android still needs Alarms & reminders access for exact prayer-time playback.\", [\n          { text: \"Not now\", style: \"cancel\" },\n          { text: \"Open settings\", onPress: openExactAlarmSettings }\n        ]);\n      }\n    } finally {\n      setAlertPreferencesBusy(false);\n    }\n  };`;
if (app.includes(oldToggle)) app = app.replace(oldToggle, newToggle);
else if (!app.includes('const turningOn = !phoneAlertPreferences[prayer].athan')) throw new Error("Could not find togglePrayerAudio block");

app = app.replace(
  'import { loadPrayerTimes } from "./src/prayerData";',
  'import { loadInitialPrayerTimes, loadPrayerTimes } from "./src/prayerData";'
);
app = app.replace(
  '        loadPrayerTimes(),\n        loadQuizStats()',
  '        loadInitialPrayerTimes(),\n        loadQuizStats()'
);
const startupTail = `      setPhoneAlertPreferences(savedPhoneAlertPreferences);\n      setBusy(false);\n      if (savedAlerts === "on") {\n        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);\n        setScheduledCount(result.count);\n        await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);\n        void registerDeviceForServerPush(chosenLocale).catch(() => undefined);\n      }`;
const fastStartupTail = `      setPhoneAlertPreferences(savedPhoneAlertPreferences);\n      setBusy(false);\n\n      // Keep cached/bundled prayer data visible immediately. GPS/network refresh runs after the screen is already usable.\n      void loadPrayerTimes().then(async (fresh) => {\n        setPrayerTimes(fresh.prayerTimes);\n        setLive(fresh.live);\n        setWallLocationLabel(fresh.location?.label && fresh.location.label !== "Current location" ? fresh.location.label : CITY_LABEL);\n        if (savedAlerts === "on") {\n          const result = await schedulePrayerNotifications(fresh.prayerTimes, chosenLocale, savedPhoneAlertPreferences);\n          setScheduledCount(result.count);\n          await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);\n          void registerDeviceForServerPush(chosenLocale).catch(() => undefined);\n        }\n      }).catch(() => undefined);`;
if (app.includes(startupTail)) app = app.replace(startupTail, fastStartupTail);
else if (!app.includes('Keep cached/bundled prayer data visible immediately')) throw new Error('Could not patch fast startup');
fs.writeFileSync(appPath, app);

const prayerPath = new URL("../src/prayerData.ts", import.meta.url);
let prayerData = fs.readFileSync(prayerPath, "utf8");
const cachedBlock = `  if (cached) {\n    return {\n      prayerTimes: cached.prayerTimes,\n      live: false,\n      location: { ...cached.location, source: "saved" }\n    };\n  }`;
const normalizedCachedBlock = `  if (cached) {\n    const label = isUsefulLabel(cached.location.label)\n      ? cached.location.label\n      : isNearWindsor(cached.location.latitude, cached.location.longitude)\n        ? CITY_LABEL\n        : CITY_LABEL;\n    return {\n      prayerTimes: cached.prayerTimes,\n      live: false,\n      location: { ...cached.location, label, source: "saved" }\n    };\n  }`;
if (prayerData.includes(cachedBlock)) prayerData = prayerData.replace(cachedBlock, normalizedCachedBlock);
else if (!prayerData.includes('const label = isUsefulLabel(cached.location.label)')) throw new Error('Could not normalize cached city label');
fs.writeFileSync(prayerPath, prayerData);

const wallPath = new URL("../src/TabletWallPrayerDisplay.tsx", import.meta.url);
let wall = fs.readFileSync(wallPath, "utf8");
wall = wall.replace(/preferences\[visiblePrayer\]\.athan \? \"Adhan On\" : \"Adhan Off\"/g, '(alertsEnabled && preferences[visiblePrayer].athan) ? "Adhan On" : "Adhan Off"');
wall = wall.replace(/preferences\[prayer\]\.athan \? \"Adhan On\" : \"Adhan Off\"/g, '(alertsEnabled && preferences[prayer].athan) ? "Adhan On" : "Adhan Off"');
fs.writeFileSync(wallPath, wall);

console.log("Fixed real wall alert state, reliable city label, and fast cached startup/resume.");