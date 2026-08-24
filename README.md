# Hassoun / WOPT

**Repository organization last updated: 2026-08-23**

Hassoun contains the consumer Android app, Wear OS/watch work, hassoun.app web/PWA, admin/CRM, notification/backend services, and shared Windsor prayer schedule data.

## Current product references — 2026-08-23

| Product | Main source | Dated reference / work branch |
|---|---|---|
| Android app | `mobile/` | `release/android-2026-08-23` |
| Wear OS / watch | watch release sources | `release/watch-2026-08-23` |
| hassoun.app website | `pwa/` | `work/website-2026-08-23-app-parity` |
| Admin / CRM | `admin-crm/` | keep separate from consumer UI releases |
| Backend / notifications | `push-server/` | keep separate from layout-only releases |

The active Android integration/build branch is `build/v108-good-apk-layout-only`.

See **`docs/REPO_MAP_2026-08-23.md`** for the full product map, recovery rules and date-stamp convention.

## Date-stamp rule

From 2026-08-23 forward, release branches, work branches, APK/watch artifacts, release notes and website milestones should use ISO dates (`YYYY-MM-DD`). Dated release branches are recovery points and should not be rewritten after they are declared working.

## Website

The `pwa/` project powers the web experience. The current parity work is being done on `work/website-2026-08-23-app-parity` so hassoun.app can be brought in line with the current mobile app without risking the Android release branch.

Legacy GitHub Pages deployment status:

[![Deploy WOPT PWA](https://github.com/Hassoun911/WOPT/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/Hassoun911/WOPT/actions/workflows/deploy-pages.yml)

## Prayer data

The repository includes Windsor, Ontario prayer-time data based on the Windsor Islamic Association calendar.
