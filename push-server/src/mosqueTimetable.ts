import type { Env } from "./types";

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
type Prayer = typeof PRAYERS[number];
type Times = Record<Prayer, string>;

type SearchRow = Record<string, any>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
}

function clean(value: unknown) { return String(value ?? "").trim(); }
function lower(value: unknown) { return clean(value).toLowerCase(); }
function dateParts(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}
function addMinutes(raw: string, delta: number) {
  const m = clean(raw).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  let total = Number(m[1]) * 60 + Number(m[2]) + delta;
  total = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function resolveIqama(raw: unknown, adhan: string) {
  const value = clean(raw);
  if (!value) return "";
  const offset = value.match(/^([+-])\s*(\d{1,3})$/);
  if (offset) return addMinutes(adhan, (offset[1] === "-" ? -1 : 1) * Number(offset[2]));
  if (/^sunset$/i.test(value)) return adhan;
  return value;
}
function mapCalendarDay(conf: Record<string, any>, date: string): Times | null {
  const parts = dateParts(date);
  if (!parts || !Array.isArray(conf.calendar)) return null;
  const month = conf.calendar[parts.month - 1];
  if (!month || typeof month !== "object") return null;
  const row = Object.values(month)[parts.day - 1] as any;
  if (!Array.isArray(row) || row.length < 6) return null;
  return { fajr: clean(row[0]), dhuhr: clean(row[2]), asr: clean(row[3]), maghrib: clean(row[4]), isha: clean(row[5]) };
}
function mapTodayTimes(conf: Record<string, any>): Times | null {
  const t = conf.times;
  if (!Array.isArray(t) || t.length < 5) return null;
  return { fajr: clean(t[0]), dhuhr: clean(t[1]), asr: clean(t[2]), maghrib: clean(t[3]), isha: clean(t[4]) };
}
function mapIqama(conf: Record<string, any>, date: string, adhan: Times): Times {
  const empty: Times = { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" };
  if (conf.iqamaEnabled === false || !Array.isArray(conf.iqamaCalendar)) return empty;
  const parts = dateParts(date);
  if (!parts) return empty;
  const month = conf.iqamaCalendar[parts.month - 1];
  if (!month || typeof month !== "object") return empty;
  const row = Object.values(month)[parts.day - 1] as any;
  if (!Array.isArray(row)) return empty;
  return {
    fajr: resolveIqama(row[0], adhan.fajr),
    dhuhr: resolveIqama(row[1], adhan.dhuhr),
    asr: resolveIqama(row[2], adhan.asr),
    maghrib: resolveIqama(row[3], adhan.maghrib),
    isha: resolveIqama(row[4], adhan.isha),
  };
}
function mapJumuah(conf: Record<string, any>) {
  const values = [conf.jumpiua ?? conf.jumua, conf.jumua2, conf.jumua3].map(clean).filter(Boolean);
  return values.map((time, index) => ({ label: index === 0 ? "1st Jumu’ah" : index === 1 ? "2nd Jumu’ah" : "3rd Jumu’ah", time }));
}
function complete(times: Times | null) { return !!times && PRAYERS.every(p => clean(times[p])); }

function candidateScore(row: SearchRow, name: string, city: string, postal: string) {
  const hay = lower(`${row.name ?? ""} ${row.label ?? ""} ${row.localisation ?? ""} ${row.city ?? ""} ${row.zipcode ?? ""} ${row.address ?? ""}`);
  let score = 0;
  const n = lower(name), c = lower(city), p = lower(postal).replace(/\s+/g, "");
  if (n && hay.includes(n)) score += 60;
  for (const token of n.split(/\s+/).filter(x => x.length > 2)) if (hay.includes(token)) score += 8;
  if (c && hay.includes(c)) score += 35;
  if (p && hay.replace(/\s+/g, "").includes(p)) score += 45;
  return score;
}

async function searchMawaqit(name: string, city: string, postal: string) {
  const alias = lower(name + " " + city);
  if (alias.includes("windsor") && (alias.includes("al hijra") || alias.includes("windsor mosque") || alias.includes("windsor islamic"))) {
    return { slug: "windsor-islamic-association", name: "Windsor Islamic Association", source: "known-alias" };
  }
  const words = [...new Set([name, city, postal, `${name} ${city}`].map(clean).filter(Boolean))];
  const rows: SearchRow[] = [];
  for (const word of words.slice(0, 4)) {
    try {
      const r = await fetch(`https://mawaqit.net/api/2.0/mosque/search?word=${encodeURIComponent(word)}`, { cf: { cacheTtl: 1800, cacheEverything: true } });
      if (!r.ok) continue;
      const data = await r.json() as any;
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.mosques) ? data.mosques : [];
      rows.push(...list);
    } catch { }
  }
  const unique = new Map<string, SearchRow>();
  for (const row of rows) {
    const slug = clean(row.slug ?? row.mosqueSlug ?? row.urlSlug);
    if (slug && !unique.has(slug)) unique.set(slug, row);
  }
  const ranked = [...unique.entries()].map(([slug, row]) => ({ slug, row, score: candidateScore(row, name, city, postal) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < 20) return null;
  return { slug: best.slug, name: clean(best.row.name ?? best.row.label ?? name), source: "mawaqit-search" };
}

async function fetchConf(slug: string) {
  for (const lang of ["en", "fr"]) {
    const r = await fetch(`https://mawaqit.net/${lang}/${encodeURIComponent(slug)}`, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!r.ok) continue;
    const html = await r.text();
    const match = html.match(/(?:var|let)\s+confData\s*=\s*(\{[\s\S]*?\});/);
    if (!match) continue;
    try { return JSON.parse(match[1]) as Record<string, any>; } catch { }
  }
  return null;
}

export async function handleMosqueTimetable(_request: Request, _env: Env, url: URL) {
  const name = clean(url.searchParams.get("name"));
  const city = clean(url.searchParams.get("city"));
  const postal = clean(url.searchParams.get("postal"));
  const date = clean(url.searchParams.get("date"));
  if (!dateParts(date)) return json({ error: "Valid date is required" }, 400);
  if (!name && !city && !postal) return json({ error: "Mosque name or location is required" }, 400);

  const candidate = await searchMawaqit(name, city, postal);
  if (!candidate) return json({ found: false, source: "mawaqit" }, 404);
  const conf = await fetchConf(candidate.slug);
  if (!conf) return json({ found: false, source: "mawaqit", slug: candidate.slug }, 404);

  const adhan = mapCalendarDay(conf, date) ?? mapTodayTimes(conf);
  if (!complete(adhan)) return json({ found: false, source: "mawaqit", slug: candidate.slug }, 404);
  const iqama = mapIqama(conf, date, adhan!);
  const jumuah = mapJumuah(conf);
  return json({
    found: true,
    source: "Mawaqit mosque timetable",
    slug: candidate.slug,
    mosqueName: clean(conf.name ?? conf.label ?? candidate.name),
    adhan,
    iqama,
    jumuah,
    iqamaAvailable: PRAYERS.some(p => !!clean(iqama[p])),
    jumuahAvailable: jumuah.length > 0,
  });
}
