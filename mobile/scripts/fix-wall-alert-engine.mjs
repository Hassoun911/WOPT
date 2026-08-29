import fs from "node:fs";

const appPath = new URL("../App.tsx", import.meta.url);
let app = fs.readFileSync(appPath, "utf8");
const oldToggle = `  const togglePrayerAudio = async (prayer: PrayerKey) => {\n    const nextPreferences: PrayerAlertPreferences = {\n      ...phoneAlertPreferences,\n      [prayer]: { ...phoneAlertPreferences[prayer], athan: !phoneAlertPreferences[prayer].athan }\n    };\n    await updatePhoneAlertPreferences(nextPreferences);\n  };`;
const newToggle = `  const togglePrayerAudio = async (prayer: PrayerKey) => {\n    const turningOn = !phoneAlertPreferences[prayer].athan;\n    const nextPreferences: PrayerAlertPreferences = {\n      ...phoneAlertPreferences,\n      [prayer]: { ...phoneAlertPreferences[prayer], athan: turningOn }\n    };\n\n    setPhoneAlertPreferences(nextPreferences);\n    await savePhonePrayerAlertPreferences(nextPreferences);\n\n    if (!turningOn) {\n      await updatePhoneAlertPreferences(nextPreferences);\n      return;\n    }\n\n    if (!Object.keys(prayerTimes).length) {\n      Alert.alert(\"Prayer times not ready\", \"Refresh prayer times, then enable Adhan again.\");\n      return;\n    }\n\n    setAlertPreferencesBusy(true);\n    try {\n      const result = await schedulePrayerNotifications(prayerTimes, locale, nextPreferences);\n      if (!result.granted) {\n        setAlertsEnabled(false);\n        setScheduledCount(0);\n        Alert.alert(\"Notifications are off\", \"Allow notifications for Hassoun so the real prayer-time alerts can run.\");\n        return;\n      }\n      setAlertsEnabled(true);\n      setScheduledCount(result.count);\n      await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);\n      void registerDeviceForServerPush(locale).catch(() => undefined);\n      if (!result.exactAlarmGranted) {\n        Alert.alert(\"Allow exact prayer alarms\", \"Adhan is selected, but Android still needs Alarms & reminders access for exact prayer-time playback.\", [\n          { text: \"Not now\", style: \"cancel\" },\n          { text: \"Open settings\", onPress: openExactAlarmSettings }\n        ]);\n      }\n    } finally {\n      setAlertPreferencesBusy(false);\n    }\n  };`;
if (!app.includes(oldToggle)) throw new Error("Could not find togglePrayerAudio block");
app = app.replace(oldToggle, newToggle);
fs.writeFileSync(appPath, app);

const wallPath = new URL("../src/TabletWallPrayerDisplay.tsx", import.meta.url);
let wall = fs.readFileSync(wallPath, "utf8");
wall = wall.replace(/preferences\[visiblePrayer\]\.athan \? \"Adhan On\" : \"Adhan Off\"/g, '(alertsEnabled && preferences[visiblePrayer].athan) ? "Adhan On" : "Adhan Off"');
wall = wall.replace(/preferences\[prayer\]\.athan \? \"Adhan On\" : \"Adhan Off\"/g, '(alertsEnabled && preferences[prayer].athan) ? "Adhan On" : "Adhan Off"');
fs.writeFileSync(wallPath, wall);

console.log("Wall Adhan state now reflects the real alert engine; enabling Adhan schedules live prayer alarms automatically.");