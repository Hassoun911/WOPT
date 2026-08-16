# WOPT Native Qur'an

This directory contains the fresh native Android Qur'an experience for WOPT. It is independent of the web/PWA Qur'an implementation.

## Data integrity

The Android build downloads Qur'an text from the pinned `TarteelAI/quran-assets` mirror commit `a5284b17034d36567e4a4bac982a17ba56837448`, whose Qur'an text is sourced from Tanzil.net v1.1.

The build keeps the Uthmani Arabic text unchanged for display and stores the separate Tanzil simple-clean text only as a search index. `scripts/fetch-quran-data.mjs` fails the build unless it finds exactly:

- 114 Surahs
- 6,236 ayahs
- 604 Medina Mushaf pages
- 30 Juz

It also verifies Uthmani/simple ayah keys and each Surah's ayah count before writing the bundled offline JSON.

## Source and license

Qur'an text source: Tanzil Quran Text v1.1 — https://tanzil.net

Mirror used for reproducible builds: https://github.com/TarteelAI/quran-assets

Tanzil Quran Text is distributed under Creative Commons Attribution 3.0. The source must be attributed, and the Qur'an text must not be altered. WOPT preserves the original Uthmani text field and performs search normalization only on a separate search representation.

Qur'an metadata (Surah, Juz and page boundaries) is also sourced from Tanzil metadata under CC BY 3.0.
