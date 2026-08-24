# Hassoun prayer location behavior

- Prayer schedules are loaded from the device's current foreground location.
- Windsor-area users use the official Windsor Islamic Association schedule.
- Other locations use the global prayer-time API with latitude/longitude.
- The detected timezone and location label are passed into reminders and exact Adhan scheduling.
- When the app returns from the background, prayer data is refreshed so travel does not leave a stale Windsor schedule.
- If live location is unavailable, the most recently cached location schedule is preferred before the bundled fallback.
