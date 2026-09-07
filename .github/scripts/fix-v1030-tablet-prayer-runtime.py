from pathlib import Path
import re

page_path = Path("mobile/src/MasjidDisplayPage.tsx")
page = page_path.read_text(encoding="utf-8")

# Add tablet-local prayer scheduling so the native wall display is not dependent on
# the user visiting Home/Alerts first. This keeps notifications + native exact Adhan
# armed while tablet mode is running and when the app resumes.
if 'from "./notifications"' not in page:
    insert_after = 'import { loadInitialPrayerTimes, loadPrayerTimes, type PrayerLocation } from "./prayerData";\n'
    if insert_after not in page:
        raise SystemExit("tablet runtime: prayerData import anchor missing")
    page = page.replace(insert_after, insert_after + 'import { schedulePrayerNotifications } from "./notifications";\nimport { loadPhonePrayerAlertPreferences } from "./alertPreferences";\n', 1)

# Ensure AppState exists in the react-native import.
m = re.search(r'import\s*\{([^}]*)\}\s*from\s*"react-native";', page, flags=re.S)
if not m:
    raise SystemExit("tablet runtime: react-native import missing")
names = [x.strip() for x in m.group(1).split(',') if x.strip()]
if 'AppState' not in names:
    names.insert(0, 'AppState')
    replacement = 'import { ' + ', '.join(names) + ' } from "react-native";'
    page = page[:m.start()] + replacement + page[m.end():]

# Add state used only for the setup/status panel.
state_anchor = '  const [slideSeconds, setSlideSeconds] = useState(8);'
if state_anchor in page and 'tabletPrayerRuntimeStatus' not in page:
    page = page.replace(state_anchor, state_anchor + '\n  const [tabletPrayerRuntimeStatus, setTabletPrayerRuntimeStatus] = useState("arming");', 1)
else:
    comp_anchor = '  const [now, setNow] = useState(new Date());\n'
    if 'tabletPrayerRuntimeStatus' not in page:
        if comp_anchor not in page:
            raise SystemExit("tablet runtime: component state anchor missing")
        page = page.replace(comp_anchor, comp_anchor + '  const [tabletPrayerRuntimeStatus, setTabletPrayerRuntimeStatus] = useState("arming");\n', 1)

# Self-healing scheduler: entering tablet mode arms all enabled prayer preferences,
# requests notification permission through the canonical scheduler, and rebuilds
# exact Android Adhan alarms. Re-arm on resume and periodically for long-running tablets.
if 'HASSOUN_TABLET_PRAYER_RUNTIME_V1' not in page:
    effect_anchor = '  useEffect(() => {\n    const id = setInterval(() => setSlide(n => (n + 1) % PRAYERS.length), Math.max(4, slideSeconds) * 1000);\n    return () => clearInterval(id);\n  }, [slideSeconds]);\n'
    if effect_anchor not in page:
        raise SystemExit("tablet runtime: slide effect anchor missing")
    runtime = '''\n  // HASSOUN_TABLET_PRAYER_RUNTIME_V1\n  useEffect(() => {\n    if (loading || !Object.keys(times).length) return;\n    let dead = false;\n    let arming = false;\n    const arm = async () => {\n      if (arming || dead) return;\n      arming = true;\n      try {\n        const preferences = await loadPhonePrayerAlertPreferences();\n        const result = await schedulePrayerNotifications(times, locale, preferences, {\n          timeZone: location.timezone,\n          locationLabel: location.label,\n        });\n        if (!dead) {\n          if (!result.granted) setTabletPrayerRuntimeStatus("notification-permission-needed");\n          else if ("exactAlarmGranted" in result && result.exactAlarmGranted === false) setTabletPrayerRuntimeStatus("exact-alarm-permission-needed");\n          else setTabletPrayerRuntimeStatus(`armed:${result.count}`);\n        }\n      } catch {\n        if (!dead) setTabletPrayerRuntimeStatus("error");\n      } finally {\n        arming = false;\n      }\n    };\n    void arm();\n    const appSub = AppState.addEventListener("change", state => { if (state === "active") void arm(); });\n    const keepArmed = setInterval(() => { void arm(); }, 6 * 60 * 60 * 1000);\n    return () => { dead = true; appSub.remove(); clearInterval(keepArmed); };\n  }, [loading, times, locale, location.timezone, location.label]);\n'''
    page = page.replace(effect_anchor, effect_anchor + runtime, 1)

# Prayer-time behavior: for the first five minutes after a prayer begins, pin the main
# gallery to that prayer and highlight its lower card.
next_anchor = '  const next = useMemo(() => {\n    if (!day) return "fajr" as PrayerKey;\n    for (const p of PRAYER_KEYS) {\n      const m = minutes(day[p]);\n      if (m !== null && m > cur) return p;\n    }\n    return "fajr" as PrayerKey;\n  }, [day, cur]);\n'
if next_anchor not in page:
    raise SystemExit("tablet runtime: next-prayer anchor missing")
if 'const prayerNow =' not in page:
    now_block = '''  const prayerNow = useMemo(() => {\n    if (!day) return null as PrayerKey | null;\n    for (const p of PRAYER_KEYS) {\n      const m = minutes(day[p]);\n      if (m !== null && cur >= m && cur < m + 5) return p;\n    }\n    return null as PrayerKey | null;\n  }, [day, cur]);\n\n  useEffect(() => {\n    if (!prayerNow) return;\n    const index = PRAYERS.findIndex(p => p.key === prayerNow);\n    if (index >= 0) setSlide(index);\n  }, [prayerNow]);\n'''
    page = page.replace(next_anchor, next_anchor + now_block, 1)

page = page.replace('  const current = PRAYERS[slide];', '  const current = prayerNow ? (PRAYERS.find(p => p.key === prayerNow) || PRAYERS[slide]) : PRAYERS[slide];', 1)
page = page.replace('  const isNext = current.key === next;', '  const isPrayerNow = prayerNow === current.key;\n  const isNext = !isPrayerNow && current.key === next;', 1)
page = page.replace('(isNext ? "NEXT PRAYER" : "PRAYER")', '(isPrayerNow ? "PRAYER NOW" : isNext ? "NEXT PRAYER" : "PRAYER")')
page = page.replace('            const active = p.key === next;', '            const active = prayerNow ? p.key === prayerNow : p.key === next;', 1)
page = page.replace('{isNext ? <Text style={styles.countdown}>', '{isNext && !isPrayerNow ? <Text style={styles.countdown}>', 1)

status_marker = '<Text style={styles.status}>{paired ? "CONNECTED · LIVE" : "WAITING FOR APP"}</Text>'
if status_marker in page and 'PRAYER ALERT ENGINE' not in page:
    status = status_marker + '<Text style={styles.sheetSub}>PRAYER ALERT ENGINE · {tabletPrayerRuntimeStatus.startsWith("armed:") ? "ARMED" : tabletPrayerRuntimeStatus === "notification-permission-needed" ? "ALLOW NOTIFICATIONS" : tabletPrayerRuntimeStatus === "exact-alarm-permission-needed" ? "ALLOW ALARMS & REMINDERS" : tabletPrayerRuntimeStatus === "error" ? "CHECK SETTINGS" : "ARMING…"}</Text>'
    page = page.replace(status_marker, status, 1)

for marker in [
    'HASSOUN_TABLET_PRAYER_RUNTIME_V1',
    'schedulePrayerNotifications(times, locale, preferences',
    'loadPhonePrayerAlertPreferences()',
    'tabletPrayerRuntimeStatus',
    'const prayerNow = useMemo',
    'PRAYER NOW',
    'prayerNow ? p.key === prayerNow : p.key === next',
]:
    if marker not in page:
        raise SystemExit(f"tablet runtime marker missing: {marker}")

page_path.write_text(page, encoding="utf-8")
print("HASSOUN_TABLET_PRAYER_RUNTIME_V1 applied: native tablet self-arms notifications/exact Adhan and reacts at prayer time")
