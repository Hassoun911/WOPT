#!/usr/bin/env bash
set -euo pipefail

# Reuse the proven v1.0.43 reconstruction/build pipeline, insert the v1.0.44
# behavior patch before verification/TypeScript/prebuild, and bump the artifact.
python3 - <<'PY'
from pathlib import Path

src = Path('.github/scripts/build-v1043-windsor-directory-resume.sh')
s = src.read_text(encoding='utf-8')

anchor = 'python3 .github/scripts/fix-v1043-windsor-directory-and-nested-resume.py\n'
insert = anchor + 'python3 .github/scripts/fix-v1044-gps-prayer-mosque-display.py\n'
if anchor not in s:
    raise SystemExit('v1.0.43 patch anchor missing')
s = s.replace(anchor, insert, 1)

s = s.replace('1.0.43', '1.0.44')
s = s.replace('versionCode: 87', 'versionCode: 88')
s = s.replace('HASSOUN_ANDROID_V1043_SOURCE_VERIFIED', 'HASSOUN_ANDROID_V1044_SOURCE_VERIFIED')
s = s.replace('HASSOUN_ANDROID_V1043_MANIFEST_VERIFIED', 'HASSOUN_ANDROID_V1044_MANIFEST_VERIFIED')
s = s.replace('HASSOUN_V1043_APK_READY', 'HASSOUN_V1044_APK_READY')
s = s.replace('Hassoun-v1.0.44-windsor-mosques-resume.apk', 'Hassoun-v1.0.44-gps-prayer-mosque-display.apk')

out = Path('/tmp/build-v1044-gps-prayer-mosque-display.sh')
out.write_text(s, encoding='utf-8')
out.chmod(0o755)
PY

bash /tmp/build-v1044-gps-prayer-mosque-display.sh
