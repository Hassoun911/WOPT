# Hassoun Wear OS

This folder contains the real Wear OS implementation for the Hassoun watch experience.

It is intentionally split into two installable modules:

- `watchface`: resource-only Watch Face Format (WFF) face. This is the actual Hassoun face shown by Wear OS.
- `datasource`: native Wear OS helper app that supplies Hassoun-specific complication data for calories and Qibla.

The split is required because current Watch Face Format bundles cannot contain application code.

## What is live on the face

- **Steps**: rendered directly by Watch Face Format using the platform `STEP_COUNT` data source.
- **Calories**: supplied by the Hassoun Watch Data app from Wear OS Health Services `CALORIES_DAILY`.
- **Qibla**: calculated from the watch location to the Kaaba (21.422487, 39.826206) and displayed as a true-north bearing in degrees.
- **Time**: rendered natively by Watch Face Format.

Qibla on the face is a bearing (for example `102°`). It is not a continuously rotating compass needle. Tap/open the Hassoun Watch Data app to refresh location when needed.

## Install / test order

1. Open `wearos` as an Android Studio project (Android Studio Quail 3 or newer recommended).
2. Install the `datasource` module on the Wear OS watch.
3. Open **Hassoun Watch Data** on the watch and grant Activity Recognition and Location permissions.
4. Install the `watchface` module.
5. From the watch face picker, choose **Hassoun**.
6. If Calories or Qibla did not auto-select, edit the Hassoun face and select **Hassoun Calories** / **Hassoun Qibla** for those slots.

## Build

AGP 9.3 requires Gradle 9.5 or newer. Android Studio can sync/build the project directly.

The watch face targets Watch Face Format version 2 so it works with Wear OS 5-class devices while remaining compatible with newer Wear OS releases.
