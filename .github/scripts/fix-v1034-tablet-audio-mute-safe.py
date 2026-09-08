from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')

# HASSOUN_TABLET_AUDIO_MUTE_SAFE_V1
# Keep mini prayer cards as per-prayer Adhan mute buttons, but do NOT rebuild/cancel
# the 20-minute and 10-minute notification schedule when a card is tapped.
# Only the native exact-Adhan schedule is replaced after the athan preference changes.

# Add the native Adhan-only scheduler import.
notif_import = 'import { schedulePrayerNotifications } from "./notifications";'
adhan_import = 'import { scheduleAndroidPrayerAudio } from "./prayerAudio";'
if adhan_import not in page:
    if notif_import not in page:
        raise SystemExit('v1034 audio fix: notification import missing')
    page = page.replace(notif_import, notif_import + '\n' + adhan_import, 1)

# Replace the v1.0.33 mini-card handler implementation. The visual tap/mute behavior
# stays the same, but we stop calling schedulePrayerNotifications(), because that
# function cancels every reminder and exact-Adhan event before rebuilding them.
handler_re = re.compile(
    r'  const toggleTabletPrayerAthan = useCallback\(async \(prayer: PrayerKey\) => \{.*?\n  \}, \[tabletPrayerPrefs, times, locale, location\.timezone, location\.label\]\);',
    re.S,
)
m = handler_re.search(page)
if not m:
    raise SystemExit('v1034 audio fix: v1033 toggle handler missing')

handler = '''  const toggleTabletPrayerAthan = useCallback(async (prayer: PrayerKey) => {\n    try {\n      const currentPrefs = tabletPrayerPrefs || await loadPhonePrayerAlertPreferences();\n      const nextPrefs: PrayerAlertPreferences = {\n        ...currentPrefs,\n        [prayer]: { ...currentPrefs[prayer], athan: !currentPrefs[prayer].athan },\n      };\n      const saved = await savePhonePrayerAlertPreferences(nextPrefs);\n      setTabletPrayerPrefs(saved);\n\n      // HASSOUN_TABLET_AUDIO_MUTE_SAFE_V1\n      // A mini-card tap only changes the native Adhan schedule. Leave already-armed\n      // 20m/10m reminder notifications untouched so a normal display interaction\n      // cannot cancel or shift reminder sounds.\n      const audio = await scheduleAndroidPrayerAudio(times, saved, location.timezone);\n      if (!audio.available) setTabletPrayerRuntimeStatus("error");\n      else if (!audio.exact) setTabletPrayerRuntimeStatus("exact-alarm-permission-needed");\n      else setTabletPrayerRuntimeStatus(`armed:${audio.count}`);\n    } catch {\n      setTabletPrayerRuntimeStatus("error");\n    }\n  }, [tabletPrayerPrefs, times, location.timezone]);'''
page = page[:m.start()] + handler + page[m.end():]

# Keep the mini-card press as selection + mute toggle.
if 'toggleTabletPrayerAthan(p.key)' not in page:
    raise SystemExit('v1034 audio fix: mini-card mute press missing')

# Guard against regression back to full notification reschedule inside the mute handler.
handler_check = handler_re.search(page)
if not handler_check:
    # use a simpler extraction after replacement
    start = page.find('  const toggleTabletPrayerAthan = useCallback')
    end = page.find('\n  }, [tabletPrayerPrefs, times, location.timezone]);', start)
    block = page[start:end + len('\n  }, [tabletPrayerPrefs, times, location.timezone]);')]
else:
    block = handler_check.group(0)
if 'schedulePrayerNotifications(' in block:
    raise SystemExit('v1034 audio fix: full reminder reschedule still present in mini-card handler')

for marker in [
    'HASSOUN_TABLET_AUDIO_MUTE_SAFE_V1',
    'scheduleAndroidPrayerAudio(times, saved, location.timezone)',
    'toggleTabletPrayerAthan(p.key)',
    'savePhonePrayerAlertPreferences',
    'tabletPrayerPrefs?.[p.key]?.athan',
]:
    if marker not in page:
        raise SystemExit(f'v1034 audio fix missing marker: {marker}')

PAGE.write_text(page, encoding='utf-8')

cfg_path = Path('mobile/app.config.ts')
cfg = cfg_path.read_text(encoding='utf-8')
cfg, n1 = re.subn(r'(?m)^(\s*)version\s*:.*?,\s*$', r'\1version: "1.0.34",', cfg, count=1)
cfg, n2 = re.subn(r'(?m)^(\s*)versionCode\s*:\s*\d+\s*,?\s*$', r'\1versionCode: 78,', cfg, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f'v1034 audio fix version bump failed: version={n1}, versionCode={n2}')
cfg_path.write_text(cfg, encoding='utf-8')

print('HASSOUN_TABLET_AUDIO_MUTE_SAFE_V1 applied: mini cards remain Adhan mute buttons while 20m/10m reminder schedule stays untouched; v1.0.34/78')
