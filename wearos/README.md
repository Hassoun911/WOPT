# Hassoun Wear OS

Native Hassoun watch-face implementation for Wear OS.

## Structure

The project is intentionally split into two installable Android modules:

- `watchface` — resource-only Watch Face Format (WFF) face.
- `datasource` — the small Hassoun Watch Data app that supplies the values WFF cannot calculate by itself.

Current Wear OS requires Watch Face Format faces to be resource-only, so the face and the code-backed data provider cannot live in the same bundle.

## Live data on the Hassoun face

- **Steps** — native WFF `STEP_COUNT`, read directly from Wear OS.
- **Calories** — Wear OS Health Services `CALORIES_DAILY`, including activity + BMR, supplied through `Hassoun Calories`.
- **Qibla** — true-north bearing from the watch location to the Kaaba (21.422487, 39.826206), supplied through `Hassoun Qibla`.
- **Gregorian date** — native WFF date sources.
- **Battery** — native WFF `BATTERY_PERCENT`.
- **Time** — native WFF digital clock, respecting the watch's 12/24-hour preference.

When Hassoun receives new calories or location data it explicitly asks Wear OS to refresh the matching complication, while the normal 5-minute provider polling remains as a fallback.

## Qibla behavior

The face displays the Qibla **bearing from true north** (for example `102°`). This is stable and useful at a glance. It is not pretending to be a continuously rotating compass needle, because complication updates are not a suitable real-time compass transport.

## Install / test

1. Open the `wearos` folder in Android Studio Quail 3 (2026.1.3) or newer.
2. Install/run the `datasource` module on the watch.
3. Open **Hassoun Watch Data** once and tap **Enable live data**.
4. Grant **Physical activity** and **Location** when Wear OS asks.
5. Install/run the `watchface` module.
6. Choose **Hassoun** from the watch face picker.
7. If the two Hassoun providers were not selected automatically, edit the face and choose:
   - `Hassoun Calories` for Calories
   - `Hassoun Qibla` for Qibla

## Build requirements

- Android Gradle Plugin 9.3.0
- Gradle 9.5+
- JDK 17
- compileSdk 36
- Watch Face Format v2 / minSdk 34 (Wear OS 5+)

Android Studio's WFF-aware editor/validator should be used before store submission, and the Wear OS WFF memory validator should be run for production publishing.
