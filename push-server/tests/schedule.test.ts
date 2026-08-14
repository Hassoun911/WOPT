import { describe, expect, it } from "vitest";
import { duePrayerEvents, windsorLocalToDate } from "../src/schedule";
import type { PrayerTimes } from "../src/types";

const times: PrayerTimes = {
  "2026-08-14": {
    fajr: "05:01",
    dhuhr: "13:36",
    asr: "17:38",
    maghrib: "20:33",
    isha: "21:56"
  }
};

describe("Windsor prayer scheduling", () => {
  it("converts Windsor summer prayer time to UTC", () => {
    expect(windsorLocalToDate("2026-08-14", "05:01").toISOString()).toBe("2026-08-14T09:01:00.000Z");
  });

  it("emits the 20-minute reminder once within the cron tolerance", () => {
    const events = duePrayerEvents(times, new Date("2026-08-14T08:41:30.000Z"));
    expect(events.map((event) => event.id)).toEqual(["2026-08-14:fajr:twenty"]);
  });

  it("emits the exact prayer event", () => {
    const events = duePrayerEvents(times, new Date("2026-08-14T09:01:00.000Z"));
    expect(events.map((event) => event.id)).toEqual(["2026-08-14:fajr:athan"]);
  });

  it("does not emit unrelated events", () => {
    expect(duePrayerEvents(times, new Date("2026-08-14T10:00:00.000Z"))).toEqual([]);
  });
});
