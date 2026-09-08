# Hassoun iOS / iPhone / iPad — Canonical Index

Start here for all iOS, iPhone, iPad, TestFlight, and App Store work.

## Authoritative branch
`main`

## Source
Hassoun iOS currently uses the shared Expo / React Native app under `mobile/`.

Primary files:
- `mobile/App.tsx`
- `mobile/src/`
- `mobile/app.config.ts`
- `mobile/eas.json`
- `mobile/assets/`
- `mobile/modules/`

There is no permanent `mobile/ios/` native project committed on `main` right now. Native iOS project files are generated as part of the Expo/EAS build process when needed.

`mobile/app.config.ts` contains the iOS bundle configuration including bundle identifier `ca.wopt.windsorprayertimes`, tablet support, background notification/audio modes, and iOS permission descriptions.

## Build / validation / submission
- TestFlight build workflow: `.github/workflows/ios-testflight.yml`
- Submit latest iOS build: `.github/workflows/ios-submit-latest.yml`
- iOS Quran-audio validation: `.github/workflows/validate-ios-quran-audio.yml`
- EAS configuration: `mobile/eas.json`

## Rule
If the request says iOS, iPhone, iPad app, TestFlight, App Store, IPA, Apple review, or Apple submission, start here. Do not assume the Android tablet APK workflow is the iOS build path.
