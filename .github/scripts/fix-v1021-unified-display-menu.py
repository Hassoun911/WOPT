from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "mobile/src/SettingsHub.tsx"
s = P.read_text(encoding="utf-8")

# Reuse the native pairing screen from the known-good v1.0.20 source.
if 'import ConnectDisplayPage from "./ConnectDisplayPage";' not in s:
    anchor = 'import AboutHassounPage from "./AboutHassounPage";\n'
    if anchor not in s:
        anchor = 'import BrandMark from "./BrandMark";\n'
    if anchor not in s:
        raise SystemExit("Could not find an import anchor for ConnectDisplayPage")
    s = s.replace(anchor, anchor + 'import ConnectDisplayPage from "./ConnectDisplayPage";\n', 1)

# Remove the legacy v1.0.20 direct-display page and standalone root rows first.
# Those older entries are why Connect Display remained visible separately.
s = re.sub(r'\n\s*<Row[^\n]*title=\{t\("Connect Display",\s*"ربط شاشة"\)\}[^\n]*/>', '', s)
s = re.sub(r'\n\s*<Row[^\n]*title=\{t\("Wall & Masjid Display",\s*"شاشة الحائط والمسجد"\)\}[^\n]*/>', '', s)
s = re.sub(r'\n\s*if \(page === "display"\) return <ConnectDisplayPage[^\n]+;\n', '\n', s)

m = re.search(r'type SettingsPage = ([^;]+);', s)
if not m:
    raise SystemExit("SettingsPage union not found")
parts = [part.strip() for part in m.group(1).split('|')]
parts = [part for part in parts if part != '"display"']
for page in ('"displays"', '"connectDisplay"'):
    if page not in parts:
        parts.append(page)
s = s[:m.start(1)] + ' | '.join(parts) + s[m.end(1):]

# Add exactly one top-level Displays row under APP SETTINGS.
widgets_pattern = re.compile(r'(?P<row>\s*<Row[^\n]*title=\{t\("Widgets",\s*"الويدجت"\)\}[^\n]*/>)')
match = widgets_pattern.search(s)
if not match:
    raise SystemExit("Widgets row anchor missing")
displays_row = '\n        <Row emoji="🖥️" title={t("Displays", "الشاشات")} text={t("Connect a display or open Wall & Masjid Display", "ربط شاشة أو فتح شاشة الحائط والمسجد")} onPress={() => setPage("displays")} />'
if 'title={t("Displays", "الشاشات")}' not in s:
    s = s[:match.end()] + displays_row + s[match.end():]

# Insert the single shared submenu. The two display actions exist only inside this page.
anchor = '  if (page === "root") return root;\n\n'
if anchor not in s:
    raise SystemExit("Root-page return anchor missing")

submenu = '''  if (page === "connectDisplay") return <ConnectDisplayPage locale={locale} onBack={() => setPage("displays")} />;\n\n  if (page === "displays") {\n    return (\n      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>\n        <BackHeader title={t("Displays", "الشاشات")} onBack={() => setPage("root")} />\n        <Text style={styles.subtitle}>{t("Choose how you want to use Hassoun on another screen.", "اختر طريقة استخدام حسّون على شاشة أخرى.")}</Text>\n        <Section title={t("DISPLAY OPTIONS", "خيارات الشاشة")}>\n          <Row emoji="🔗" title={t("Connect Display", "ربط شاشة")} text={t("Pair this phone with a TV, tablet, iPad or computer using the 6-digit code", "اربط هذا الهاتف بتلفاز أو جهاز لوحي أو آيباد أو كمبيوتر باستخدام رمز من 6 أرقام")} onPress={() => setPage("connectDisplay")} />\n          <Row emoji="🕌" title={t("Wall & Masjid Display", "شاشة الحائط والمسجد")} text={t("Open the full-screen Hassoun prayer display for TVs and masjid screens", "افتح شاشة حسّون الكاملة لمواقيت الصلاة للتلفاز وشاشات المسجد")} onPress={() => void Linking.openURL(`${PUBLIC_BASE}/masjid-tv/`)} />\n        </Section>\n      </ScrollView>\n    );\n  }\n\n'''

# Replace any older generated submenu instead of stacking another one.
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

# Strong guarantees: only one visible root Displays row and no legacy direct page.
if s.count('title={t("Displays", "الشاشات")}') != 2:  # root row + submenu header
    raise SystemExit("Unexpected number of Displays labels")
if s.count('title={t("Connect Display", "ربط شاشة")}') != 1:
    raise SystemExit("Connect Display must exist only inside Displays")
if s.count('title={t("Wall & Masjid Display", "شاشة الحائط والمسجد")}') != 1:
    raise SystemExit("Wall & Masjid Display must exist only inside Displays")
if 'setPage("display")' in s or 'page === "display"' in s:
    raise SystemExit("Legacy standalone display route still exists")

P.write_text(s, encoding="utf-8")
print("Replaced standalone display entries with one Displays menu")
