import { addDateDays, dateKeyInZone, localToDateInZone } from "./time";
import { PRAYER_KEYS, type PrayerEvent, type PrayerEventKind, type PrayerTimes } from "./types";

const OFFSETS: Array<{ kind: PrayerEventKind; minutes: number }> = [
  { kind: "twenty", minutes: -20 },
  { kind: "ten", minutes: -10 },
  { kind: "athan", minutes: 0 }
];

export function buildPrayerEvents(prayerTimes: PrayerTimes, days: number, now = new Date(), timeZone = "America/Toronto") {
  const events: PrayerEvent[] = [];
  const today = dateKeyInZone(now, timeZone);

  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = addDateDays(today, offset);
    const day = prayerTimes[dateKey];
    if (!day) continue;

    for (const prayer of PRAYER_KEYS) {
      const prayerTime = day[prayer];
      const prayerDate = localToDateInZone(dateKey, prayerTime, timeZone);
      for (const rule of OFFSETS) {
        const scheduledAt = new Date(prayerDate.getTime() + rule.minutes * 60_000);
        if (scheduledAt.getTime() <= now.getTime() + 5_000) continue;
        events.push({
          id: `${dateKey}:${prayer}:${rule.kind}`,
          dateKey,
          prayer,
          prayerTime,
          kind: rule.kind,
          scheduledAt
        });
      }
    }
  }

  return events.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}
