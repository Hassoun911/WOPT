# WOPT cross-platform prayer push server

Cloudflare Worker that reads the official WOPT schedule and dispatches three uniquely identified events for every prayer in `America/Toronto`:

1. 20-minute reminder
2. 10-minute reminder
3. Exact-time Adhan notification

It supports Expo push tokens for the Android/iOS app and standards-based Web Push subscriptions for the installed website. D1 stores subscriptions and delivery IDs so a delayed or repeated cron invocation cannot send the same event twice to the same device.

## Before deployment

1. Create a D1 database and copy its ID into `wrangler.jsonc` using `wrangler.example.jsonc` as the starting point.
2. Apply `migrations/0001_initial.sql`.
3. Generate VAPID keys and save `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as Worker secrets.
4. Optionally save `EXPO_ACCESS_TOKEN` as a secret if enhanced Expo push security is enabled.
5. Configure Android FCM and Apple APNs credentials in the Expo project.
6. Deploy the Worker and set its URL as `EXPO_PUBLIC_PUSH_API_URL` in the mobile app.

The cron runs every minute in UTC, but each event is calculated from the Windsor schedule timezone, including daylight-saving transitions.
