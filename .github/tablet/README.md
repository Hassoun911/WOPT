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
- Tablet prayer notifications/exact alarms are scheduled separately from visual selection.
- **Tapping a lower/mini prayer card in v1.0.33 toggles that prayer's Adhan mute state, persists it, and re-arms the schedule.** The card shows `🔇 MUTED` or `🔊 ADHAN`.

## Safety rules

- Never delete the v1.0.29 baseline or its known-good build history.
- Before structural work, create a backup branch.
- Avoid editing generated Android files before Expo prebuild unless the workflow explicitly does so.
- Every release build must pass source-marker verification, TypeScript, Expo prebuild, Android exact-alarm verification, Gradle release build, APK naming, and artifact upload.
- CI success is a build candidate, not proof of physical-device behavior.
