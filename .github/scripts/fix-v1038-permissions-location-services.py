from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "mobile/src/PermissionsStatusPage.tsx"
s = P.read_text(encoding="utf-8")

if 'import * as Location from "expo-location";' not in s:
    s = s.replace(
        'import * as Notifications from "expo-notifications";\n',
        'import * as Notifications from "expo-notifications";\nimport * as Location from "expo-location";\n',
        1,
    )

s = s.replace(
    '  location: LocationLevel;\n  notifications: boolean;',
    '  location: LocationLevel;\n  locationServices: boolean;\n  notifications: boolean;',
    1,
)
s = s.replace(
    '  location: "off",\n  notifications: false,',
    '  location: "off",\n  locationServices: false,\n  notifications: false,',
    1,
)
s = s.replace(
    'const [fine, coarse, camera, microphone, notificationPermission] = await Promise.all([',
    'const [fine, coarse, camera, microphone, notificationPermission, locationServices] = await Promise.all([',
    1,
)
s = s.replace(
    '      Notifications.getPermissionsAsync()\n    ]);',
    '      Notifications.getPermissionsAsync(),\n      Location.hasServicesEnabledAsync()\n    ]);',
    1,
)
s = s.replace(
    '      location: fine ? "precise" : coarse ? "approximate" : "off",\n      notifications:',
    '      location: fine ? "precise" : coarse ? "approximate" : "off",\n      locationServices,\n      notifications:',
    1,
)

old = '''  const locationLabel = status.location === "precise"\n    ? t("Precise location is allowed. Hassoun can use exact GPS coordinates for local prayer times.", "الموقع الدقيق مسموح. يمكن لحسّون استخدام إحداثيات GPS الدقيقة لمواقيت الصلاة المحلية.")\n    : status.location === "approximate"\n      ? t("Approximate location is allowed. Enable Precise location for the most accurate automatic prayer source.", "الموقع التقريبي مسموح. فعّل الموقع الدقيق للحصول على أدق مصدر تلقائي لمواقيت الصلاة.")\n      : t("Location is off. Hassoun needs it for automatic local prayer times, Qibla and nearby mosques.", "الموقع متوقف. يحتاجه حسّون للمواقيت المحلية التلقائية والقبلة والمساجد القريبة.");'''
new = '''  const locationLabel = !status.locationServices\n    ? t("Android Location Services are OFF. Turn them on for GPS prayer times, Qibla and nearby mosques.", "خدمات الموقع في Android متوقفة. فعّلها لمواقيت الصلاة عبر GPS والقبلة والمساجد القريبة.")\n    : status.location === "precise"\n      ? t("Precise location is allowed and Location Services are ON. Hassoun can use exact GPS coordinates for local prayer times.", "الموقع الدقيق مسموح وخدمات الموقع مفعلة. يمكن لحسّون استخدام إحداثيات GPS الدقيقة لمواقيت الصلاة المحلية.")\n      : status.location === "approximate"\n        ? t("Approximate location is allowed and Location Services are ON. Enable Precise location for the most accurate automatic prayer source.", "الموقع التقريبي مسموح وخدمات الموقع مفعلة. فعّل الموقع الدقيق للحصول على أدق مصدر تلقائي لمواقيت الصلاة.")\n        : t("Location permission is off. Hassoun needs it for automatic local prayer times, Qibla and nearby mosques.", "إذن الموقع متوقف. يحتاجه حسّون للمواقيت المحلية التلقائية والقبلة والمساجد القريبة.");'''
if old not in s:
    raise SystemExit('location label block not found')
s = s.replace(old, new, 1)

s = s.replace(
    '"location", "📍", t("Location", "الموقع"), locationLabel, locationEnabled,',
    '"location", "📍", t("Location", "الموقع"), locationLabel, locationEnabled && status.locationServices,',
    1,
)
s = s.replace(
    't("Location Services", "خدمات الموقع"), () => { void openLocationServices(); }',
    'status.locationServices ? t("Manage Location Services", "إدارة خدمات الموقع") : t("Turn on Location Services", "تفعيل خدمات الموقع"), () => { void openLocationServices(); }',
    1,
)

for needle in [
    'import * as Location from "expo-location";',
    'locationServices: boolean;',
    'Location.hasServicesEnabledAsync()',
    'Android Location Services are OFF',
    'Turn on Location Services',
]:
    if needle not in s:
        raise SystemExit(f'Missing Location Services permission marker: {needle}')

P.write_text(s, encoding="utf-8")
print("Added live Android Location Services status and controls")
