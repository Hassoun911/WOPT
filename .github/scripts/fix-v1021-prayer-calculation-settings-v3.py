from pathlib import Path
import re
import runpy

ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT / "mobile/src/SettingsHub.tsx"
V2 = ROOT / ".github/scripts/fix-v1021-prayer-calculation-settings-v2.py"

try:
    runpy.run_path(str(V2), run_name="__main__")
except SystemExit as exc:
    # v2 intentionally creates the settings model/page and patches prayerData before
    # it reaches SettingsHub. Generated v1.0.21 navigation scripts can extend the
    # SettingsPage union first, so finish that last Hub integration robustly here.
    if str(exc) != "SettingsPage type anchor missing":
        raise

hub = HUB.read_text(encoding="utf-8")

if 'import PrayerCalculationSettingsPage from "./PrayerCalculationSettingsPage";' not in hub:
    anchor = 'import AboutHassounPage from "./AboutHassounPage";'
    if anchor not in hub:
        raise SystemExit("AboutHassounPage import anchor missing")
    hub = hub.replace(anchor, anchor + '\nimport PrayerCalculationSettingsPage from "./PrayerCalculationSettingsPage";', 1)

# Preserve every page added by display/navigation patches and simply append calculation.
m = re.search(r'type SettingsPage\s*=\s*([^;]+);', hub)
if not m:
    raise SystemExit("SettingsPage union not found")
if '"calculation"' not in m.group(1):
    replacement = 'type SettingsPage = ' + m.group(1).strip() + ' | "calculation";'
    hub = hub[:m.start()] + replacement + hub[m.end():]

# Add the visible smart calculation entry directly below Prayer & Adhan alerts.
if 'title={t("Prayer calculation"' not in hub:
    alert_row = re.search(
        r'\s*<Row emoji="🔔" title=\{t\("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان"\)\}.*?onPress=\{onOpenAlerts\} />',
        hub,
        re.S,
    )
    if not alert_row:
        raise SystemExit("Prayer alerts Settings row not found")
    calc_row = '\n        <Row emoji="🧭" title={t("Prayer calculation", "حساب مواقيت الصلاة")} text={t("Smart method, manual methods, Asr school, high-latitude rules and minute tuning", "طريقة ذكية وطرق يدوية ومذهب العصر وقواعد خطوط العرض وضبط الدقائق")} onPress={() => setPage("calculation")} />'
    hub = hub[:alert_row.end()] + calc_row + hub[alert_row.end():]

# Route the row to the full settings page before any other nested settings renderer.
if 'page === "calculation"' not in hub:
    marker = '  if (page === "widgets") {'
    idx = hub.find(marker)
    if idx < 0:
        raise SystemExit("Widgets Settings page renderer not found")
    render = '  if (page === "calculation") return <PrayerCalculationSettingsPage locale={locale} onBack={() => setPage("root")} />;\n\n'
    hub = hub[:idx] + render + hub[idx:]

# Include the new page in background/process restoration if that allowed list exists.
allowed_pattern = r'const allowed = \[([^\]]+)\];'
allowed_match = re.search(allowed_pattern, hub)
if allowed_match and '"calculation"' not in allowed_match.group(1):
    body = allowed_match.group(1).rstrip()
    if body and not body.rstrip().endswith(','):
        body += ','
    body += '"calculation"'
    hub = hub[:allowed_match.start(1)] + body + hub[allowed_match.end(1):]

HUB.write_text(hub, encoding="utf-8")

required = [
    'PrayerCalculationSettingsPage',
    '"calculation"',
    'title={t("Prayer calculation"',
    'page === "calculation"',
]
for needle in required:
    if needle not in hub:
        raise SystemExit("Missing SettingsHub calculation integration: " + needle)

print("Installed resilient smart prayer calculation SettingsHub integration")
