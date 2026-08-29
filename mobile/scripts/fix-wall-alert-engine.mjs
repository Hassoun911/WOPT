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
const fastStartupTail = `      setPhoneAlertPreferences(savedPhoneAlertPreferences);\n      setBusy(false);\n\n      // Keep cached/bundled prayer data visible immediately. GPS/network refresh runs after the screen is already usable.\n      void loadPrayerTimes().then(async (fresh) => {\n        setPrayerTimes(fresh.prayerTimes);\n        setLive(fresh.live);\n        setWallLocationLabel(fresh.location?.label && fresh.location.label !== \"Current location\" ? fresh.location.label : \"Current location\");\n        if (savedAlerts === \"on\") {\n          const result = await schedulePrayerNotifications(fresh.prayerTimes, chosenLocale, savedPhoneAlertPreferences);\n          setScheduledCount(result.count);\n          await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);\n          void registerDeviceForServerPush(chosenLocale).catch(() => undefined);\n        }\n      }).catch(() => undefined);`;
if (app.includes(startupTail)) app = app.replace(startupTail, fastStartupTail);
else if (!app.includes('Keep cached/bundled prayer data visible immediately')) throw new Error('Could not patch fast startup');
fs.writeFileSync(appPath, app);

const prayerPath = new URL("../src/prayerData.ts", import.meta.url);
let prayerData = fs.readFileSync(prayerPath, "utf8");
const cachedBlock = `  if (cached) {\n    return {\n      prayerTimes: cached.prayerTimes,\n      live: false,\n      location: { ...cached.location, source: \"saved\" }\n    };\n  }`;
const normalizedCachedBlock = `  if (cached) {\n    const label = isUsefulLabel(cached.location.label) ? cached.location.label : \"Current location\";\n    return {\n      prayerTimes: cached.prayerTimes,\n      live: false,\n      location: { ...cached.location, label, source: \"saved\" }\n    };\n  }`;
if (prayerData.includes(cachedBlock)) prayerData = prayerData.replace(cachedBlock, normalizedCachedBlock);
else if (!prayerData.includes('const label = isUsefulLabel(cached.location.label)')) throw new Error('Could not normalize cached city label');

prayerData = prayerData.replace(
  `    const fallbackLabel = isUsefulLabel(reverseLabel)\n      ? reverseLabel\n      : isNearWindsor(latitude, longitude)\n        ? CITY_LABEL\n        : isUsefulLabel(fallback.location.label)\n          ? fallback.location.label\n          : \"Current location\";`,
  `    const fallbackLabel = isUsefulLabel(reverseLabel)\n      ? reverseLabel\n      : isUsefulLabel(fallback.location.label)\n        ? fallback.location.label\n        : \"Current location\";`
);
prayerData = prayerData.replace(
  '      label: current.source === "windsor_islamic_association" ? CITY_LABEL : fallbackLabel,',
  '      label: fallbackLabel,'
);
fs.writeFileSync(prayerPath, prayerData);

const wallPath = new URL("../src/TabletWallPrayerDisplay.tsx", import.meta.url);
let wall = fs.readFileSync(wallPath, "utf8");
wall = wall.replace(/preferences\[visiblePrayer\]\.athan \? \"Adhan On\" : \"Adhan Off\"/g, '(alertsEnabled && preferences[visiblePrayer].athan) ? "Adhan On" : "Adhan Off"');
wall = wall.replace(/preferences\[prayer\]\.athan \? \"Adhan On\" : \"Adhan Off\"/g, '(alertsEnabled && preferences[prayer].athan) ? "Adhan On" : "Adhan Off"');

const transitionLine = '  const transition = useRef(new Animated.Value(1)).current; const previousIndex = useRef(visibleIndex); const applyingRemote = useRef(false);';
const heartbeatLine = '  const transition = useRef(new Animated.Value(1)).current; const heartbeat = useRef(new Animated.Value(1)).current; const previousIndex = useRef(visibleIndex); const applyingRemote = useRef(false);';
if (wall.includes(transitionLine)) wall = wall.replace(transitionLine, heartbeatLine);
else if (!wall.includes('const heartbeat = useRef(new Animated.Value(1)).current')) throw new Error('Could not add heartbeat animation value');

const contentMarker = '\n\n  const content = <View style=';
const heartbeatEffect = `\n  useEffect(() => {\n    if (displayStage !== \"five\") { heartbeat.stopAnimation(); heartbeat.setValue(1); return; }\n    const animation = Animated.loop(Animated.sequence([\n      Animated.timing(heartbeat, { toValue: 1.07, duration: 170, useNativeDriver: true }),\n      Animated.timing(heartbeat, { toValue: 1, duration: 170, useNativeDriver: true }),\n      Animated.delay(90),\n      Animated.timing(heartbeat, { toValue: 1.04, duration: 130, useNativeDriver: true }),\n      Animated.timing(heartbeat, { toValue: 1, duration: 150, useNativeDriver: true }),\n      Animated.delay(650)\n    ]));\n    animation.start();\n    return () => { animation.stop(); heartbeat.setValue(1); };\n  }, [displayStage, heartbeat]);\n  const heartbeatStyle = displayStage === \"five\" ? { transform: [{ scale: heartbeat }] } : undefined;`;
if (!wall.includes('const heartbeatStyle = displayStage === "five"')) {
  if (!wall.includes(contentMarker)) throw new Error('Could not find wall content marker for heartbeat');
  wall = wall.replace(contentMarker, `${heartbeatEffect}${contentMarker}`);
}

wall = wall.replace('<Text style={[styles.nextPillText, displayStage === "adhan" && styles.adhanNowPillText]}>', '<Animated.Text style={[styles.nextPillText, displayStage === "adhan" && styles.adhanNowPillText, heartbeatStyle]}>');
wall = wall.replace('</Text></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.56} style={[styles.prayerArabic, textStyle("arabic")]}>{NAMES[prayer].ar}</Text>', '</Animated.Text></View><Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.56} style={[styles.prayerArabic, textStyle("arabic"), heartbeatStyle]}>{NAMES[prayer].ar}</Animated.Text>');
wall = wall.replace('{settings.showEnglish ? <Text style={[styles.prayerEnglish, textStyle("english")]}>{NAMES[prayer].en}</Text> : null}', '{settings.showEnglish ? <Animated.Text style={[styles.prayerEnglish, textStyle("english"), heartbeatStyle]}>{NAMES[prayer].en}</Animated.Text> : null}');
wall = wall.replace('<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.prayerTime, textStyle("prayerTime")]}>{prayerTime ? formatPrayerTime(prayerTime, locale) : "--:--"}</Text>', '<Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.prayerTime, textStyle("prayerTime"), heartbeatStyle]}>{prayerTime ? formatPrayerTime(prayerTime, locale) : "--:--"}</Animated.Text>');
wall = wall.replace('<Text style={[styles.countdown, textStyle("countdown")]}>{displayStage === "five" ? "◷  " : ""}{remainingLabel(next.secondsRemaining, locale)}</Text>', '<Animated.Text style={[styles.countdown, textStyle("countdown"), heartbeatStyle]}>{displayStage === "five" ? "◷  " : ""}{remainingLabel(next.secondsRemaining, locale)}</Animated.Text>');

if (!wall.includes('heartbeatStyle') || !wall.includes('Animated.loop(Animated.sequence')) throw new Error('Heartbeat pulse patch did not apply');
fs.writeFileSync(wallPath, wall);

console.log("Fixed wall alerts, dynamic city, fast resume, and heartbeat pulse for the final five minutes.");