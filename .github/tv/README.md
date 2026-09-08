# Hassoun TV / Masjid Display — Canonical Index

Start here for Android TV, Masjid TV, wall-display, and television-layout work.

## Authoritative branch
`main`

## Source model
TV is not a separate standalone codebase today. It is built into the shared Expo/React Native app under `mobile/` and shares display code with tablet/wall mode.

Primary source / generated targets:
- `mobile/src/MasjidDisplayPage.tsx` — native Masjid/TV/tablet display renderer
- `mobile/src/ConnectDisplayPage.tsx` — paired display/admin controls
- `mobile/App.tsx` — routing and display entry behavior
- `mobile/scripts/apply-masjid-tv.mjs`
- `mobile/scripts/apply-masjid-tv-fixes.mjs`
- `mobile/scripts/apply-wall-shell-for-masjid.mjs`
- `mobile/scripts/apply-masjid-remote.mjs`
- `mobile/scripts/apply-masjid-typefix.mjs`
- `mobile/scripts/apply-masjid-clock-click-branding.mjs`

Tablet-specific later-stage patches are indexed separately in `.github/tablet/` because they can modify the same shared display renderer.

## Build
The current Android display APK is built from the canonical tablet/display pipeline:
- `.github/workflows/tablet-build.yml`
- `.github/tablet/README.md`

## Historical TV branches
- `release/v1.0.14-masjid-tv`
- `release/v1.0.14-masjid-tv-fixes`

Those branches are historical references/rollback context, not the default starting point.

## Rule
If the request says TV, Android TV, Masjid TV, mosque screen, wall display, television, or landscape display, start here. Check shared TV code before applying tablet-only changes so TV behavior is not accidentally broken.
