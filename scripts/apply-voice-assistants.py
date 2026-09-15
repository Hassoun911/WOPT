from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "mobile" / "src" / "SettingsHub.tsx"
text = path.read_text(encoding="utf-8")

import_anchor = 'import BrandMark from "./BrandMark";\n'
voice_import = 'import VoiceAssistantsPage from "./VoiceAssistantsPage";\n'
if voice_import not in text:
    if import_anchor not in text:
        raise SystemExit("SettingsHub BrandMark import anchor missing")
    text = text.replace(import_anchor, import_anchor + voice_import, 1)

# Keep this patch resilient as SettingsHub gains new pages (for example "guide").
# Add voiceAssistants to whatever SettingsPage string-union currently exists rather
# than requiring one historical exact union literal.
type_match = re.search(r'type\s+SettingsPage\s*=\s*([^;]+);', text)
if not type_match:
    raise SystemExit("SettingsHub page union anchor missing")
if '"voiceAssistants"' not in type_match.group(1):
    replacement = type_match.group(0)[:-1].rstrip() + ' | "voiceAssistants";'
    text = text[:type_match.start()] + replacement + text[type_match.end():]

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
