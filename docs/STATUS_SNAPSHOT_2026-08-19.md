# Hassoun project status snapshot — August 19, 2026

This file records the known-good project checkpoint before store-release cleanup and admin CRM development.

## Snapshot source

- Original branch left untouched: `main`
- Snapshot commit: `577946afc2c61444e9e1f358ba693d477c7bf1f6`
- Clean backup branch: `backup/2026-08-19-v0.6.17-working-apk`
- Working branch for future changes: `work/hassoun-1.0-store-admin`

## Known-good Android state

At this checkpoint, Hassoun v0.6.17 had a successful Android APK build. The final recorded build passed TypeScript validation, Expo Android prebuild, permission verification, Gradle release compilation, APK verification, and artifact upload. The recorded artifact name was `hassoun-v0.6.17-final-2`.

This checkpoint should therefore be treated as the recovery point for a working Android APK before store-release cleanup and CRM work.

## Known issues / unfinished work at this checkpoint

The APK was working, but the following items were still known to need work or revalidation:

1. Android home-screen widgets still needed visual polish and device-specific layout tuning. Reported problems included small text, content too close to rounded edges, inconsistent appearance between widget sizes, and earlier Samsung add-widget failures during widget redesign work.
2. Exact-alarm permission handling needed store-policy cleanup. The working v0.6.17 source currently used `USE_EXACT_ALARM`; the store-release plan is to review and migrate to the appropriate Play-compliant exact-alarm permission strategy without breaking prayer alerts.
3. The Alarms & reminders permission user flow had required manual Android settings interaction in some test installs. The app should guide the user reliably and automatically restore/schedule alarms when permission is granted.
4. Qur'an Radio had previously been reported to stop after roughly 10 minutes of continuous playback. Recovery/retry work was added, but long-duration physical-device testing was still required before store release.
5. Qur'an reader navigation had been reported to trap the user inside a Surah/Juz/page. Continuous vertical scrolling and previous/next page behavior had been changed, but full device revalidation was still required.
6. iOS did not yet have native equivalents for the Android-only prayer-audio, Qur'an-audio, Qur'an-speech, and widget modules. iOS store parity remained a major work item.
7. Store-release cleanup was still needed: Android AAB production build/signing, target API verification, store declarations, consolidated CI, privacy/store metadata audit, and full release QA.
8. Repository cleanup was still needed because many historical apply/build workflows and old implementation files remained and could cause regressions if reused.

## Rule for future work

Do not modify `main` while store-release cleanup and admin CRM work are in progress. Work only on `work/hassoun-1.0-store-admin` unless there is an explicit decision to merge later.

If a future change breaks the app, compare against or restore from `backup/2026-08-19-v0.6.17-working-apk` / commit `577946afc2c61444e9e1f358ba693d477c7bf1f6`.
