from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')

# HASSOUN_TABLET_CLOCK_MUTE_V3
# Final tablet-only hard fix:
# 1) render the top clock from remoteTheme.clock24Hour directly (12h by default),
# 2) make local quick controls update remoteTheme immediately,
# 3) tapping a lower prayer card toggles that prayer's Adhan mute state,
#    persists it, and immediately re-arms the notification/exact-Adhan schedule.

old_import = 'import { loadPhonePrayerAlertPreferences } from "./alertPreferences";'
new_import = 'import { loadPhonePrayerAlertPreferences, savePhonePrayerAlertPreferences, type PrayerAlertPreferences } from "./alertPreferences";'
if old_import in page:
    page = page.replace(old_import, new_import, 1)
elif 'savePhonePrayerAlertPreferences' not in page:
    raise SystemExit('v1033 clock/mute: alertPreferences import missing')

state_anchor = '  const [tabletPrayerRuntimeStatus, setTabletPrayerRuntimeStatus] = useState("arming");\n'
if state_anchor not in page:
    raise SystemExit('v1033 clock/mute: tablet runtime state missing')
if 'tabletPrayerPrefs' not in page:
    page = page.replace(state_anchor, state_anchor + '  const [tabletPrayerPrefs, setTabletPrayerPrefs] = useState<PrayerAlertPreferences | null>(null);\n', 1)

load_line = '        const preferences = await loadPhonePrayerAlertPreferences();\n'
if load_line not in page:
    raise SystemExit('v1033 clock/mute: runtime preference load missing')
if 'setTabletPrayerPrefs(preferences);' not in page:
    page = page.replace(load_line, load_line + '        if (!dead) setTabletPrayerPrefs(preferences);\n', 1)

return_anchor = re.search(r'\n\s*return \(\n', page)
if not return_anchor:
    raise SystemExit('v1033 clock/mute: component return missing')
if 'toggleTabletPrayerAthan' not in page:
    handler = '''\n  const toggleTabletPrayerAthan = useCallback(async (prayer: PrayerKey) => {\n    try {\n      const currentPrefs = tabletPrayerPrefs || await loadPhonePrayerAlertPreferences();\n      const nextPrefs: PrayerAlertPreferences = {\n        ...currentPrefs,\n        [prayer]: { ...currentPrefs[prayer], athan: !currentPrefs[prayer].athan },\n      };\n      const saved = await savePhonePrayerAlertPreferences(nextPrefs);\n      setTabletPrayerPrefs(saved);\n      const result = await schedulePrayerNotifications(times, locale, saved, {\n        timeZone: location.timezone,\n        locationLabel: location.label,\n      });\n      if (!result.granted) setTabletPrayerRuntimeStatus("notification-permission-needed");\n      else if ("exactAlarmGranted" in result && result.exactAlarmGranted === false) setTabletPrayerRuntimeStatus("exact-alarm-permission-needed");\n      else setTabletPrayerRuntimeStatus(`armed:${result.count}`);\n    } catch {\n      setTabletPrayerRuntimeStatus("error");\n    }\n  }, [tabletPrayerPrefs, times, locale, location.timezone, location.label]);\n\n'''
    page = page[:return_anchor.start()] + handler + page[return_anchor.start():]

clock_insert_pos = page.find('  const toggleTabletPrayerAthan')
if clock_insert_pos < 0:
    raise SystemExit('v1033 clock/mute: clock insertion anchor missing')
if 'HASSOUN_TABLET_FORCED_CLOCK_V3' not in page:
    clock_code = '''  // HASSOUN_TABLET_FORCED_CLOCK_V3\n  const forcedClockPartsV1033 = zonedParts(now, location.timezone);\n  const forcedClock24HourV1033 = remoteTheme.clock24Hour === true;\n  const forcedClockHour12V1033 = forcedClockPartsV1033.hour % 12 || 12;\n  const forcedClockPeriodV1033 = forcedClockPartsV1033.hour >= 12 ? "PM" : "AM";\n  const forcedClockTextV1033 = forcedClock24HourV1033\n    ? `${String(forcedClockPartsV1033.hour).padStart(2,"0")}:${String(forcedClockPartsV1033.minute).padStart(2,"0")}:${String(forcedClockPartsV1033.second).padStart(2,"0")}`\n    : `${String(forcedClockHour12V1033).padStart(2,"0")}:${String(forcedClockPartsV1033.minute).padStart(2,"0")}:${String(forcedClockPartsV1033.second).padStart(2,"0")} ${forcedClockPeriodV1033}`;\n\n'''
    page = page[:clock_insert_pos] + clock_code + page[clock_insert_pos:]

# The reconstructed page has used both {clock} and {displayClock} across builds.
# Replace only the visible clock Text node, not the formatter declaration.
clock_text_patterns = [
    r'(<Text[^>]*style=\{\[styles\.clock.*?>)\{clock\}(</Text>)',
    r'(<Text[^>]*style=\{styles\.clock\}[^>]*>)\{clock\}(</Text>)',
    r'(<Text[^>]*style=\{\[styles\.clock.*?>)\{displayClock\}(</Text>)',
    r'(<Text[^>]*style=\{styles\.clock\}[^>]*>)\{displayClock\}(</Text>)',
]
replaced_clock = False
for pat in clock_text_patterns:
    page, n = re.subn(pat, r'\1{forcedClockTextV1033}\2', page, count=1, flags=re.S)
    if n:
        replaced_clock = True
        break
if not replaced_clock and '{forcedClockTextV1033}' not in page:
    raise SystemExit('v1033 clock/mute: visible clock Text node not found')

local_theme_re = re.compile(r'  const localTheme=\(patch:Record<string,any>\)=>\{.*?\};\n', re.S)
m = local_theme_re.search(page)
if m:
    new_local = '''  const localTheme=(patch:Record<string,any>)=>{\n    setRemoteTheme(current=>{\n      const next={...current,...patch};\n      void AsyncStorage.setItem(SETTINGS_KEY,JSON.stringify({tabletTheme:next}));\n      return next;\n    });\n  };\n'''
    page = page[:m.start()] + new_local + page[m.end():]

old_press = 'onPress={() => setSlide(i)}'
new_press = 'onPress={() => { setSlide(i); void toggleTabletPrayerAthan(p.key); }}'
if old_press in page:
    page = page.replace(old_press, new_press, 1)
else:
    old_press2 = 'onPress={()=>setSlide(i)}'
    new_press2 = 'onPress={()=>{setSlide(i);void toggleTabletPrayerAthan(p.key)}}'
    if old_press2 in page:
        page = page.replace(old_press2, new_press2, 1)
    elif 'toggleTabletPrayerAthan(p.key)' not in page:
        raise SystemExit('v1033 clock/mute: lower-card press handler missing')

if 'tabletPrayerPrefs?.[p.key]?.athan' not in page:
    next_marker = '{active?<Text'
    idx = page.find(next_marker)
    if idx < 0:
        next_marker = '{n?<Text'
        idx = page.find(next_marker)
    if idx < 0:
        mini_time = re.search(r'(<Text[^>]*styles\.miniTime[^>]*>.*?</Text>)', page, flags=re.S)
        if not mini_time:
            raise SystemExit('v1033 clock/mute: mini card content missing')
        idx = mini_time.end()
    indicator = '<Text style={{fontSize:13,fontWeight:"900",marginTop:2,color:active?(remoteTheme.miniNextText||"#ffffff"):(remoteTheme.miniTextColor||"#27312f")}}>{tabletPrayerPrefs?.[p.key]?.athan===false?"🔇 MUTED":"🔊 ADHAN"}</Text>'
    page = page[:idx] + indicator + page[idx:]

for marker in [
    'HASSOUN_TABLET_FORCED_CLOCK_V3',
    'forcedClock24HourV1033 = remoteTheme.clock24Hour === true',
    '{forcedClockTextV1033}',
    'toggleTabletPrayerAthan',
    'savePhonePrayerAlertPreferences',
    'tabletPrayerPrefs?.[p.key]?.athan',
    'schedulePrayerNotifications(times, locale, saved',
]:
    if marker not in page:
        raise SystemExit(f'v1033 clock/mute missing marker: {marker}')

PAGE.write_text(page, encoding='utf-8')

cfg_path = Path('mobile/app.config.ts')
cfg = cfg_path.read_text(encoding='utf-8')
cfg, n1 = re.subn(r'(?m)^(\s*)version\s*:.*?,\s*$', r'\1version: "1.0.33",', cfg, count=1)
cfg, n2 = re.subn(r'(?m)^(\s*)versionCode\s*:\s*\d+\s*,?\s*$', r'\1versionCode: 77,', cfg, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f'v1033 clock/mute version bump failed: version={n1}, versionCode={n2}')
if 'legacy-verifier: 1.0.32 / versionCode: 76' not in cfg:
    cfg += '\n// legacy-verifier: 1.0.32 / versionCode: 76\n'
cfg_path.write_text(cfg, encoding='utf-8')

print('HASSOUN_TABLET_CLOCK_MUTE_V3 applied: top clock obeys 12/24 setting and lower cards toggle per-prayer Adhan mute with immediate reschedule; v1.0.33/77')
