#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

VERSION="1.0.33"
VERSION_CODE="77"
GOOD="ae1efdf4ac082e6f4bf64d3b08d3bdccb23e8166"
OUT="mobile/android/app/build/outputs/apk/release/Hassoun-v${VERSION}-tablet.apk"

echo "== Hassoun canonical tablet build v${VERSION} (${VERSION_CODE}) =="

# Reconstruct from the protected last-good source inputs. This deliberately does not
# replace .github/scripts or .github/tablet, which are the current patch/build logic.
git checkout "$GOOD" -- mobile scripts .github/logo-official

cd mobile
npm ci --ignore-scripts --no-audit --no-fund
npx expo install expo-image-picker expo-file-system expo-battery expo-brightness expo-document-picker expo-screen-orientation expo-video expo-splash-screen expo-camera expo-linear-gradient expo-keep-awake expo-navigation-bar react-native-webview --npm
npm install --no-save --include=optional @typescript/typescript-linux-x64@7.0.2

node scripts/apply-wall-shell-for-masjid.mjs
node scripts/apply-masjid-tv.mjs
node scripts/apply-masjid-remote.mjs
node scripts/apply-masjid-typefix.mjs
node scripts/apply-masjid-tv-fixes.mjs
node scripts/apply-masjid-clock-click-branding.mjs
cd ..

python3 scripts/apply-v1015-full-store-fixes.py
python3 scripts/apply-v1017-quran-word-swipe-fixes.py
python3 scripts/fix-v1017-quran-word-styles.py
python3 scripts/apply-v1018-reader-gesture-hardfix.py
python3 scripts/apply-v1018-quran-session-restore.py
python3 scripts/apply-v1019-splash-animation.py
python3 scripts/apply-v1020-fast-location-startup.py

python3 -m pip install --quiet Pillow
tr -d '\n\r ' < .github/logo-official/hassoun-official-256.jpg.b64 | base64 --decode > /tmp/hassoun-approved.jpg
python3 - <<'PY'
from pathlib import Path
from PIL import Image, ImageOps
source=Image.open('/tmp/hassoun-approved.jpg').convert('RGB')
full=source.resize((1024,1024),Image.Resampling.LANCZOS).convert('RGBA')
full.save('mobile/assets/hassoun-logo.png','PNG',optimize=True)
full.save('mobile/assets/splash-logo.png','PNG',optimize=True)
bg=(7,43,37,255)
legacy=Image.new('RGBA',(1024,1024),bg)
art=ImageOps.contain(source,(770,770),Image.Resampling.LANCZOS).convert('RGBA')
legacy.alpha_composite(art,((1024-art.width)//2,(1024-art.height)//2))
legacy.save('mobile/assets/icon.png','PNG',optimize=True)
adaptive=Image.new('RGBA',(1024,1024),(0,0,0,0))
art2=ImageOps.contain(source,(700,700),Image.Resampling.LANCZOS).convert('RGBA')
adaptive.alpha_composite(art2,((1024-art2.width)//2,(1024-art2.height)//2))
adaptive.save('mobile/assets/adaptive-icon.png','PNG',optimize=True)
widget=Path('mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_logo.png')
widget.parent.mkdir(parents=True,exist_ok=True)
full.resize((512,512),Image.Resampling.LANCZOS).save(widget,'PNG',optimize=True)
PY

# Protected canonical app fixes.
python3 .github/scripts/fix-v1021-no-resume-reload.py
python3 .github/scripts/fix-v1021-native-masjid-display.py
python3 .github/scripts/fix-v1021-unified-display-menu.py
python3 .github/scripts/fix-v1021-pull-to-refresh.py
python3 .github/scripts/fix-v1022-first-launch-camera-refresh.py
python3 .github/scripts/fix-v1023-adhan-refresh-hardfix.py
python3 .github/scripts/fix-v1028-never-reset-on-background.py
python3 .github/scripts/fix-v1029-exact-alarm-permission.py

# One canonical entry point for all tablet-specific patches.
python3 .github/tablet/apply-current.py

python3 - <<'PY'
from pathlib import Path
page=Path('mobile/src/MasjidDisplayPage.tsx').read_text(encoding='utf-8')
editor=Path('mobile/src/ConnectDisplayPage.tsx').read_text(encoding='utf-8')
app=Path('mobile/App.tsx').read_text(encoding='utf-8')
cfg=Path('mobile/app.config.ts').read_text(encoding='utf-8')
manifest=Path('mobile/modules/prayer-audio/android/src/main/AndroidManifest.xml').read_text(encoding='utf-8')

page_markers=[
 'HASSOUN_NATIVE_TABLET_GRAND_V1','useKeepAwake()','HASSOUN_TABLET_PRAYER_RUNTIME_V1',
 'schedulePrayerNotifications(times, locale, preferences','tabletPrayerRuntimeStatus',
 'requestedHeroBand','requestedMiniBand','HASSOUN_TABLET_5MIN_BEAT_V1','imminentPrayer','PRAYER SOON',
 'countdownScale','countdownColor','countdownFont','openExactAlarmSettings','miniHeight / requestedMiniBand',
 'height:heroAvailableHeight','Animated.loop','"exactAlarmGranted" in result','backgroundYouTubeId',
 'backgroundYouTubeUrl','react-native-webview','backgroundVideoUrl && !backgroundYouTubeId ? <VideoView',
 'clock24Hour','HASSOUN_TABLET_LAYOUT_PERSIST_V3','HASSOUN_TABLET_LAYOUT_RESTORE_EFFECT_V3',
 'hassoun:tablet-layout-backup:v3','tabletLayoutBackupReadyRef','backupTheme',
 'AsyncStorage.setItem(LAYOUT_BACKUP_KEY, JSON.stringify(remoteTheme))',
 'HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V3','HASSOUN_TABLET_IMMERSIVE_FULLSCREEN_V1',
 'HASSOUN_TABLET_FORCED_CLOCK_V3','forcedClockTextV1033','toggleTabletPrayerAthan',
 'savePhonePrayerAlertPreferences','tabletPrayerPrefs?.[p.key]?.athan',
 'schedulePrayerNotifications(times, locale, saved'
]
for marker in page_markers:
    if marker not in page:
        raise SystemExit(f'Missing tablet page invariant: {marker}')

editor_markers=[
 'MAIN GALLERY PRAYER CARD SIZE','LOWER PRAYER CARDS SIZE','MAIN CARD WIDTH','MAIN CARD HEIGHT',
 'COUNTDOWN / TIME LEFT','TIME LEFT SIZE','5-minute heartbeat + freeze','FREEZE / BEAT BEFORE PRAYER',
 'TABLET PRAYER ENGINE','No maximum.','WHOLE DISPLAY BACKGROUND','LAYOUT IDEAS · ONE TAP',
 'Paste a YouTube link','Use 24-hour clock","clock24Hour"','HASSOUN_DISPLAY_EDITOR_RESUME_V1',
 'hassoun:display-editor-state:v1','restoreSavedDisplayEditor','pairedLoaded','showPrayerPeriod'
]
for marker in editor_markers:
    if marker not in editor:
        raise SystemExit(f'Missing tablet editor invariant: {marker}')

for marker in ['HASSOUN_EXACT_ALARM_PERMISSION_V4','HASSOUN_BACKGROUND_RESUME_NO_RESET_V4','hassoun:resume-exact-screen:v1']:
    if marker not in app:
        raise SystemExit(f'Missing protected app invariant: {marker}')
if 'android.permission.SCHEDULE_EXACT_ALARM' not in manifest:
    raise SystemExit('SCHEDULE_EXACT_ALARM missing in prayer-audio manifest')
for marker in ['version: "1.0.33"','versionCode: 77','android.permission.SCHEDULE_EXACT_ALARM']:
    if marker not in cfg:
        raise SystemExit(f'Missing v1.0.33 config marker: {marker}')
if 'setBehaviorAsync' in page or 'StyleSheet.absoluteFillObject' in page:
    raise SystemExit('Unsupported tablet SDK API survived reconstruction')
print('HASSOUN_V1033_SOURCE_VERIFIED')
PY

cd mobile
npm install --no-save --include=optional @typescript/typescript-linux-x64@7.0.2
test -e node_modules/@typescript/typescript-linux-x64/package.json
npm run typecheck
rm -rf android
npx expo prebuild --platform android --clean --no-install
cd ..

python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
p=Path('mobile/android/app/src/main/AndroidManifest.xml')
ns='http://schemas.android.com/apk/res/android'
ET.register_namespace('android',ns)
tree=ET.parse(p)
root=tree.getroot(); app=root.find('application')
perms={x.attrib.get(f'{{{ns}}}name') for x in root.findall('uses-permission')}
if 'android.permission.SCHEDULE_EXACT_ALARM' not in perms:
    raise SystemExit('Generated SCHEDULE_EXACT_ALARM missing')
if 'android.permission.USE_EXACT_ALARM' in perms:
    raise SystemExit('USE_EXACT_ALARM must not be present')
app.set(f'{{{ns}}}banner','@drawable/hassoun_widget_logo')
main=next((a for a in app.findall('activity') if a.attrib.get(f'{{{ns}}}name','').endswith('MainActivity')),None)
if main is None:
    raise SystemExit('MainActivity missing')
for k,v in {'screenOrientation':'unspecified','launchMode':'singleTask','alwaysRetainTaskState':'true','clearTaskOnLaunch':'false','finishOnTaskLaunch':'false','noHistory':'false','documentLaunchMode':'never'}.items():
    main.set(f'{{{ns}}}{k}',v)
tree.write(p,encoding='utf-8',xml_declaration=True)
print('HASSOUN_ANDROID_TASK_AND_ALARMS_VERIFIED')
PY

cd mobile/android
chmod +x gradlew
./gradlew clean assembleRelease --no-daemon --max-workers=2 --stacktrace
cd ../..

APK="$(find mobile/android/app/build/outputs/apk/release -name '*.apk' ! -name 'Hassoun-v*.apk' | head -n1)"
if [[ -z "$APK" ]]; then
  APK="$(find mobile/android/app/build/outputs/apk/release -name '*.apk' | head -n1)"
fi
test -s "$APK"
cp "$APK" "$OUT"
sha256sum "$OUT" | tee "$OUT.sha256"
echo "HASSOUN_V1033_APK_READY=$OUT"
