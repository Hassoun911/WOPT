# Hassoun Product Release Index — 2026-08-23

Date: 2026-08-23

## Android
- Product: Hassoun Android app
- Version line: v1.0.8
- Dated reference branch: `release/android-2026-08-23`
- Current integration branch: `build/v108-good-apk-layout-only`
- Dated artifact naming: `Hassoun-Android-v1.0.8-2026-08-23.apk`
- Current feature line includes the redesigned prayer home, interactive Al-Hafiz study cards, fast widget launch, Ask the Sheikh, improved Islamic events, app guide and Android back-navigation fixes.
- Status rule: only mark the APK verified after the dated build workflow is green and the standalone APK artifact is present.

## Wear OS / Watch
- Product: Hassoun Wear OS/watch package
- Dated reference branch: `release/watch-2026-08-23`
- Source snapshot: `fix/watchface-v113-final-package`
- Convenience alias: `release/watch-current`
- Future watch artifacts should use `Hassoun-Watch-<version>-2026-08-23.apk` or the actual build date for newer packages.

## Website
- Product: hassoun.app web/PWA
- Source folder: `pwa/`
- Dated parity branch: `work/website-2026-08-23-app-parity`
- Status: current website is older than the Android app layout/feature set and must be updated on the website branch before deployment.
- Target: match the current Hassoun visual language and expose web-compatible versions of the current product sections without pretending browser-only features are identical to native Android.

## Admin / CRM
- Folder: `admin-crm/`
- Status: separate operational product surface. Do not mix admin layout changes into Android/watch/web release branches.

## Backend / runtime
- Folder: `push-server/`
- Status: shared services for runtime config, notifications and related server features. Backend changes require their own dated notes when they affect a release.

## Naming rule
Every new release snapshot, build artifact, deployment note and major work branch created after this index must include an ISO date (`YYYY-MM-DD`).
