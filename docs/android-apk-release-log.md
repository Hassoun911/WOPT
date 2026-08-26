# Hassoun Android APK Release Log

This file is the source of truth for the last Android APK issued to and confirmed by the user.

## Last APK issued — GOLDEN BASELINE

- Version: **v1.0.11**
- Android versionCode: **52**
- Package: **ca.wopt.windsorprayertimes**
- Filename: **Hassoun-v1.0.11-city-highlight-fixed.apk**
- Approx. size: **76.50 MB**
- SHA-256: **125766bc755f06b8537a62b1aff7ba5817fb9bd07361adec8309a85bc0107472**
- Embedded Android bundle SHA-256: **ad125d2956f69674ae1c89673dc69e1dbe212386cb13a0ca56662c770adb95c6**
- Confirmed by user upload: **2026-08-26**
- Status: **Last confirmed good APK / mandatory golden baseline**
- Branding: **Hassoun bird + Qur'an gold/green logo**
- Key confirmed behavior: city-name fix, strong Next Prayer highlight, working prayer/audio/Qur'an/Qibla/School features from this build.
- Rule: **Every future Android APK must be built forward from this v1.0.11 lineage or reproduce this exact baseline before layering new changes. Never build a replacement APK directly from an unrelated main/older branch.**
- Current approved next change: add only the unified messaging system (server push registration + CRM-controlled scrolling system message) while preserving all v1.0.11 behavior and branding.

## Release logging rule

Every time a new Hassoun Android APK is built or issued, update this file with:

1. Version number
2. Exact APK filename
3. Android versionCode
4. Package name
5. Branch/ref/build recipe used
6. Commit SHA and workflow run
7. Build date/time
8. Approx. APK size
9. APK SHA-256
10. Key changes included
11. Install/test status reported by the user
12. Mark the newest user-confirmed good record clearly as **GOLDEN BASELINE**

Do not infer the APK version or baseline from a branch name alone. Match the APK filename/version/hash to the actual build record whenever possible. A newly built APK does not replace the golden baseline until the user confirms it is good.
