# Hassoun Android Phone — Canonical Index

Start here for regular Android phone app work that is not specifically tablet/TV or Wear OS.

## Authoritative branch
`main`

## Source
- `mobile/App.tsx`
- `mobile/src/`
- `mobile/app.config.ts`
- `mobile/assets/`
- `mobile/modules/`
- `mobile/scripts/`

## Android-specific native behavior
Native Android modules live under `mobile/modules/`, including prayer audio and widgets. Expo prebuild generates `mobile/android/` for builds when the workflow requires it.

## Existing workflows
- `.github/workflows/android-debug.yml`
- `.github/workflows/android-play-submit.yml`

Many old version-numbered Android workflows remain for historical builds. Do not pick one by version number unless reproducing that exact old release.

## Rule
If the request says Android phone, phone APK, Google Play, Android notifications, exact alarms, phone Home screen, Android widgets, or phone permissions, start here. If the request is specifically tablet/TV/watch, use that platform index instead.
