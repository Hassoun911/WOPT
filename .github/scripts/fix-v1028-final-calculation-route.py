from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT / "mobile/src/SettingsHub.tsx"
PAGE = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"
SETTINGS = ROOT / "mobile/src/prayerCalculationSettings.ts"

hub = HUB.read_text(encoding="utf-8")
page = PAGE.read_text(encoding="utf-8")
settings = SETTINGS.read_text(encoding="utf-8")

import_line = 'import PrayerCalculationSettingsPage from "./PrayerCalculationSettingsPage";'
if import_line not in hub:
    anchor = 'import BrandMark from "./BrandMark";'
    if anchor not in hub:
        raise SystemExit("SettingsHub import anchor missing")
    hub = hub.replace(anchor, anchor + '\n' + import_line, 1)

m = re.search(r'type SettingsPage\s*=\s*([^;]+);', hub)
if not m:
    raise SystemExit("SettingsPage union missing")
if '"calculation"' not in m.group(1):
    replacement = 'type SettingsPage = ' + m.group(1).strip() + ' | "calculation";'
    hub = hub[:m.start()] + replacement + hub[m.end():]

hub = re.sub(
    r'\n\s*<Row emoji="(?:🧭|🧮|🧿|🧭)" title=\{t\("Prayer calculation".*?onPress=\{\(\) => setPage\("calculation"\)\} />',
    '', hub, flags=re.S
)

alert_row = re.search(
    r'(<Row emoji="🔔" title=\{t\("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان"\)\}.*?onPress=\{onOpenAlerts\} />)',
    hub, re.S,
)
if not alert_row:
    raise SystemExit("Prayer alerts row missing")
calc_row = '\n        <Row emoji="🧭" title={t("Prayer calculation", "حساب مواقيت الصلاة")} text={t("Smart source, official mosque schedule, calculated times, Asr school and tuning", "مصدر ذكي أو جدول مسجد رسمي أو مواقيت محسوبة ومذهب العصر والضبط")} onPress={() => setPage("calculation")} />'
hub = hub[:alert_row.end()] + calc_row + hub[alert_row.end():]

hub = re.sub(r'\n\s*if \(page === "calculation"\).*?;\n', '\n', hub)
marker = '  if (page === "widgets") {'
idx = hub.find(marker)
if idx < 0:
    raise SystemExit("Widgets renderer anchor missing")
renderer = '  if (page === "calculation") return <PrayerCalculationSettingsPage locale={locale} onBack={() => setPage("root")} />;\n\n'
hub = hub[:idx] + renderer + hub[idx:]

HUB.write_text(hub, encoding="utf-8")

required_hub = [
    import_line,
    '"calculation"',
    'title={t("Prayer calculation"',
    'onPress={() => setPage("calculation")}',
    'page === "calculation"',
    '<PrayerCalculationSettingsPage locale={locale}',
]
for needle in required_hub:
    if needle not in hub:
        raise SystemExit(f"Final calculation route missing: {needle}")

for needle in ['Muslim World League','ISNA','Umm al-Qura','Egyptian','Karachi','Tehran','Jafari']:
    if needle not in settings:
        raise SystemExit(f"Calculation method data missing: {needle}")

print("Forced final SettingsHub Prayer calculation route")

# The workflow reconstructs an older mobile tree first. Restore the canonical,
# source-aware calculation page and the paired-display calculation bridge from
# current HEAD after the legacy route has been created.
for rel in ["mobile/src/PrayerCalculationSettingsPage.tsx", "mobile/src/displayCalculationSync.ts"]:
    content = subprocess.check_output(["git", "show", f"HEAD:{rel}"], text=True)
    target = ROOT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    print(f"Installed canonical calculation source: {rel}")

page = PAGE.read_text(encoding="utf-8")
for needle in [
    'Smart Automatic',
    'Official Local Mosque Schedule',
    'Calculated Prayer Times',
    'Official timetable is active',
    'Use calculated times instead',
    'Live Asr preview',
    'Save & use these settings',
]:
    if needle not in page:
        raise SystemExit(f"Source-aware calculation page missing: {needle}")

# Final navigation persistence layer: top-level state is handled in App, while
# nested Settings/Games/multiplayer state is restored here after the old source
# reconstruction so background/process recreation cannot collapse to Home.
resume = Path(__file__).resolve().parent / "fix-v1023-full-resume-and-global-calculation.py"
exec(compile(resume.read_text(encoding="utf-8"), str(resume), "exec"), {"__file__": str(resume), "__name__": "__main__"})

# Do not let an asynchronous restore of an older Settings page (for example
# Terms of Use) overwrite a page the user just tapped, such as Prayer calculation.
# Keep exact-page resume, but only apply the saved nested page while Settings is
# still on its untouched root screen.
hub = HUB.read_text(encoding="utf-8")
if 'useRef' not in hub.split('from "react";')[0]:
    hub = hub.replace(
        'import { useEffect, useMemo, useState } from "react";',
        'import { useEffect, useMemo, useRef, useState } from "react";',
        1,
    )
state_anchor = '  const [page, setPage] = useState<SettingsPage>("root");\n'
if 'settingsCurrentPageRef' not in hub:
    if state_anchor not in hub:
        raise SystemExit('Settings page state missing for restore-race hardfix')
    hub = hub.replace(
        state_anchor,
        state_anchor + '  const settingsCurrentPageRef = useRef<SettingsPage>("root");\n  settingsCurrentPageRef.current = page;\n',
        1,
    )
old_restore = '''      .then((saved) => {\n        if (!alive || !saved) return;\n        setPage(saved as SettingsPage);\n      })'''
new_restore = '''      .then((saved) => {\n        if (!alive || !saved || settingsCurrentPageRef.current !== "root") return;\n        setPage(saved as SettingsPage);\n      })'''
if old_restore in hub:
    hub = hub.replace(old_restore, new_restore, 1)
elif 'settingsCurrentPageRef.current !== "root"' not in hub:
    raise SystemExit('Could not harden Settings nested-page restore race')
HUB.write_text(hub, encoding='utf-8')

final_hub = HUB.read_text(encoding='utf-8')
for needle in [
    'settingsCurrentPageRef',
    'settingsCurrentPageRef.current !== "root"',
    'onPress={() => setPage("calculation")}',
    'page === "calculation"',
    '<PrayerCalculationSettingsPage locale={locale}',
]:
    if needle not in final_hub:
        raise SystemExit(f'Missing final calculation-navigation safeguard: {needle}')
print('Hardened Prayer calculation navigation against stale Terms/settings restore')
