# Hassoun Watch / Wear OS — Canonical Index

Start here for all Android watch / Wear OS work.

## Authoritative branch
`main`

## Source
- `wearos/` — native Wear OS Gradle project
- `wearos/watchface/` — watch-face application/module
- `wearos/datasource/` — watch data source / complications support
- `wearos/README.md` — existing watch implementation notes

## Build
- Canonical workflow: `.github/workflows/wearos-build.yml`
- Gradle root: `wearos/`

## Historical branches
Branches containing older watch experiments/fixes are history/rollback only unless explicitly selected. Current work should start from `main` and this file.

## Rule
If the request says watch, Wear OS, watchface, complication, or watch APK, do not start in `mobile/` or the tablet build. Start here, then inspect `wearos/` and `.github/workflows/wearos-build.yml`.
