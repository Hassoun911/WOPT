from pathlib import Path
import re

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

# Wall & Masjid Display is now a controller/pairing workflow, not a local prayer-screen renderer.
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

anchor = '  if (page === "root") return root;\n\n'
if anchor not in s:
    raise SystemExit("Root-page return anchor missing")

submenu = '''  if (page === "connectDisplay") return <ConnectDisplayPage locale={locale} onBack={() => setPage("displays")} />;\n\n  if (page === "displays") {\n    return (\n      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>\n        <BackHeader title={t("Displays", "الشاشات")} onBack={() => setPage("root")} />\n        <Text style={styles.subtitle}>{t("Pair a screen, manage saved devices, or open a connected display’s admin panel.", "اربط شاشة أو أدر الأجهزة المحفوظة أو افتح لوحة إدارة شاشة متصلة.")}</Text>\n        <Section title={t("DISPLAY OPTIONS", "خيارات الشاشة")}>\n          <Row emoji="🔗" title={t("Connect Display", "ربط شاشة")} text={t("Scan a QR code or enter the 6-digit pairing code", "امسح رمز QR أو أدخل رمز الربط المكوّن من 6 أرقام")} onPress={() => setPage("connectDisplay")} />\n          <Row emoji="🕌" title={t("Wall & Masjid Display", "شاشة الحائط والمسجد")} text={t("Connect or manage a Wall & Masjid display and open its admin panel", "اربط أو أدر شاشة الحائط والمسجد وافتح لوحة الإدارة الخاصة بها")} onPress={() => setPage("connectDisplay")} />\n        </Section>\n      </ScrollView>\n    );\n  }\n\n'''

start = s.find('  if (page === "connectDisplay")')
end = s.find('  if (page === "widgets")', start if start >= 0 else 0)
if start >= 0 and end > start:
    s = s[:start] + submenu + s[end:]
elif 'if (page === "displays")' in s:
    start = s.find('  if (page === "displays")')
    end = s.find('  if (page === "widgets")', start)
    if end <= start:
        raise SystemExit("Could not replace existing Displays submenu")
    s = s[:start] + submenu + s[end:]
else:
    s = s.replace(anchor, anchor + submenu, 1)

if s.count('title={t("Connect Display", "ربط شاشة")}') != 1:
    raise SystemExit("Connect Display must exist only inside Displays")
if s.count('title={t("Wall & Masjid Display", "شاشة الحائط والمسجد")}') != 1:
    raise SystemExit("Wall & Masjid Display must exist only inside Displays")
if s.count('onPress={() => setPage("connectDisplay")}') < 2:
    raise SystemExit("Both display actions must open the pairing/admin screen")
for forbidden in (
    'MasjidDisplayPage',
    'page === "masjidDisplay"',
    'setPage("masjidDisplay")',
    'setPage("display")',
    'page === "display"',
    'Linking.openURL("https://hassoun.app/masjid-tv/"',
):
    if forbidden in s:
        raise SystemExit("Old display route still exists: " + forbidden)

P.write_text(s, encoding="utf-8")
print("Wall & Masjid Display now opens QR/manual pairing, saved devices, and native admin panel")
