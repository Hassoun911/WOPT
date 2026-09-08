# Hassoun Tablet Build — Canonical Structure

This folder is the canonical entry point for all Android tablet/iPad wall-display work.

## Where to start

1. Read `HASSOUN_CURRENT.md` at the repo root.
2. Read `docs/releases/CURRENT.md` for the current version and behavior.
3. Use `.github/tablet/apply-current.py` to apply the tablet patch stack.
4. Build with `.github/workflows/tablet-build.yml`.

## Current release

- Version: `1.0.33`
- versionCode: `77`
- Authoritative branch: `main`
- Protected physical last-good baseline: `v1.0.29`

## Source locations

The generated tablet runtime currently lands in:

- `mobile/src/MasjidDisplayPage.tsx` — tablet display runtime
- `mobile/src/ConnectDisplayPage.tsx` — paired admin/editor
- `mobile/src/notifications.ts` — notification scheduling
- `mobile/src/prayerAudio.ts` — native prayer-audio bridge
- `mobile/modules/prayer-audio/` — Android exact-alarm / audio implementation

The historical patch implementations remain in `.github/scripts/` for compatibility and rollback. **Do not manually choose a subset.** The canonical ordered list is in `.github/tablet/manifest.json`, and `.github/tablet/apply-current.py` runs it.

## Build artifacts

GitHub Actions generates the release APK under:

`mobile/android/app/build/outputs/apk/release/`

The workflow then uploads the APK as a GitHub Actions artifact. APK binaries are not committed to `main`.

## v1.0.33 tablet behavior worth knowing

- Top clock uses explicit 12/24-hour setting.
- Tablet layout/theme is persisted across normal APK upgrades.
- Paired admin editor resumes to the exact display/editor state after process recreation.
- Five-minute prayer-soon freeze/heartbeat remains enabled when configured.
- Tablet prayer notifications/exact alarms are intended to self-arm on entering tablet mode, on resume, and periodically while the display stays open.

## Known v1.0.33 regression — tablet Adhan / reminder reliability

Physical-device report: the same universal Android APK works correctly for Adhan and reminder sounds in phone mode, but tablet/iPad display mode is no longer reliably playing Adhan and notification sounds. Earlier tablet builds worked correctly.

The most suspicious regression was introduced by `.github/scripts/fix-v1033-clock-and-prayer-mute.py`. In v1.0.33, tapping a lower prayer card was changed from a visual selection action into a persistent Adhan mute toggle. That handler also calls `schedulePrayerNotifications(...)`, which cancels the existing prayer notification/native Adhan schedule and rebuilds it. This is a new behavior compared with v1.0.32 and can both mute a prayer unexpectedly and disturb reminder timing when cards are tapped.

Until fixed and physically re-tested:
- treat v1.0.33 tablet prayer audio as a known regression;
- do not use mini prayer cards as a sound/mute control;
- restore mini-card taps to visual selection only;
- keep sound preferences in the dedicated Alerts/settings controls;
- preserve the tablet self-arm runtime from `fix-v1030-tablet-prayer-runtime.py`;
- verify 20-minute chime, 10-minute chime, Fajr Adhan, non-Fajr Adhan + dua, exact-alarm resume, and long-running tablet mode on a real Android tablet before calling the next APK fixed.

## Safety rules

- Never delete the v1.0.29 baseline or its known-good build history.
- Before structural work, create a backup branch.
- Avoid editing generated Android files before Expo prebuild unless the workflow explicitly does so.
- Every release build must pass source-marker verification, TypeScript, Expo prebuild, Android exact-alarm verification, Gradle release build, APK naming, and artifact upload.
- CI success is a build candidate, not proof of physical-device behavior.
