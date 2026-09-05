from pathlib import Path
import re
import runpy

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "mobile/src/SettingsHub.tsx"
s = P.read_text(encoding="utf-8")

if 'import ConnectDisplayPage from "./ConnectDisplayPage";' not in s:
    anchor = 'import AboutHassounPage from "./AboutHassounPage";\n'
    if anchor not in s:
        anchor = 'import BrandMark from "./BrandMark";\n'
    if anchor not in s:
        raise SystemExit("Could not find ConnectDisplayPage import anchor")
    s = s.replace(anchor, anchor + 'import ConnectDisplayPage from "./ConnectDisplayPage";\n', 1)

s = s.replace('import MasjidDisplayPage from "./MasjidDisplayPage";\n', '')

row_pattern = re.compile(r'\n\s*<Row[^\n]*/>')
def keep_row(match: re.Match[str]) -> str:
    row = match.group(0)
    legacy_markers = (
        'title={t("Connect Display"',
        'title={t("Wall & Masjid Display"',
        'title={t("Wall & Masjid Displays"',
        'Pair and remotely control Hassoun wall tablets',
        'mosque TVs',
    )
    return '' if any(marker in row for marker in legacy_markers) else row
s = row_pattern.sub(keep_row, s)

# Remove old direct display routes from reconstructed sources.
s = re.sub(r'\n\s*if \(page === "display"\) return <ConnectDisplayPage[^\n]+;\n', '\n', s)
s = re.sub(r'\n\s*if \(page === "masjidDisplay"\) return <MasjidDisplayPage[^\n]+;\n', '\n', s)
s = re.sub(r'\n\s*if \(page === "wallDisplay[^\"]*"\).*?(?=\n\s*if \(page ===|\n\s*const |\n\s*return )', '\n', s, flags=re.S)

m = re.search(r'type SettingsPage = ([^;]+);', s)
if not m:
    raise SystemExit("SettingsPage union not found")
parts = [part.strip() for part in m.group(1).split('|')]
parts = [part for part in parts if part not in ('"display"', '"wallDisplay"', '"wallDisplays"', '"masjidDisplay"')]
for page in ('"displays"', '"connectDisplay"'):
    if page not in parts:
        parts.append(page)
s = s[:m.start(1)] + ' | '.join(parts) + s[m.end(1):]

widgets_pattern = re.compile(r'(?P<row>\s*<Row[^\n]*title=\{t\("Widgets",\s*"الويدجت"\)\}[^\n]*/>)')
match = widgets_pattern.search(s)
if not match:
    raise SystemExit("Widgets row anchor missing")
displays_row = '\n        <Row emoji="🖥️" title={t("Displays", "الشاشات")} text={t("Connect and manage TVs, tablets and Masjid displays", "ربط وإدارة التلفاز والأجهزة اللوحية وشاشات المسجد")} onPress={() => setPage("displays")} />'
if 'title={t("Displays", "الشاشات")}' not in s:
    s = s[:match.end()] + displays_row + s[match.end():]

root_anchor = '  if (page === "root") return root;\n\n'
widgets_route = '  if (page === "widgets") {'
root_pos = s.find(root_anchor)
widgets_pos = s.find(widgets_route, root_pos + len(root_anchor) if root_pos >= 0 else 0)
if root_pos < 0 or widgets_pos < 0:
    raise SystemExit("Could not locate root/widgets route boundary")

submenu = '''  if (page === "connectDisplay") return <ConnectDisplayPage locale={locale} onBack={() => setPage("displays")} />;\n\n  if (page === "displays") {\n    return (\n      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>\n        <BackHeader title={t("Displays", "الشاشات")} onBack={() => setPage("root")} />\n        <Text style={styles.subtitle}>{t("Pair a screen, manage saved devices, or open a connected display’s admin panel.", "اربط شاشة أو أدر الأجهزة المحفوظة أو افتح لوحة إدارة شاشة متصلة.")}</Text>\n        <Section title={t("DISPLAY OPTIONS", "خيارات الشاشة")}>\n          <Row emoji="🔗" title={t("Connect Display", "ربط شاشة")} text={t("Scan a QR code or enter the 6-digit pairing code", "امسح رمز QR أو أدخل رمز الربط المكوّن من 6 أرقام")} onPress={() => setPage("connectDisplay")} />\n          <Row emoji="🕌" title={t("Wall & Masjid Display", "شاشة الحائط والمسجد")} text={t("Connect or manage a Wall & Masjid display and open its admin panel", "اربط أو أدر شاشة الحائط والمسجد وافتح لوحة الإدارة الخاصة بها")} onPress={() => setPage("connectDisplay")} />\n        </Section>\n      </ScrollView>\n    );\n  }\n\n'''

# Everything between root return and widgets is display routing inserted by older
# reconstruction scripts. Replace only that route region; never search for the
# connectDisplay text globally because Android BackHandler also references it.
prefix_end = root_pos + len(root_anchor)
s = s[:prefix_end] + submenu + s[widgets_pos:]

if s.count('title={t("Connect Display", "ربط شاشة")}') != 1:
    raise SystemExit("Connect Display must exist only inside Displays")
if s.count('title={t("Wall & Masjid Display", "شاشة الحائط والمسجد")}') != 1:
    raise SystemExit("Wall & Masjid Display must exist only inside Displays")
if s.count('onPress={() => setPage("connectDisplay")}') < 2:
    raise SystemExit("Both display actions must open the pairing/admin screen")
for forbidden in (
    'setPage("display")',
    'page === "display"',
    'setPage("masjidDisplay")',
    'page === "masjidDisplay"',
    'MasjidDisplayPage locale={locale}',
    'Linking.openURL("https://hassoun.app/masjid-tv/"',
):
    if forbidden in s:
        raise SystemExit("Old display route still exists: " + forbidden)

P.write_text(s, encoding="utf-8")

runpy.run_path(str(ROOT / ".github/scripts/fix-v1021-install-camera.py"), run_name="__main__")
runpy.run_path(str(ROOT / ".github/scripts/fix-v1021-display-pairing-admin.py"), run_name="__main__")

print("Wall & Masjid Display now opens QR/manual pairing, saved devices, and native admin panel")
