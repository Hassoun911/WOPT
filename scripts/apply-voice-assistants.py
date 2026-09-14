from pathlib import Path

path = Path(__file__).resolve().parents[1] / "mobile" / "src" / "SettingsHub.tsx"
text = path.read_text(encoding="utf-8")

import_anchor = 'import BrandMark from "./BrandMark";\n'
voice_import = 'import VoiceAssistantsPage from "./VoiceAssistantsPage";\n'
if voice_import not in text:
    if import_anchor not in text:
        raise SystemExit("SettingsHub BrandMark import anchor missing")
    text = text.replace(import_anchor, import_anchor + voice_import, 1)

old_type = 'type SettingsPage = "root" | "about" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";'
new_type = 'type SettingsPage = "root" | "about" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets" | "voiceAssistants";'
if old_type in text:
    text = text.replace(old_type, new_type, 1)
elif '"voiceAssistants"' not in text.split("type SettingsPage", 1)[1].split(";", 1)[0]:
    raise SystemExit("SettingsHub page union anchor missing")

row_anchor = '        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />\n'
voice_row = '        <Row emoji="🎙️" title={t("Voice Assistants", "المساعدات الصوتية")} text={t("Connect Hassoun to Alexa and Google Home", "اربط Hassoun مع Alexa وGoogle Home")} onPress={() => setPage("voiceAssistants")} />\n'
if voice_row not in text:
    if row_anchor not in text:
        raise SystemExit("SettingsHub prayer alerts row anchor missing")
    text = text.replace(row_anchor, row_anchor + voice_row, 1)

route_anchor = '  if (page === "root") return root;\n\n'
voice_route = '  if (page === "voiceAssistants") return <VoiceAssistantsPage locale={locale} onBack={() => setPage("root")} />;\n\n'
if voice_route not in text:
    if route_anchor not in text:
        raise SystemExit("SettingsHub root route anchor missing")
    text = text.replace(route_anchor, route_anchor + voice_route, 1)

path.write_text(text, encoding="utf-8")
print("Voice Assistants added to the native Hassoun menu/settings hub")
