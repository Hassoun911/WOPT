from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOSQUES = ROOT / "mobile/src/NearbyMosquesPage.tsx"

if not MOSQUES.exists():
    raise SystemExit("v1.0.42 requires NearbyMosquesPage.tsx")

s = MOSQUES.read_text(encoding="utf-8")

# Add a reusable aborting fetch helper so no public map provider can hang the UI.
marker = 'export async function findNearbyMosques(latitude: number, longitude: number) {'
if marker not in s:
    raise SystemExit("Could not find exported findNearbyMosques()")

helper = r'''async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function withDeadline<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(code)), timeoutMs))
  ]);
}

'''
if 'async function fetchWithTimeout(' not in s:
    s = s.replace(marker, helper + marker, 1)

# Replace every directory network request with an aborting request.
s = s.replace('const response = await fetch(endpoint, {', 'const response = await fetchWithTimeout(endpoint, {', 1)
s = s.replace('body: `data=${encodeURIComponent(overpassQuery)}`\n      });', 'body: `data=${encodeURIComponent(overpassQuery)}`\n      }, 5000);', 1)

# Nominatim fallback also gets its own short timeout.
old_nom = 'const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {\n          headers: { Accept: "application/json", "Accept-Language": "en,ar;q=0.9" }\n        });'
new_nom = 'const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {\n          headers: { Accept: "application/json", "Accept-Language": "en,ar;q=0.9" }\n        }, 3500);'
if old_nom in s:
    s = s.replace(old_nom, new_nom, 1)
elif 'fetchWithTimeout(`https://nominatim.openstreetmap.org/search?' not in s:
    raise SystemExit("Could not patch Nominatim timeout")

# Cap the entire page refresh. Even if multiple providers fail badly, loading must end.
old_found = 'const found = await findNearbyMosques(position.coords.latitude, position.coords.longitude);'
new_found = 'const found = await withDeadline(\n        findNearbyMosques(position.coords.latitude, position.coords.longitude),\n        12000,\n        "MOSQUE_SEARCH_TIMEOUT"\n      );'
if old_found in s:
    s = s.replace(old_found, new_found, 1)
elif '"MOSQUE_SEARCH_TIMEOUT"' not in s:
    raise SystemExit("Could not add overall mosque search deadline")

# Make timeout/directory failures explicit rather than looking like a genuine zero-result search.
old_error = 'setError(code.includes("LOCATION")\n        ? t("Location access is needed to find nearby mosques.", "يلزم السماح بالموقع للعثور على المساجد القريبة.")\n        : t("Mosque search is temporarily unavailable. Your GPS prayer times still work.", "البحث عن المساجد غير متاح مؤقتاً. مواقيت الصلاة حسب GPS ما زالت تعمل."));'
new_error = 'setError(code.includes("LOCATION")\n        ? t("Location access is needed to find nearby mosques.", "يلزم السماح بالموقع للعثور على المساجد القريبة.")\n        : code.includes("MOSQUE_SEARCH_TIMEOUT")\n          ? t("Mosque search timed out. Tap refresh to try again.", "انتهت مهلة البحث عن المساجد. اضغط تحديث للمحاولة مرة أخرى.")\n          : t("Mosque directory is temporarily unavailable. Tap refresh to try again.", "دليل المساجد غير متاح مؤقتاً. اضغط تحديث للمحاولة مرة أخرى."));'
if old_error in s:
    s = s.replace(old_error, new_error, 1)
elif 'Mosque search timed out.' not in s:
    raise SystemExit("Could not patch mosque timeout error state")

# v1.0.41 Home calls the same exported lookup. Put a deadline around that call too so
# the Home card cannot sit forever on “Finding the nearest mosque…”.
HOME = ROOT / "mobile/src/HomePrayerPage.tsx"
if HOME.exists():
    h = HOME.read_text(encoding="utf-8")
    old = 'void findNearbyMosques(context.location.latitude, context.location.longitude)\n      .then((rows) => {'
    new = 'void Promise.race([\n      findNearbyMosques(context.location.latitude, context.location.longitude),\n      new Promise<MosqueRow[]>((_, reject) => setTimeout(() => reject(new Error("MOSQUE_SEARCH_TIMEOUT")), 12000))\n    ])\n      .then((rows) => {'
    if old in h:
        h = h.replace(old, new, 1)
    HOME.write_text(h, encoding="utf-8")

for needle in [
    'fetchWithTimeout',
    'MOSQUE_SEARCH_TIMEOUT',
    '12000',
    '5000',
    '3500',
]:
    if needle not in s:
        raise SystemExit(f"Missing v1.0.42 timeout marker: {needle}")

MOSQUES.write_text(s, encoding="utf-8")
print("HASSOUN_V1042_MOSQUE_TIMEOUTS_APPLIED")
