from pathlib import Path
import re

path = Path("mobile/App.tsx")
text = path.read_text()

import_anchor = 'import SettingsHub from "./src/SettingsHub";\n'
imports = import_anchor + 'import HomePrayerPanel from "./src/HomePrayerPanel";\nimport QiblaDirectionScreen from "./src/QiblaDirectionScreen";\n'
if 'import HomePrayerPanel from "./src/HomePrayerPanel";' not in text:
    if import_anchor not in text:
        raise SystemExit("SettingsHub import anchor not found")
    text = text.replace(import_anchor, imports, 1)

old_tab = 'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "more";'
new_tab = 'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "qibla" | "more";'
if old_tab in text:
    text = text.replace(old_tab, new_tab, 1)
elif new_tab not in text:
    raise SystemExit("AppTab anchor not found")

panel_pattern = re.compile(
    r'\n      \{next \? <View style=\{styles\.nextCard\}>.*?\n\n      <Pressable onPress=\{\(\) => setActiveTab\("quiz"\)\}',
    re.S,
)
panel_replacement = '''\n      <HomePrayerPanel
        locale={locale}
        today={today}
        next={next}
        preferences={phoneAlertPreferences}
        onTogglePrayer={(prayer) => void togglePrayerAudio(prayer)}
        onOpenQibla={() => setActiveTab("qibla")}
      />

      <Pressable onPress={() => setActiveTab("quiz")}'''
if '<HomePrayerPanel' not in text:
    text, count = panel_pattern.subn(panel_replacement, text, count=1)
    if count != 1:
        raise SystemExit(f"Expected one home prayer block, replaced {count}")

body_anchor = '''        : activeTab === "events"
          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />
          : activeTab === "more"
            ? moreScreen
            : homeScreen;'''
body_replacement = '''        : activeTab === "events"
          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />
          : activeTab === "qibla"
            ? <QiblaDirectionScreen locale={locale} onBack={() => setActiveTab("home")} />
            : activeTab === "more"
              ? moreScreen
              : homeScreen;'''
if 'activeTab === "qibla"' not in text:
    if body_anchor not in text:
        raise SystemExit("body navigation anchor not found")
    text = text.replace(body_anchor, body_replacement, 1)

nav_anchor = '{(activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>'
nav_replacement = '{activeTab !== "qibla" && (activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>'
if nav_anchor in text:
    text = text.replace(nav_anchor, nav_replacement, 1)

path.write_text(text)
print("Applied Hassoun home prayer redesign + Qibla navigation integration")
