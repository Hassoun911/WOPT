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
calc_row = '\n        <Row emoji="🧭" title={t("Prayer calculation", "حساب مواقيت الصلاة")} text={t("API source, Smart or manual method, Asr school, high-latitude rules and minute tuning", "مصدر API والطريقة الذكية أو اليدوية ومذهب العصر وقواعد خطوط العرض وضبط الدقائق")} onPress={() => setPage("calculation")} />'
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

required_page = [
    'PRAYER TIME SOURCE / API',
    'AlAdhan Prayer Times API',
    'Smart automatic',
    'METHOD_OPTIONS.map',
    'ASR SCHOOL',
    'HIGH-LATITUDE RULE',
    'FINE-TUNE BY MINUTES',
    'Save & use these settings',
]
for needle in required_page:
    if needle not in page:
        raise SystemExit(f"Interactive calculation page missing: {needle}")

for needle in ['Muslim World League','ISNA','Umm al-Qura','Egyptian','Karachi','Tehran','Jafari']:
    if needle not in settings:
        raise SystemExit(f"Calculation method data missing: {needle}")

print("Forced final SettingsHub Prayer calculation route to interactive calculation page")

# Install the paired-display calculation bridge from current HEAD. The workflow
# restores an older source tree first, so this file must be explicitly restored.
sync_rel = "mobile/src/displayCalculationSync.ts"
sync_content = subprocess.check_output(["git", "show", f"HEAD:{sync_rel}"], text=True)
sync_target = ROOT / sync_rel
sync_target.parent.mkdir(parents=True, exist_ok=True)
sync_target.write_text(sync_content, encoding="utf-8")
print("Installed paired-display calculation sync bridge")

# Final navigation persistence layer: top-level state is handled in App, while
# nested Settings/Games/multiplayer state is restored here after the old source
# reconstruction so background/process recreation cannot collapse to Home.
resume = Path(__file__).resolve().parent / "fix-v1023-full-resume-and-global-calculation.py"
exec(compile(resume.read_text(encoding="utf-8"), str(resume), "exec"), {"__file__": str(resume), "__name__": "__main__"})
