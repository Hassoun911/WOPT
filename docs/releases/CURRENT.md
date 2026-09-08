# Hassoun Current Release

## Android tablet release

- Version: **1.0.33**
- versionCode: **77**
- Authoritative branch: **`main`**
- Source line migrated from: `build/v1030-native-tablet-display`
- Pre-structure source commit: `69f7426bfdb8edef54e0e557f393bc0ee2e8a769`
- Canonical patch runner: `.github/tablet/apply-current.py`
- Canonical workflow: `.github/workflows/tablet-build.yml`

## Current v1.0.33 tablet behavior

- Explicit 12-hour / 24-hour clock selection.
- Layout/theme backup survives normal APK upgrades when the app is installed over the existing app.
- Display editor state is persisted and restored.
- Immersive fullscreen behavior is applied.
- Main prayer AM/PM can be toggled from the live editor.
- Five-minute pre-prayer freeze/heartbeat and countdown behavior remain part of the tablet stack.
- Exact-alarm and notification runtime remain part of the tablet stack.
- **Mini/lower prayer card press toggles that prayer's Adhan mute state.** It saves the preference and immediately re-runs prayer scheduling; the mini card exposes `🔇 MUTED` / `🔊 ADHAN` state.

## Protected baseline

Physical last-good remains **v1.0.29** until a later build is confirmed on a real device. Do not delete or rewrite its history.

## APK

CI output directory:

`mobile/android/app/build/outputs/apk/release/`

The release APK is uploaded as a GitHub Actions artifact and is not committed to `main`.
