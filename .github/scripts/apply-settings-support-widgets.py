from pathlib import Path
import re

root = Path('.')
app = root / 'mobile/App.tsx'
text = app.read_text()

if 'import SettingsHub from "./src/SettingsHub";' not in text:
    text = text.replace('import IslamicQuiz from "./src/IslamicQuiz";\n', 'import IslamicQuiz from "./src/IslamicQuiz";\nimport SettingsHub from "./src/SettingsHub";\nimport HassounWidget from "./modules/hassoun-widget";\n')

needle = '  const upcomingBadge = nextBadge(quizStats.totalWins);\n\n'
if 'HassounWidget.syncPrayerSchedule' not in text:
    text = text.replace(needle, needle + '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) {\n      HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);\n    }\n  }, [prayerTimes, locale]);\n\n')

replacement = '''  const moreScreen = (\n    <SettingsHub\n      locale={locale}\n      onToggleLocale={toggleLocale}\n      onOpenAlerts={() => setActiveTab("alerts")}\n      onOpenEmailAlerts={onOpenEmailAlerts}\n    />\n  );'''
text, count = re.subn(r'  const moreScreen = \([\s\S]*?\n  \);\n\n  const body =', replacement + '\n\n  const body =', text, count=1)
if count != 1:
    raise SystemExit('Could not replace moreScreen')
app.write_text(text)

index = root / 'push-server/src/index.ts'
s = index.read_text()
if 'import { submitSupportContact } from "./support";' not in s:
    s = s.replace('import type { Env, Locale, PrayerFile } from "./types";\n', 'import { submitSupportContact } from "./support";\nimport type { Env, Locale, PrayerFile } from "./types";\n')
route_needle = '      } else if (request.method === "POST" && url.pathname === "/email/subscribers") {\n        response = await subscribeByEmail(request, env);\n'
if '/support/contact' not in s:
    s = s.replace(route_needle, '      } else if (request.method === "POST" && url.pathname === "/support/contact") {\n        response = await submitSupportContact(request, env);\n' + route_needle)
index.write_text(s)

config = root / 'mobile/app.config.ts'
c = config.read_text()
c = c.replace('version: "0.4.9"', 'version: "0.5.0"')
c = re.sub(r'versionCode:\s*21', 'versionCode: 22', c)
if 'NSMicrophoneUsageDescription' not in c:
    c = c.replace('NSLocationWhenInUseUsageDescription: "Hassoun uses your location to automatically select the correct local prayer times and email alert time zone."', 'NSLocationWhenInUseUsageDescription: "Hassoun uses your location to automatically select the correct local prayer times and email alert time zone.",\n      NSMicrophoneUsageDescription: "Hassoun uses the microphone only when you choose Qur’an recitation practice so the device speech-recognition service can compare your recitation."')
config.write_text(c)

workflow = root / '.github/workflows/android-debug.yml'
w = workflow.read_text()
w = w.replace('Hassoun-v0.4.9.apk', 'Hassoun-v0.5.0.apk')
w = w.replace('hassoun-v0.4.9-', 'hassoun-v0.5.0-')
w = w.replace('# Build Hassoun v0.4.9', '# Build Hassoun v0.5.0 settings/widgets')
workflow.write_text(w)

print('Integrated Settings & Support, support endpoint, widget sync, iOS microphone disclosure, and v0.5.0 labels')
