# Windsor Prayer Times mobile app

Shared Expo/React Native app for Android first and iOS second. It uses the official WOPT Windsor schedule and treats `America/Toronto` as the schedule timezone.

## Notification model

Every prayer has three uniquely identified events:

1. 20 minutes before — push notification with the four-second reminder sound.
2. 10 minutes before — push notification with the same reminder sound.
3. Exact prayer time — Android chooses audio by prayer: Fajr plays its dedicated Adhan only; the other four prayers play the approved Adhan and then automatically play the dua.

The server push system is the primary visual delivery path. Native schedules are refreshed whenever the app opens or the schedule refreshes. Android schedules 14 days of reminder notifications and 30 days of exact prayer alarms. Those exact alarms start a foreground playback service so the full Adhan and dua can continue while the screen is locked. iOS schedules four days (up to 60 events) to remain under Apple's pending-notification limit.

Approved audio mapping:

- 20-minute and 10-minute notifications: `attention_chime.wav` (same 4-second sound for both).
- Fajr on Android: `fajr_adhan.mp3` only. Playback stops when that file ends.
- Dhuhr, Asr, Maghrib, and Isha on Android: `azan9.mp3`, immediately followed by `dua_after_azan.mp3`.

The iOS notification clip must be under 30 seconds; tapping it can open the app to play the full Adhan and dua. The full iOS behavior will be implemented after the Android release.

## Setup

1. Copy `.env.example` to `.env.local` and provide the EAS project ID and push API URL.
2. Run `npx expo install` to align dependencies with the installed Expo SDK.
3. Run `npx expo start --dev-client`.
4. Create native builds with EAS using the profiles in `eas.json`.

Push credentials and signing secrets must never be committed to this repository.
