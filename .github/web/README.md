# Hassoun Web / PWA — Canonical Index

Start here for Hassoun web work.

## Authoritative branch
`main`

## Public web app
- Domain: `hassou.app`
- Source root: `pwa/`
- Main app source: `pwa/app/`
- Public assets: `pwa/public/`
- Database / schema support: `pwa/db/`, `pwa/drizzle/`, `pwa/drizzle.config.ts`
- Web build output currently present under `pwa/build/`

## Workflow
- `.github/workflows/pwa-ci.yml`
- Deployment-related web workflow: `.github/workflows/deploy-pages.yml`

## Relationship to the APK
The web app is a separate web/PWA build. It is not the Android APK.

The current Android APK is shared by:
- Android phone
- Tablet / iPad-style display mode on Android
- TV / Masjid TV / wall display

Changes to shared business logic or display behavior may need to be reflected in both `mobile/` and `pwa/`, but they are built and deployed separately.

## Rule
If the request says website, web, PWA, browser, or `hassou.app`, start here. Do not assume an APK build updates the web app, and do not assume a web deploy updates the Android APK.
