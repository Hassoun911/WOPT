# Hassoun — Current Build

This file is the first place to look before changing or building Hassoun.

- **Authoritative branch:** `main`
- **Current tablet release:** `1.0.33`
- **Android versionCode:** `77`
- **Canonical tablet build guide:** `.github/tablet/README.md`
- **Canonical tablet patch runner:** `.github/tablet/apply-current.py`
- **Canonical release record:** `docs/releases/CURRENT.md`
- **Canonical GitHub Actions workflow:** `.github/workflows/tablet-build.yml`
- **Generated APK path in CI:** `mobile/android/app/build/outputs/apk/release/`

## Rule

Do not start tablet work by guessing a branch, workflow, or old version-numbered script. Start here, then follow `.github/tablet/README.md` and `.github/tablet/manifest.json`.

The old `build/v1030-native-tablet-display` branch is retained only as historical/rollback context. New tablet work belongs on `main` unless a temporary feature branch is intentionally created.
