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

export function dateKeyInZone(date = new Date(), timeZone = WINDSOR_TIME_ZONE) {
  const parts = partsInZone(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function secondsSinceMidnightInZone(date = new Date(), timeZone = WINDSOR_TIME_ZONE) {
  const parts = partsInZone(date, timeZone);
  return parts.hour * 3600 + parts.minute * 60 + parts.second;
}

export function localToDateInZone(dateKey: string, time: string, timeZone = WINDSOR_TIME_ZONE) {
  const [year = 0, month = 1, day = 1] = dateKey.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  let instantMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let pass = 0; pass < 3; pass += 1) {
    const actual = partsInZone(new Date(instantMs), timeZone);
    const displayedAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    const correction = desiredAsUtc - displayedAsUtc;
    instantMs += correction;
    if (Math.abs(correction) < 1000) break;
  }

  return new Date(instantMs);
}

// Compatibility aliases for code that still explicitly needs Windsor time.
export function windsorDateKey(date = new Date()) { return dateKeyInZone(date, WINDSOR_TIME_ZONE); }
export function windsorSecondsSinceMidnight(date = new Date()) { return secondsSinceMidnightInZone(date, WINDSOR_TIME_ZONE); }
export function windsorLocalToDate(dateKey: string, time: string) { return localToDateInZone(dateKey, time, WINDSOR_TIME_ZONE); }

export function timeToMinutes(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function addDateDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
