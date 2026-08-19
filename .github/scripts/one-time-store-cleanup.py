from pathlib import Path
import json

root = Path('.')

# 1) Browser notification typings: renotify is not in the current TS DOM NotificationOptions.
path = root / 'pwa/app/PrayerAlertAudioEnhancer.tsx'
text = path.read_text()
text = text.replace('      renotify: true,\n', '')
path.write_text(text)

# 2) querySelector returns Element; this handler only needs the base Event API.
path = root / 'pwa/app/QuranCleanReadingEnhancer.tsx'
text = path.read_text()
text = text.replace('const onOpenTools = (event: MouseEvent) => {', 'const onOpenTools = (event: Event) => {')
path.write_text(text)

# 3) Explicitly widen fallback word arrays to the declared QuranWord type.
path = root / 'pwa/app/quran/page.tsx'
text = path.read_text()
needle = 'const words = verse.words?.length ? verse.words : verseText(verse).split(/\\s+/).map((text, index) => ({ position: index + 1, text_uthmani: text }));'
replacement = 'const words: QuranWord[] = verse.words?.length ? verse.words : verseText(verse).split(/\\s+/).map((text, index) => ({ position: index + 1, text_uthmani: text }));'
count = text.count(needle)
if count != 2:
    raise SystemExit(f'Expected 2 Quran word fallback expressions, found {count}')
text = text.replace(needle, replacement)
path.write_text(text)

# 4) The legacy Cloudflare worker/db folders are separate runtimes, not part of Next.js type checking.
path = root / 'pwa/tsconfig.json'
data = json.loads(path.read_text())
data['exclude'] = sorted(set(data.get('exclude', []) + ['node_modules', 'worker/**', 'db/**']))
path.write_text(json.dumps(data, indent=2) + '\n')

# 5) Fix Admin CRM maintenance inputs so they are editable before saving on blur.
path = root / 'pwa/app/admin/AdminControlCenter.tsx'
text = path.read_text()
old_en = '<Field label="Maintenance message (English)"><input value={String(appUi.maintenanceMessageEn || "")} onChange={(event) => setJsonDrafts((old) => ({ ...old, _maintenanceEn: event.target.value }))} onBlur={() => jsonDrafts._maintenanceEn !== undefined && saveAppUiPatch({ maintenanceMessageEn: jsonDrafts._maintenanceEn })} style={S.input} /></Field>'
new_en = '<Field label="Maintenance message (English)"><input key={`maintenance-en-${String(appUi.maintenanceMessageEn || "")}`} defaultValue={String(appUi.maintenanceMessageEn || "")} onBlur={(event) => saveAppUiPatch({ maintenanceMessageEn: event.target.value })} style={S.input} /></Field>'
old_ar = '<Field label="Maintenance message (Arabic)"><input value={String(appUi.maintenanceMessageAr || "")} onChange={(event) => setJsonDrafts((old) => ({ ...old, _maintenanceAr: event.target.value }))} onBlur={() => jsonDrafts._maintenanceAr !== undefined && saveAppUiPatch({ maintenanceMessageAr: jsonDrafts._maintenanceAr })} style={S.input} /></Field>'
new_ar = '<Field label="Maintenance message (Arabic)"><input key={`maintenance-ar-${String(appUi.maintenanceMessageAr || "")}`} defaultValue={String(appUi.maintenanceMessageAr || "")} onBlur={(event) => saveAppUiPatch({ maintenanceMessageAr: event.target.value })} style={S.input} /></Field>'
if old_en not in text or old_ar not in text:
    raise SystemExit('Admin maintenance input pattern changed; refusing unsafe patch')
text = text.replace(old_en, new_en).replace(old_ar, new_ar)
path.write_text(text)

# 6) Keep package-lock root metadata aligned with Hassoun 1.0.0.
path = root / 'mobile/package-lock.json'
data = json.loads(path.read_text())
data['name'] = 'hassoun-mobile'
data['version'] = '1.0.0'
root_package = data.get('packages', {}).get('')
if isinstance(root_package, dict):
    root_package['name'] = 'hassoun-mobile'
    root_package['version'] = '1.0.0'
path.write_text(json.dumps(data, indent=2) + '\n')

# Remove this one-time patch machinery from the final branch state.
(root / '.github/workflows/one-time-store-cleanup.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
