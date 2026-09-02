from pathlib import Path
import runpy

qpath = Path('mobile/src/quran/QuranV3.tsx')
q = qpath.read_text(encoding='utf-8')

# Add a durable session key so Android process recreation returns to the same Quran view.
q = q.replace('  radioPlaylist: "wopt:quran:radio-playlist:v1"\n};', '  radioPlaylist: "wopt:quran:radio-playlist:v1",\n  session: "wopt:quran:session:v1"\n};', 1)

# Extend startup load to include the saved Quran session.
old = '''      const [savedLast, savedBookmarks, savedAudioPrefs, savedMemorize, savedRadioPlaylist] = await Promise.all([\n        AsyncStorage.getItem(KEYS.last),\n        AsyncStorage.getItem(KEYS.bookmarks),\n        AsyncStorage.getItem(KEYS.audioPrefs),\n        AsyncStorage.getItem(KEYS.memorize),\n        AsyncStorage.getItem(KEYS.radioPlaylist)\n      ]);'''
new = '''      const [savedLast, savedBookmarks, savedAudioPrefs, savedMemorize, savedRadioPlaylist, savedSession] = await Promise.all([\n        AsyncStorage.getItem(KEYS.last),\n        AsyncStorage.getItem(KEYS.bookmarks),\n        AsyncStorage.getItem(KEYS.audioPrefs),\n        AsyncStorage.getItem(KEYS.memorize),\n        AsyncStorage.getItem(KEYS.radioPlaylist),\n        AsyncStorage.getItem(KEYS.session)\n      ]);'''
if old not in q:
    raise SystemExit('Could not find startup Promise.all block')
q = q.replace(old, new, 1)

anchor = '''      try { if (savedRadioPlaylist) setRadioPlaylist(JSON.parse(savedRadioPlaylist) as number[]); } catch {}\n      setLoaded(true);'''
restore = '''      try { if (savedRadioPlaylist) setRadioPlaylist(JSON.parse(savedRadioPlaylist) as number[]); } catch {}\n      try {\n        if (savedSession) {\n          const session = JSON.parse(savedSession) as { screen?: Screen; position?: Position; selected?: Position | null };\n          if (session.position && getAyah(session.position.surah, session.position.ayah)) {\n            setPosition(session.position);\n            setLastPosition(session.position);\n          }\n          if (session.screen === \"reader\" && session.position) {\n            setScreen(\"reader\");\n            setBackTarget(\"home\");\n            const selected = session.selected ? getAyah(session.selected.surah, session.selected.ayah) : null;\n            setSelectedAyah(selected ?? null);\n          }\n        }\n      } catch {}\n      setLoaded(true);'''
if anchor not in q:
    raise SystemExit('Could not find startup restore anchor')
q = q.replace(anchor, restore, 1)

# Persist reader session continuously, but only after initial storage hydration.
persist_anchor = '''  const persistAudioPrefs = (patch: Partial<AudioPrefs>) => {'''
persist_effect = '''  useEffect(() => {\n    if (!loaded) return;\n    const selected = selectedAyah ? { surah: selectedAyah.surah, ayah: selectedAyah.ayah } : null;\n    const session = { screen, position, selected };\n    void AsyncStorage.setItem(KEYS.session, JSON.stringify(session));\n  }, [loaded, screen, position.surah, position.ayah, selectedAyah?.surah, selectedAyah?.ayah]);\n\n'''
if persist_anchor not in q:
    raise SystemExit('Could not find persistence insertion anchor')
q = q.replace(persist_anchor, persist_effect + persist_anchor, 1)

required = [
    'session: "wopt:quran:session:v1"',
    'AsyncStorage.getItem(KEYS.session)',
    'if (session.screen === "reader"',
    'AsyncStorage.setItem(KEYS.session',
]
for marker in required:
    if marker not in q:
        raise SystemExit('Missing Quran session restore requirement: ' + marker)

qpath.write_text(q, encoding='utf-8')
print('Applied v1.0.18 Quran background/process session restore.')

# Reader Settings is horizontal Arabic-book paging only. This also migrates old
# saved vertical settings so up/down can never return as a page-navigation mode.
runpy.run_path('scripts/apply-v1018-horizontal-only-reader-settings.py', run_name='__main__')
