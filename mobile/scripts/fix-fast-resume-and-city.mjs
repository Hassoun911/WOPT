import fs from "node:fs";

const appPath = new URL("../App.tsx", import.meta.url);
let app = fs.readFileSync(appPath, "utf8");

const replaceOnce = (from, to, label) => {
  if (!app.includes(from)) {
    if (app.includes(to)) return;
    throw new Error(`Missing expected App source for ${label}`);
  }
  app = app.replace(from, to);
};

replaceOnce(
  'import { loadPrayerTimes } from "./src/prayerData";',
  'import { loadInitialPrayerTimes, loadPrayerTimes } from "./src/prayerData";',
  'fast prayer data import'
);

replaceOnce(
  '        loadPrayerTimes(),\n        loadQuizStats()',
  '        loadInitialPrayerTimes(),\n        loadQuizStats()',
  'network-free initial prayer load'
);

const startupTail = `      setPhoneAlertPreferences(savedPhoneAlertPreferences);\n      setBusy(false);\n      if (savedAlerts === "on") {\n        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);\n        setScheduledCount(result.count);\n        await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);\n        void registerDeviceForServerPush(chosenLocale).catch(() => undefined);\n      }`;
const fastStartupTail = `      setPhoneAlertPreferences(savedPhoneAlertPreferences);\n      setBusy(false);\n\n      // Show cached/bundled prayer data immediately, then refresh GPS/network in the background.\n      void loadPrayerTimes().then(async (fresh) => {\n        setPrayerTimes(fresh.prayerTimes);\n        setLive(fresh.live);\n        setWallLocationLabel(fresh.location?.label && fresh.location.label !== "Current location" ? fresh.location.label : CITY_LABEL);\n        if (savedAlerts === "on") {\n          const result = await schedulePrayerNotifications(fresh.prayerTimes, chosenLocale, savedPhoneAlertPreferences);\n          setScheduledCount(result.count);\n          await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);\n          void registerDeviceForServerPush(chosenLocale).catch(() => undefined);\n        }\n      }).catch(() => undefined);`;
replaceOnce(startupTail, fastStartupTail, 'background live prayer refresh');

fs.writeFileSync(appPath, app);

const prayerPath = new URL("../src/prayerData.ts", import.meta.url);
let prayer = fs.readFileSync(prayerPath, "utf8");
const oldCached = `  if (cached) {\n    return {\n      prayerTimes: cached.prayerTimes,\n      live: false,\n      location: { ...cached.location, source: "saved" }\n    };\n  }`;
const newCached = `  if (cached) {\n    const cachedLabel = isUsefulLabel(cached.location.label)\n      ? cached.location.label\n      : isNearWindsor(cached.location.latitude, cached.location.longitude)\n        ? CITY_LABEL\n        : CITY_LABEL;\n    return {\n      prayerTimes: cached.prayerTimes,\n      live: false,\n      location: { ...cached.location, label: cachedLabel, source: "saved" }\n    };\n  }`;
if (prayer.includes(oldCached)) prayer = prayer.replace(oldCached, newCached);
else if (!prayer.includes('const cachedLabel = isUsefulLabel(cached.location.label)')) throw new Error('Missing cached location normalization source');
fs.writeFileSync(prayerPath, prayer);

console.log('Applied fast cached startup/resume and reliable wall city label');