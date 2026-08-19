# Hassoun baseline backup — August 19, 2026

This file marks the preserved baseline of the Hassoun/WOPT project before the store-readiness cleanup and Admin CRM work begins.

## Backup status

- Original branch preserved: `main`
- Full backup branch: `backup/pre-store-crm-2026-08-19`
- Date recorded: August 19, 2026
- Latest confirmed Android app line: Hassoun v0.6.17
- A release APK was successfully built and verified through GitHub Actions before this backup.
- The purpose of this branch is to preserve the full working source exactly as it existed before further store/CRM changes.

## What was working at this point

- Android app installed and launched.
- Main prayer-time app experience was functioning.
- Windsor prayer schedule data was available with bundled/offline fallback.
- Prayer reminders and native Android Adhan/audio infrastructure were present.
- Qur'an reader was present with Surah/Juz/page/search/bookmark/memorization work already integrated.
- Qur'an audio/radio and Android background media service were present, including lock-screen/background work.
- Android Hassoun home-screen widgets existed in multiple sizes.
- Arabic and English UI support existed.
- Settings, support, privacy and terms sections existed.
- Push server / Cloudflare Worker + D1 backend existed.
- Admin authentication/backend functionality already existed in partial form.
- Privacy Policy and support pages existed.
- The final v0.6.17 Android APK workflow completed TypeScript, Expo prebuild, Gradle release build, APK verification and artifact upload successfully.

## Known issues / unfinished work at this baseline

### Android

- Widget appearance and sizing still needed visual polish and device-by-device QA; some widget sizes had previously failed or rendered poorly on Samsung launchers.
- Exact-alarm permission handling had changed several times and still required a final Google Play-compliant cleanup. The source/build contained `USE_EXACT_ALARM`, which needed review/replacement for Play Store submission.
- Qur'an Radio/background playback had recently been repaired for long continuous playback and still needed extended real-device stress testing.
- Qur'an reader continuous previous/next scrolling had recently been repaired and still needed full QA across Surah, Juz, page, search result and bookmark entry points.
- Store production output still needed to become a signed Android App Bundle (`.aab`) rather than only test/release APK artifacts.
- Google Play target SDK/API requirement, production signing, foreground-service declaration and Play Console compliance still needed final work.

### iOS

- The shared React Native app existed, but the important custom native modules were Android-only at this point:
  - Prayer/Adhan native audio module
  - Qur'an background audio module
  - Qur'an speech/recitation module
  - Hassoun widgets
- iOS equivalents still needed to be built before App Store submission.
- iOS background Qur'an playback / lock-screen controls, WidgetKit widgets, recitation speech support, notification/Adhan behavior and App Store privacy requirements were not yet fully implemented or tested.

### Codebase / release engineering

- Many historical apply/fix/build workflows remained in `.github`, creating a risk that an older workflow could re-apply stale configuration.
- `mobile/node_modules` was present in the repository history/current tree and should be removed from the release working copy while remaining recoverable from this backup branch.
- Multiple historical Qur'an implementation files and migration/fix scripts remained and needed cleanup after confirming the current live implementation.
- App versioning was not fully unified (`app.config.ts` and `package.json` did not use one canonical store version source).
- Mobile automated testing was much lighter than backend testing and needed a real release QA/test matrix.

## Rule for future work

Do not rewrite or use this branch for experimental development.

All store-readiness fixes, cleanup and Admin CRM development should be done on a separate working branch created from this backup. The `main` branch and this backup branch are the recovery points if a later change breaks the application.

## Recovery statement

As of August 19, 2026, Hassoun had a confirmed successfully built Android APK and a broadly functioning Android application. The remaining work was primarily release hardening, widget/UI polish, Android policy/store compliance, long-duration QA, iOS native feature parity, release pipeline cleanup and full Admin CRM development.
