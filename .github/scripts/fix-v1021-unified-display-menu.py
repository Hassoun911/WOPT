from pathlib import Path
import re
import runpy

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "mobile/src/SettingsHub.tsx"
s = P.read_text(encoding="utf-8")

for import_line, anchor in [
    ('import ConnectDisplayPage from "./ConnectDisplayPage";\n', 'import AboutHassounPage from "./AboutHassounPage";\n'),
    ('import MasjidDisplayPage from "./MasjidDisplayPage";\n', 'import ConnectDisplayPage from "./ConnectDisplayPage";\n'),
]:
    if import_line not in s:
        if anchor not in s:
            raise SystemExit(f"Display import anchor missing: {anchor.strip()}")
        s = s.replace(anchor, anchor + import_line, 1)

row_pattern = re.compile(r'\n\s*<Row[^\n]*/>')
def keep_row(match: re.Match[str]) -> str:
    row = match.group(0)
    markers = (
        'title={t("Connect Display"',
        'title={t("Wall & Masjid Display"',
        'title={t("Wall & Masjid Displays"',
        'title={t("Tablet / Wall Display"',
        'Pair and remotely control Hassoun wall tablets',
        'mosque TVs',
    )
    return '' if any(marker in row for marker in markers) else row
s = row_pattern.sub(keep_row, s)
s = re.sub(r'\n\s*if \(page === "connectDisplay"\) return <ConnectDisplayPage[^\n]+;\n', '\n', s)
s = re.sub(r'\n\s*if \(page === "masjidDisplay"\) return <MasjidDisplayPage[^\n]+;\n', '\n', s)
s = re.sub(r'\n\s*if \(page === "permissions"\) return <PermissionsStatusPage[^\n]+;\n', '\n', s)
s = re.sub(r'\n\s*if \(page === "displays"\).*?(?=\n\s*if \(page === "widgets"\))', '\n', s, flags=re.S)

m = re.search(r'type SettingsPage = ([^;]+);', s)
if not m:
    raise SystemExit("SettingsPage union not found")
parts = [part.strip() for part in m.group(1).split('|')]
parts = [part for part in parts if part not in ('"display"', '"wallDisplay"', '"wallDisplays"')]
for page in ('"displays"', '"connectDisplay"', '"masjidDisplay"', '"permissions"'):
    if page not in parts:
        parts.append(page)
s = s[:m.start(1)] + ' | '.join(parts) + s[m.end(1):]

widgets_pattern = re.compile(r'(?P<row>\s*<Row[^\n]*title=\{t\("Widgets",\s*"الويدجت"\)\}[^\n]*/>)')
match = widgets_pattern.search(s)
if not match:
    raise SystemExit("Widgets row anchor missing")
if 'title={t("Displays", "الشاشات")}' not in s:
    displays_row = '\n        <Row emoji="🖥️" title={t("Displays", "الشاشات")} text={t("Connect, control, or open tablet and TV wall displays", "ربط أو التحكم أو فتح شاشات الحائط على الأجهزة اللوحية والتلفاز")} onPress={() => setPage("displays")} />'
    s = s[:match.end()] + displays_row + s[match.end():]

root_anchor = '  if (page === "root") return root;\n\n'
widgets_route = '  if (page === "widgets") {'
root_pos = s.find(root_anchor)
widgets_pos = s.find(widgets_route, root_pos + len(root_anchor) if root_pos >= 0 else 0)
if root_pos < 0 or widgets_pos < 0:
    raise SystemExit("Could not locate root/widgets route boundary")

submenu = '''  if (page === "permissions") return <PermissionsStatusPage locale={locale} onBack={() => setPage("root")} />;\n\n  if (page === "connectDisplay") return <ConnectDisplayPage locale={locale} onBack={() => setPage("displays")} />;\n\n  if (page === "masjidDisplay") return <MasjidDisplayPage locale={locale} onBack={() => setPage("displays")} />;\n\n  if (page === "displays") {\n    return (\n      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>\n        <BackHeader title={t("Displays", "الشاشات")} onBack={() => setPage("root")} />\n        <Text style={styles.subtitle}>{t("Open this device as a wall display, or pair and remotely control another display.", "افتح هذا الجهاز كشاشة حائط أو اربط شاشة أخرى وتحكم بها عن بُعد.")}</Text>\n        <Section title={t("DISPLAY OPTIONS", "خيارات الشاشة")}>\n          <Row emoji="🕌" title={t("Tablet / Wall Display", "شاشة الجهاز اللوحي / الحائط")} text={t("Open the full-screen rotating prayer display on this device", "افتح شاشة الصلاة الدوارة بملء الشاشة على هذا الجهاز")} onPress={() => setPage("masjidDisplay")} />\n          <Row emoji="🔗" title={t("Connect Display", "ربط شاشة")} text={t("Scan a QR code or enter the 6-digit pairing code", "امسح رمز QR أو أدخل رمز الربط المكوّن من 6 أرقام")} onPress={() => setPage("connectDisplay")} />\n          <Row emoji="🖥️" title={t("Manage Wall & Masjid Displays", "إدارة شاشات الحائط والمسجد")} text={t("Manage saved displays and open their remote admin controls", "إدارة الشاشات المحفوظة وفتح أدوات التحكم عن بُعد")} onPress={() => setPage("connectDisplay")} />\n        </Section>\n      </ScrollView>\n    );\n  }\n\n'''

prefix_end = root_pos + len(root_anchor)
s = s[:prefix_end] + submenu + s[widgets_pos:]

required = [
    'import MasjidDisplayPage from "./MasjidDisplayPage";',
    '"masjidDisplay"',
    'title={t("Tablet / Wall Display"',
    'setPage("masjidDisplay")',
    'page === "masjidDisplay"',
    '<MasjidDisplayPage locale={locale}',
    'title={t("Connect Display"',
    'PermissionsStatusPage locale={locale}',
]
for needle in required:
    if needle not in s:
        raise SystemExit(f"Unified display menu missing: {needle}")

P.write_text(s, encoding="utf-8")

# The early build pass may need to create the pairing page. The final pass happens
# after the runtime camera hard-fix; never overwrite that safer implementation.
pair_path = ROOT / "mobile/src/ConnectDisplayPage.tsx"
pair_text = pair_path.read_text(encoding="utf-8") if pair_path.exists() else ""
safe_camera = 'CAMERA_PENDING_KEY' in pair_text or 'PermissionsAndroid.PERMISSIONS.CAMERA' in pair_text
if not safe_camera:
    runpy.run_path(str(ROOT / ".github/scripts/fix-v1021-install-camera.py"), run_name="__main__")
    runpy.run_path(str(ROOT / ".github/scripts/fix-v1021-display-pairing-admin.py"), run_name="__main__")
    print("Generated base display pairing/admin page")
else:
    print("Preserved runtime-safe QR camera pairing page")

print("Displays menu includes native Tablet / Wall Display, QR pairing, remote admin, and Permissions")
