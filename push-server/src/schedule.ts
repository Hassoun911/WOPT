import { PRAYER_KEYS, type DuePrayerEvent, type PrayerEventKind, type PrayerTimes } from "./types";

const TIME_ZONE = "America/Toronto";
const RULES: Array<{ kind: PrayerEventKind; offsetMinutes: number }> = [
  { kind: "twenty", offsetMinutes: -20 },
  { kind: "ten", offsetMinutes: -10 },
  { kind: "athan", offsetMinutes: 0 }
];

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second")
  };
}

export function windsorDateKey(date: Date) {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function windsorLocalToDate(dateKey: string, time: string) {
  const [year = 0, month = 1, day = 1] = dateKey.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = desiredUtc;

  for (let pass = 0; pass < 2; pass += 1) {
    const actual = zonedParts(new Date(instant));
    const displayedUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    instant += desiredUtc - displayedUtc;
  }
  return new Date(instant);
}

export function duePrayerEvents(prayerTimes: PrayerTimes, scheduledAt: Date, toleranceMs = 90_000) {
  const dateKey = windsorDateKey(scheduledAt);
  const day = prayerTimes[dateKey];
  if (!day) return [];
  const due: DuePrayerEvent[] = [];

  for (const prayer of PRAYER_KEYS) {
    const prayerTime = day[prayer];
    const prayerAt = windsorLocalToDate(dateKey, prayerTime);
    for (const rule of RULES) {
      const targetAt = new Date(prayerAt.getTime() + rule.offsetMinutes * 60_000);
      if (Math.abs(scheduledAt.getTime() - targetAt.getTime()) <= toleranceMs) {
        due.push({
          id: `${dateKey}:${prayer}:${rule.kind}`,
          dateKey,
          prayer,
          prayerTime,
          kind: rule.kind,
          targetAt
        });
      }
    }
  }
  return due;
}
