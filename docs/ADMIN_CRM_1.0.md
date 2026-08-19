# Hassoun Admin CRM 1.0

Status: built on `work/hassoun-1.0-store-admin`; not merged to `main` and not considered production-deployed until the D1 migration, Worker deployment, PWA deployment, and validation checks complete.

## Recovery rule

The known-good Android v0.6.17 APK recovery point remains:

- branch: `backup/2026-08-19-v0.6.17-working-apk`
- commit: `577946afc2c61444e9e1f358ba693d477c7bf1f6`

Do not rewrite that recovery branch.

## CRM sections

The `/admin` control center now provides:

- Dashboard: subscriber/device/delivery/content/admin/release overview.
- Users: search subscribers, review location/subscription state, and change subscriber status.
- Content: create and publish bilingual Ayah, Hadith, Du'a, announcements, events, Qur'an sources, reciters, and quiz content; archive/publish and feature content.
- App Control: persistent remote application settings and release controls.
- Push: create immediate or scheduled bilingual push campaigns and review campaign state.
- Email: existing campaign center remains available at `/admin/email`.
- Admins: owner-controlled role/status management.
- Admin Team: owner can create admin/editor accounts using temporary passwords; new accounts must change their password.
- Audit: owner/admin activity trail for CRM mutations.

## Roles

### Owner

Full access. Can create/disable admins and change roles in addition to all operational controls.

### Admin

Operational access to users, app settings, push, email, content, dashboard, and audit. Cannot manage the owner account or create/change the owner role.

### Editor

Content-focused access. Can use the dashboard and create/update content. Sensitive operator read endpoints return empty collections to editors, and sensitive write endpoints reject editor access.

## New data model

Migration `push-server/migrations/0008_admin_crm.sql` adds:

- `app_settings`
- `app_content`
- `admin_audit_log`

Default remote settings include:

- maintenance mode
- minimum Android/iOS versions
- force-update Android/iOS
- Qur'an feature switch
- games switch
- email switch
- community-content switch
- global system banner

## Runtime control

`GET /app/runtime` exposes only the safe public settings required by clients plus currently published/featured content. It does not expose admin data.

Current client wiring:

- Android/iOS shell consumes maintenance mode, minimum-version/force-update control, the system banner, and the email enabled switch.
- PWA consumes maintenance mode and the system banner.
- The admin route is intentionally excluded from the PWA maintenance overlay so an owner can always sign in and turn maintenance mode off.

The Qur'an/games/community feature switches and featured-content feed are present in runtime configuration, but individual feature screens still need to be fully switched over to those flags before those switches should be relied on as hard kill-switches.

## Security

- Admin sessions use the existing bearer-token session system.
- Passwords use the existing PBKDF2/SHA-256 implementation and per-account salts.
- New admin accounts use temporary passwords and `must_change_password = 1`.
- Owner/admin/editor role boundaries are enforced server-side, not only in the UI.
- Admin/subscriber mutation actions are written to `admin_audit_log`.
- Public runtime configuration uses an explicit safe allowlist.

## Validation and deployment still required

Before calling the CRM production-live:

1. Confirm PWA build validation passes on the working branch.
2. Confirm Worker TypeScript validation and tests pass on the working branch.
3. Confirm Android store validation still passes after runtime-client changes.
4. Apply D1 migration `0008_admin_crm.sql` to the remote database.
5. Deploy the updated Worker.
6. Verify `/app/runtime`, `/admin/login`, `/admin/crm/overview`, settings/content/team/audit endpoints.
7. Deploy/update the PWA containing the new `/admin` CRM.
8. Run browser QA on desktop and mobile widths.
9. Build/test Android with maintenance mode OFF and force-update OFF by default.
10. Test role boundaries using separate owner, admin, and editor accounts.

Do not merge this branch into `main` merely because the screens exist. Production promotion should happen only after the above validation passes.
