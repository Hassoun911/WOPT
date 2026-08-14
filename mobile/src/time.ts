import { WINDSOR_TIME_ZONE } from "./config";

function partsInZone(date: Date, timeZone = WINDSOR_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second")
  };
}

export function windsorDateKey(date = new Date()) {
  const parts = partsInZone(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function windsorSecondsSinceMidnight(date = new Date()) {
  const parts = partsInZone(date);
  return parts.hour * 3600 + parts.minute * 60 + parts.second;
}

export function timeToMinutes(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function addDateDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function windsorLocalToDate(dateKey: string, time: string) {
  const [year = 0, month = 1, day = 1] = dateKey.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  let instantMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Two passes resolve the Toronto UTC offset on either side of DST changes.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = partsInZone(new Date(instantMs));
    const displayedAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    instantMs += desiredAsUtc - displayedAsUtc;
  }

  return new Date(instantMs);
}

export function formatPrayerTime(time: string, locale: "en" | "ar") {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC"
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}
