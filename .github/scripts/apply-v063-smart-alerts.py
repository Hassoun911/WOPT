from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def require(path: str, marker: str) -> None:
    text = (ROOT / path).read_text(encoding="utf-8")
    if marker not in text:
        raise SystemExit(f"Missing retained v0.6.3 smart-alert marker in {path}: {marker}")


# v0.6.3 is already applied to main. This workflow step must verify the
# retained implementation, not try to patch an older App.tsx shape again.
checks = [
    ("mobile/App.tsx", 'PrayerAlertPreferenceGrid'),
    ("mobile/App.tsx", 'updatePhoneAlertPreferences'),
    ("mobile/App.tsx", 'phoneAlertPreferences'),
    ("mobile/App.tsx", 'const muted = !phoneAlertPreferences[prayer].athan;'),
    ("mobile/src/config.ts", 'phonePrayerAlerts'),
    ("mobile/src/notifications.ts", 'eventEnabled(event, preferences)'),
    ("mobile/src/prayerAudio.ts", 'preferences[event.prayer]?.athan === true'),
    ("mobile/src/PrayerAlertPreferenceGrid.tsx", 'Stop all'),
    ("mobile/src/PrayerAlertPreferenceGrid.tsx", '20 min only'),
    ("mobile/src/PrayerAlertPreferenceGrid.tsx", '10 min only'),
    ("mobile/src/PrayerAlertPreferenceGrid.tsx", 'Adhan only'),
    ("mobile/src/EmailSignupCard.tsx", 'Email alerts, your way'),
    ("mobile/src/emailSignup.ts", 'prayers: choices'),
    ("push-server/src/subscribers.ts", 'subscriber_prayer_preferences'),
    ("push-server/src/globalPrayerEmail.ts", 'prefs[rule.field] !== 1'),
]

for path, marker in checks:
    require(path, marker)

print("Retained v0.6.3 smart-alert implementation verified; no patch reapplication needed.")
