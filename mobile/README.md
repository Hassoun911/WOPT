# Windsor Prayer Times mobile app

Shared Expo/React Native app for Android first and iOS second. It uses the official WOPT Windsor schedule and treats `America/Toronto` as the schedule timezone.

## Notification model

Every prayer has three uniquely identified events:

1. 20 minutes before — push notification with the four-second reminder sound.
2. 10 minutes before — push notification with the same reminder sound.
3. Exact prayer time — Adhan notification.

The server push system is the primary delivery path. Local notifications are scheduled as a native fallback whenever the app opens or the schedule refreshes. Android schedules 14 days of backup events. iOS schedules four days (up to 60 events) to remain under Apple's pending-notification limit.

The final approved Adhan recording still needs to be added before release. Android can use the full recording. The iOS notification clip must be under 30 seconds; tapping it can open the app to play the full recording.

## Setup

1. Copy `.env.example` to `.env.local` and provide the EAS project ID and push API URL.
2. Run `npx expo install` to align dependencies with the installed Expo SDK.
3. Run `npx expo start --dev-client`.
4. Create native builds with EAS using the profiles in `eas.json`.

Push credentials and signing secrets must never be committed to this repository.
