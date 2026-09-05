from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "mobile/src/SettingsHub.tsx"
s = P.read_text(encoding="utf-8")

# Reuse the existing native pairing screen from the known-good v1.0.20 source.
if 'import ConnectDisplayPage from "./ConnectDisplayPage";' not in s:
    anchor = 'import AboutHassounPage from "./AboutHassounPage";\n'
    if anchor not in s:
        raise SystemExit("AboutHassounPage import anchor missing")
    s = s.replace(anchor, anchor + 'import ConnectDisplayPage from "./ConnectDisplayPage";\n', 1)

old_union = 'type SettingsPage = "root" | "about" | "guide" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";'
new_union = 'type SettingsPage = "root" | "about" | "guide" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets" | "displays" | "connectDisplay";'
if old_union in s:
    s = s.replace(old_union, new_union, 1)
elif '"displays"' not in s or '"connectDisplay"' not in s:
    raise SystemExit("SettingsPage union did not match expected v1.0.20 source")

# One top-level Displays menu. Both pairing and wall/masjid display live inside it.
widgets_row = '        <Row emoji="🧩" title={t("Widgets", "الويدجت")} text={t("Choose layout and what appears on home and supported lock screens", "اختر التصميم والمعلومات التي تظهر على الشاشة الرئيسية وشاشة القفل المدعومة")} onPress={() => setPage("widgets")} />\n'
displays_row = '        <Row emoji="🖥️" title={t("Displays", "الشاشات")} text={t("Connect, manage and open wall / masjid displays", "ربط وإدارة وفتح شاشات الحائط والمسجد")} onPress={() => setPage("displays")} />\n'
if 'title={t("Displays", "الشاشات")}' not in s:
    if widgets_row not in s:
        raise SystemExit("Widgets row anchor missing")
    s = s.replace(widgets_row, widgets_row + displays_row, 1)

# Add the shared submenu before the widgets page handling.
anchor = '  if (page === "root") return root;\n\n'
submenu = '''  if (page === "connectDisplay") return <ConnectDisplayPage locale={locale} onBack={() => setPage("displays")} />;\n\n  if (page === "displays") {\n    return (\n      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>\n        <BackHeader title={t("Displays", "الشاشات")} onBack={() => setPage("root")} />\n        <Text style={styles.subtitle}>{t("Use one display menu for pairing and for wall / masjid screen mode.", "استخدم قائمة شاشات واحدة للربط ووضع شاشة الحائط أو المسجد.")}</Text>\n        <Section title={t("DISPLAY OPTIONS", "خيارات الشاشة")}>\n          <Row emoji="🔗" title={t("Connect Display", "ربط شاشة")} text={t("Pair this phone with a TV, tablet, iPad or computer using the 6-digit code", "اربط هذا الهاتف بتلفاز أو جهاز لوحي أو آيباد أو كمبيوتر باستخدام رمز من 6 أرقام")} onPress={() => setPage("connectDisplay")} />\n          <Row emoji="🕌" title={t("Wall & Masjid Display", "شاشة الحائط والمسجد")} text={t("Open the full-screen Hassoun prayer display for TVs and masjid screens", "افتح شاشة حسّون الكاملة لمواقيت الصلاة للتلفاز وشاشات المسجد")} onPress={() => void Linking.openURL(`${PUBLIC_BASE}/masjid-tv/`)} />\n        </Section>\n      </ScrollView>\n    );\n  }\n\n'''
if 'if (page === "displays")' not in s:
    if anchor not in s:
        raise SystemExit("Root-page return anchor missing")
    s = s.replace(anchor, anchor + submenu, 1)

P.write_text(s, encoding="utf-8")
print("Unified Connect Display and Wall & Masjid Display under one Displays menu")
