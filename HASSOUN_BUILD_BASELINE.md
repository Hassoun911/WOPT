# Hassoun Android build baseline

This file is the source-of-truth for future Android APK work. Do **not** build a new Hassoun APK from `main` by default.

## Current approved baseline

- Approved app version: **v1.0.20**
- Exact source-input commit used by the approved/store generation: `ae1efdf4ac082e6f4bf64d3b08d3bdccb23e8166`
- Successful known-good APK workflow run: **33691732758** — `Build Hassoun v1.0.20 Fast Start + Quran Direction`
- Successful Google Play signed generation: **33698054345** — v1.0.20 / versionCode 64
- Permanent baseline branch: **`hassoun-golden-v1.0.20`**
- Moving approved pointer branch: **`hassoun-last-approved`**

## Important

The approved v1.0.20 APK was not produced by simply compiling the repository at one commit. The workflow reconstructs the full feature stack before building. Preserve the same reconstruction recipe, including Masjid/TV, Qur'an, branding, splash, widgets, About/Sadaqah page, games, alerts and navigation.

## Build rule

1. Start from `hassoun-last-approved`, **not `main`**.
2. Reconstruct the exact approved feature stack when the approved baseline requires workflow-time patches.
3. Apply only the requested changes on a candidate branch/build.
4. Build and test the APK.
5. **Only after the user explicitly approves the APK**, move `hassoun-last-approved` to that approved source/tooling commit and update this file with the new version, run ID, artifact name and SHA-256.
6. Never move the approved pointer because a CI job merely turned green. User approval is required.

## Current candidate

v1.0.21 is still a candidate and is **not yet approved**. It includes the location/city fix, no forced reload on resume, unified Displays menu, and pull-to-refresh work. Do not replace the approved pointer until the user confirms the tested APK is correct.

## Verification markers for the approved UI

Future builds must retain the approved UI/features unless explicitly changed, including:
- `About Hassoun`
- `A continuing Sadaqah Jariyah`
- `Abdul Jalil Hassoun`
- `Salwa Hassoun`
- bottom navigation / Qur'an / Games / Alerts / More
- approved Hassoun logo and branding
- Wall/Masjid/TV and device pairing features

