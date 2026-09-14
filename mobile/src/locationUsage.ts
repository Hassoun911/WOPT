const LOCATION_USAGE_URL = "https://wopt-prayer-push.wopt-windsor.workers.dev/location-usage";

export type UsageLocation = {
  latitude: number;
  longitude: number;
  timezone: string;
  label?: string;
};

export function recordPrayerLocationUsage(location: UsageLocation, platform = "mobile") {
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  void fetch(LOCATION_USAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone || "UTC",
      placeLabel: location.label || "",
      platform
    }),
    signal: controller.signal
  }).catch(() => undefined).finally(() => clearTimeout(timer));
}
