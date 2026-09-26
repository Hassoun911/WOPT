#!/usr/bin/env bash
set -euo pipefail

mkdir -p /tmp/hassoun-latest/mobile/src /tmp/hassoun-latest/mobile/scripts /tmp/hassoun-latest/scripts
cp mobile/src/prayerData.ts /tmp/hassoun-latest/mobile/src/prayerData.ts
cp mobile/src/locationUsage.ts /tmp/hassoun-latest/mobile/src/locationUsage.ts
cp mobile/src/VoiceAssistantsPage.tsx /tmp/hassoun-latest/mobile/src/VoiceAssistantsPage.tsx
cp mobile/scripts/apply-location-usage-telemetry.mjs /tmp/hassoun-latest/mobile/scripts/apply-location-usage-telemetry.mjs
cp scripts/apply-voice-assistants.py /tmp/hassoun-latest/scripts/apply-voice-assistants.py

bash .github/tablet/build-apk.sh

cp /tmp/hassoun-latest/mobile/src/prayerData.ts mobile/src/prayerData.ts
cp /tmp/hassoun-latest/mobile/src/locationUsage.ts mobile/src/locationUsage.ts
cp /tmp/hassoun-latest/mobile/src/VoiceAssistantsPage.tsx mobile/src/VoiceAssistantsPage.tsx
mkdir -p mobile/scripts
cp /tmp/hassoun-latest/mobile/scripts/apply-location-usage-telemetry.mjs mobile/scripts/apply-location-usage-telemetry.mjs
cp /tmp/hassoun-latest/scripts/apply-voice-assistants.py scripts/apply-voice-assistants.py
node mobile/scripts/apply-location-usage-telemetry.mjs
python3 scripts/apply-voice-assistants.py

python3 .github/scripts/fix-v1037-gps-mosque-source.py
python3 .github/scripts/fix-v1039-mosques-near-me.py
python3 .github/scripts/fix-v1040-mosque-directory-reliability.py
python3 .github/scripts/fix-v1041-nearest-mosque-home.py
python3 .github/scripts/fix-v1042-mosque-search-timeouts.py
python3 .github/scripts/fix-v1038-permissions-control-center.py
python3 .github/scripts/fix-v1038-permissions-location-services.py

python3 - <<'PY'
from pathlib import Path
import re
p = Path('mobile/app.config.ts')
s = p.read_text(encoding='utf-8')
s = re.sub(r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"', 'version: "1.0.42"', s, count=1)
s = re.sub(r'versionCode:\s*\d+', 'versionCode: 86', s, count=1)
if 'version: "1.0.42"' not in s or 'versionCode: 86' not in s:
    raise SystemExit('Unable to bump Android v1.0.42 / versionCode 86')
p.write_text(s, encoding='utf-8')
PY

python3 - <<'PY'
from pathlib import Path
mosques = Path('mobile/src/NearbyMosquesPage.tsx').read_text(encoding='utf-8')
home = Path('mobile/src/HomePrayerPage.tsx').read_text(encoding='utf-8')
pref = Path('mobile/src/nearestMosquePreference.ts').read_text(encoding='utf-8')
cfg = Path('mobile/app.config.ts').read_text(encoding='utf-8')
for marker in ['fetchWithTimeout','MOSQUE_SEARCH_TIMEOUT','12000','5000','3500','overpass.kumi.systems/api/interpreter','export async function findNearbyMosques','Show nearest mosque on Home']:
    if marker not in mosques: raise SystemExit(f'Missing v1.0.42 mosque marker: {marker}')
for marker in ['nearestMosqueEnabled','NEAREST MOSQUE','MOSQUE_SEARCH_TIMEOUT','nearestMosqueCard']:
    if marker not in home: raise SystemExit(f'Missing v1.0.42 Home marker: {marker}')
for marker in ['SHOW_NEAREST_MOSQUE_HOME_KEY','saveShowNearestMosqueOnHome']:
    if marker not in pref: raise SystemExit(f'Missing nearest-mosque preference marker: {marker}')
for marker in ['version: "1.0.42"','versionCode: 86']:
    if marker not in cfg: raise SystemExit(f'Missing config marker: {marker}')
print('HASSOUN_ANDROID_V1042_SOURCE_VERIFIED')
PY

cd mobile
npm install --no-save --include=optional @typescript/typescript-linux-x64@7.0.2
npx tsc --noEmit
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
required={
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
}
missing=sorted(required-perms)
if missing: raise SystemExit(f'Generated Android permissions missing: {missing}')
if 'android.permission.USE_EXACT_ALARM' in perms:
    raise SystemExit('USE_EXACT_ALARM must not be present')
if app is not None:
    banner=Path('mobile/android/app/src/main/res/drawable/hassoun_widget_logo.png')
    if banner.exists(): app.set(f'{{{ns}}}banner','@drawable/hassoun_widget_logo')
    main=next((a for a in app.findall('activity') if a.attrib.get(f'{{{ns}}}name','').endswith('MainActivity')),None)
    if main is not None:
        for k,v in {'screenOrientation':'unspecified','launchMode':'singleTask','alwaysRetainTaskState':'true','clearTaskOnLaunch':'false','finishOnTaskLaunch':'false','noHistory':'false','documentLaunchMode':'never'}.items():
            main.set(f'{{{ns}}}{k}',v)
tree.write(p,encoding='utf-8',xml_declaration=True)
PY

cd mobile/android
chmod +x gradlew
./gradlew clean assembleRelease --no-daemon --max-workers=2 --stacktrace
cd ../..

APK="$(find mobile/android/app/build/outputs/apk/release -name '*.apk' ! -name 'Hassoun-v*.apk' | head -n1)"
test -s "$APK"
OUT="mobile/android/app/build/outputs/apk/release/Hassoun-v1.0.42-mosque-timeout-fix.apk"
cp "$APK" "$OUT"
sha256sum "$OUT" | tee "$OUT.sha256"
echo "HASSOUN_V1042_APK_READY=$OUT"
