# Hassoun LATEST-GOOD baseline

Do not start mobile app work from an older branch or an older APK source.

## Current verified baseline

- Baseline branch: `baseline/hassoun-v1.0.7-apk-good`
- Moving latest-good branch: `latest-good`
- Source branch recovered from: `work/hassoun-1.0-store-admin`
- Ground-truth APK supplied by owner: `Hassoun-current.apk`
- App version: `1.0.7`
- Android versionCode: `48`
- iOS buildNumber: `2`
- Package: `ca.wopt.windsorprayertimes`
- Smart Memorize / Tahfiz: REQUIRED
- Quran V3 / radio / widgets / current app functionality: REQUIRED

## Forward-only rule

1. New Hassoun mobile work MUST branch from `latest-good` (or a newer verified successor).
2. Never replace mobile source with `main`, `release/hassoun-1.0`, or any branch whose app version/versionCode is lower than this baseline.
3. Before an APK is delivered, verify `mobile/app.config.ts` is not below version `1.0.7` / versionCode `48` and verify `mobile/src/quran/QuranV3.tsx` still imports `./SmartMemorize`.
4. When a newer APK is installed and confirmed good by the owner, move `latest-good` forward and create a new immutable `baseline/hassoun-vX.Y.Z-apk-good` snapshot.
5. The immutable baseline branch must never be rewritten.

This file exists to prevent accidental backward builds and feature loss.
