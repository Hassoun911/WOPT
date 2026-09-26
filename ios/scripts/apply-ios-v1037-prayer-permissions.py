from pathlib import Path
import re

PRAYER_SETTINGS = r'''import AsyncStorage from "@react-native-async-storage/async-storage";

export type CalculationMode = "smart" | "manual";
export type PrayerScheduleSource = "smart" | "calculated";
export type PrayerLocationMode = "gps" | "mosque";
export type SelectedMosque = {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
};

export type PrayerCalculationPreferences = {
  scheduleSource: PrayerScheduleSource;
  mode: CalculationMode;
  method: number;
  school: 0 | 1;
  highLatitude: 0 | 1 | 2 | 3;
  offsets: { fajr: number; dhuhr: number; asr: number; maghrib: number; isha: number };
  locationMode: PrayerLocationMode;
  selectedMosque: SelectedMosque | null;
};

export const CALCULATION_PREFS_KEY = "hassoun:prayer-calculation:v3";

export const DEFAULT_CALCULATION_PREFS: PrayerCalculationPreferences = {
  scheduleSource: "smart",
  mode: "smart",
  method: 3,
  school: 0,
  highLatitude: 3,
  offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  locationMode: "gps",
  selectedMosque: null
};

export const METHOD_OPTIONS = [
  { id: 2, name: "ISNA", note: "North America" },
  { id: 3, name: "Muslim World League", note: "International" },
  { id: 4, name: "Umm al-Qura, Makkah", note: "Saudi Arabia" },
  { id: 5, name: "Egyptian Authority", note: "Egypt / nearby regions" },
  { id: 1, name: "University of Karachi", note: "South Asia" },
  { id: 7, name: "Tehran", note: "Institute of Geophysics" },
  { id: 0, name: "Jafari", note: "Ithna-Ashari" }
] as const;

const listeners = new Set<() => void>();

export async function loadPrayerCalculationPreferences(): Promise<PrayerCalculationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(CALCULATION_PREFS_KEY);
    if (!raw) return DEFAULT_CALCULATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<PrayerCalculationPreferences>;
    return {
      ...DEFAULT_CALCULATION_PREFS,
      ...parsed,
      scheduleSource: parsed.scheduleSource === "calculated" ? "calculated" : "smart",
      mode: parsed.mode === "manual" ? "manual" : "smart",
      school: parsed.school === 1 ? 1 : 0,
      highLatitude: parsed.highLatitude === 0 || parsed.highLatitude === 1 || parsed.highLatitude === 2 ? parsed.highLatitude : 3,
      offsets: { ...DEFAULT_CALCULATION_PREFS.offsets, ...(parsed.offsets || {}) },
      locationMode: parsed.locationMode === "mosque" ? "mosque" : "gps",
      selectedMosque: parsed.selectedMosque || null
    };
  } catch {
    return DEFAULT_CALCULATION_PREFS;
  }
}

export async function savePrayerCalculationPreferences(value: PrayerCalculationPreferences) {
  await AsyncStorage.setItem(CALCULATION_PREFS_KEY, JSON.stringify(value));
  listeners.forEach((listener) => { try { listener(); } catch {} });
}

export function subscribePrayerCalculationChanges(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function smartMethodForLocation(latitude: number, longitude: number) {
  if (latitude >= 15 && latitude <= 72 && longitude >= -170 && longitude <= -50) return 2;
  if (latitude >= 5 && latitude <= 38 && longitude >= 60 && longitude <= 93) return 1;
  if (latitude >= 20 && latitude <= 32.9 && longitude >= 24 && longitude <= 37) return 5;
  if (latitude >= 16 && latitude <= 32.9 && longitude >= 34 && longitude <= 56) return 4;
  return 3;
}

export function tuneString(offsets: PrayerCalculationPreferences["offsets"]) {
  return [offsets.fajr, 0, offsets.dhuhr, offsets.asr, 0, offsets.maghrib, offsets.isha, 0, 0].join(",");
}
'''

PRAYER_DATA = r'''import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import bundledSchedule from "../assets/windsor_islamic_association_2026_prayer_times.json";
import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./config";
import {
  loadPrayerCalculationPreferences,
  smartMethodForLocation,
  tuneString,
  type PrayerCalculationPreferences
} from "./prayerCalculationSettings";
import type { PrayerDay, PrayerFile, PrayerTimes } from "./types";

export type PrayerLocation = {
  latitude: number;
  longitude: number;
  timezone: string;
  label: string;
  source: "windsor_islamic_association" | "aladhan" | "saved" | "local_calculation" | "mosque" | "location_required";
};

export type LoadedPrayerTimes = {
  prayerTimes: PrayerTimes;
  live: boolean;
  location: PrayerLocation;
  calculationMethod?: number | null;
};

type CachedPrayerContext = LoadedPrayerTimes & { savedAt: string };
type AlAdhanDay = { timings?: Record<string, string>; date?: { gregorian?: { date?: string } }; meta?: { timezone?: string } };
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_RADIUS_KM = 35;
const CACHE_KEY = "hassoun:prayer-context:ios:v5";
const GPS_TIMEOUT_MS = 9000;
const API_TIMEOUT_MS = 9000;
const GEOCODE_TIMEOUT_MS = 3500;

function timeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(code)), ms))]);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearWindsor(latitude: number, longitude: number) {
  return distanceKm(latitude, longitude, WINDSOR.latitude, WINDSOR.longitude) <= WINDSOR_RADIUS_KM;
}

function parseTiming(value: unknown) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

function gregorianKey(value: unknown) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function monthWindow() {
  const now = new Date();
  return [0, 1].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
}

async function getPosition(force: boolean) {
  const existing = await Location.getForegroundPermissionsAsync();
  const permission = existing.granted ? existing : await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error("LOCATION_PERMISSION_DENIED");
  if (!await Location.hasServicesEnabledAsync()) throw new Error("LOCATION_SERVICES_DISABLED");
  if (!force) {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000, requiredAccuracy: 5000 });
    if (last) return last;
  }
  return timeout(Location.getCurrentPositionAsync({ accuracy: force ? Location.Accuracy.High : Location.Accuracy.Balanced }), GPS_TIMEOUT_MS, "LOCATION_FIX_TIMEOUT");
}

async function resolveCity(latitude: number, longitude: number) {
  try {
    const places = await timeout(Location.reverseGeocodeAsync({ latitude, longitude }), GEOCODE_TIMEOUT_MS, "GEOCODE_TIMEOUT");
    const p = places[0];
    const city = p?.city || p?.subregion || p?.district;
    const region = p?.region;
    const country = p?.country;
    return [city, region || country].filter(Boolean).join(", ") || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

function methodFor(prefs: PrayerCalculationPreferences, latitude: number, longitude: number) {
  return prefs.mode === "manual" ? prefs.method : smartMethodForLocation(latitude, longitude);
}

function methodAngles(method: number) {
  const table: Record<number, { fajr: number; isha?: number; ishaMinutes?: number }> = {
    0: { fajr: 16, isha: 14 }, 1: { fajr: 18, isha: 18 }, 2: { fajr: 15, isha: 15 }, 3: { fajr: 18, isha: 17 },
    4: { fajr: 18.5, ishaMinutes: 90 }, 5: { fajr: 19.5, isha: 17.5 }, 7: { fajr: 17.7, isha: 14 }
  };
  return table[method] || table[3];
}
function dayOfYear(date: Date) { const start = Date.UTC(date.getUTCFullYear(), 0, 0); return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000); }
function solarInfo(date: Date, longitude: number) {
  const n = dayOfYear(date), gamma = 2 * Math.PI / 365 * (n - 1);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  return { decl, noonUtc: 720 - 4 * longitude - eqtime };
}
function hourAngle(latitude: number, declination: number, altitudeDeg: number) {
  const lat = latitude * Math.PI / 180, altitude = altitudeDeg * Math.PI / 180;
  const cosH = (Math.sin(altitude) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
  if (cosH <= -1 || cosH >= 1) return null;
  return Math.acos(cosH) * 180 / Math.PI * 4;
}
function asrMinutes(latitude: number, declination: number, shadowFactor: number) {
  const lat = latitude * Math.PI / 180;
  const angle = -Math.atan(1 / (shadowFactor + Math.tan(Math.abs(lat - declination)))) * 180 / Math.PI;
  return hourAngle(latitude, declination, angle);
}
function tzOffset(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value || 0);
    return Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - date.getTime()) / 60000);
  } catch { return -date.getTimezoneOffset(); }
}
function clock(minutes: number) { const n = ((Math.round(minutes) % 1440) + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; }
function applyTune(time: string, offset: number) { const [h, m] = time.split(":").map(Number); return clock(h * 60 + m + offset); }
function localPrayerDay(date: Date, latitude: number, longitude: number, timezone: string, prefs: PrayerCalculationPreferences): PrayerDay {
  const method = methodFor(prefs, latitude, longitude), angles = methodAngles(method), { decl, noonUtc } = solarInfo(date, longitude);
  const noon = noonUtc + tzOffset(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)), timezone);
  const sunriseHa = hourAngle(latitude, decl, -0.833) ?? 360;
  const fajrHa = hourAngle(latitude, decl, -angles.fajr) ?? sunriseHa + 90;
  const ishaHa = angles.isha ? (hourAngle(latitude, decl, -angles.isha) ?? sunriseHa + 90) : null;
  const asrHa = asrMinutes(latitude, decl, prefs.school === 1 ? 2 : 1) ?? 240;
  const sunset = noon + sunriseHa, o = prefs.offsets;
  return {
    fajr: applyTune(clock(noon - fajrHa), o.fajr), dhuhr: applyTune(clock(noon), o.dhuhr), asr: applyTune(clock(noon + asrHa), o.asr),
    maghrib: applyTune(clock(sunset), o.maghrib), isha: applyTune(clock(angles.ishaMinutes ? sunset + angles.ishaMinutes : noon + (ishaHa || sunriseHa + 90)), o.isha)
  };
}
function calculateLocalWindow(latitude: number, longitude: number, timezone: string, prefs: PrayerCalculationPreferences) {
  const prayerTimes: PrayerTimes = {}, now = new Date();
  for (let offset = -1; offset <= 45; offset += 1) {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    prayerTimes[key] = localPrayerDay(date, latitude, longitude, timezone, prefs);
  }
  return prayerTimes;
}

async function fetchRemoteWindow(latitude: number, longitude: number, prefs: PrayerCalculationPreferences) {
  const prayerTimes: PrayerTimes = {};
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const method = methodFor(prefs, latitude, longitude);
  for (const { year, month } of monthWindow()) {
    const url = new URL(`https://api.aladhan.com/v1/calendar/${year}/${month}`);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("method", String(method));
    url.searchParams.set("school", String(prefs.school));
    url.searchParams.set("latitudeAdjustmentMethod", String(prefs.highLatitude));
    url.searchParams.set("tune", tuneString(prefs.offsets));
    const response = await timeout(fetch(url.toString(), { headers: { Accept: "application/json" } }), API_TIMEOUT_MS, "PRAYER_API_TIMEOUT");
    if (!response.ok) throw new Error(`PRAYER_API_${response.status}`);
    const payload = await response.json() as AlAdhanResponse;
    if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("PRAYER_API_INVALID");
    timezone = payload.data.find((day) => day.meta?.timezone)?.meta?.timezone || timezone;
    for (const day of payload.data) {
      const key = gregorianKey(day.date?.gregorian?.date); if (!key) continue;
      const parsed = { fajr: parseTiming(day.timings?.Fajr), dhuhr: parseTiming(day.timings?.Dhuhr), asr: parseTiming(day.timings?.Asr), maghrib: parseTiming(day.timings?.Maghrib), isha: parseTiming(day.timings?.Isha) };
      if (Object.values(parsed).some((v) => !v)) continue;
      prayerTimes[key] = parsed as PrayerDay;
    }
  }
  if (!Object.keys(prayerTimes).length) throw new Error("PRAYER_API_EMPTY");
  return { prayerTimes, timezone, method };
}

async function savedContext(): Promise<LoadedPrayerTimes | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY) || await AsyncStorage.getItem(STORAGE_KEYS.locationSchedule);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPrayerContext;
    return parsed?.location && parsed?.prayerTimes && typeof parsed.prayerTimes === "object" ? parsed : null;
  } catch { return null; }
}
async function saveContext(context: LoadedPrayerTimes) {
  const payload = JSON.stringify({ ...context, savedAt: new Date().toISOString() } satisfies CachedPrayerContext);
  await AsyncStorage.multiSet([[CACHE_KEY, payload], [STORAGE_KEYS.locationSchedule, payload]]).catch(() => undefined);
}
function locationRequiredFallback(): LoadedPrayerTimes {
  return { prayerTimes: {}, live: false, location: { latitude: 0, longitude: 0, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", label: "Location required", source: "location_required" }, calculationMethod: null };
}
export async function loadInitialPrayerTimes(): Promise<LoadedPrayerTimes> { return (await savedContext()) || locationRequiredFallback(); }

export async function loadPrayerTimes(options: { forceLocation?: boolean } = {}): Promise<LoadedPrayerTimes> {
  const force = options.forceLocation === true;
  const saved = await savedContext();
  const prefs = await loadPrayerCalculationPreferences();
  let latitude: number, longitude: number, label: string, source: PrayerLocation["source"];
  let currentGps = false;

  if (prefs.locationMode === "mosque" && prefs.selectedMosque) {
    latitude = prefs.selectedMosque.latitude;
    longitude = prefs.selectedMosque.longitude;
    label = prefs.selectedMosque.name;
    source = "mosque";
  } else {
    try {
      const position = await getPosition(force);
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
      label = isNearWindsor(latitude, longitude) ? CITY_LABEL : await resolveCity(latitude, longitude);
      source = "aladhan";
      currentGps = true;
    } catch {
      return saved || locationRequiredFallback();
    }
  }

  const shouldUseOfficialWindsor = isNearWindsor(latitude, longitude) && prefs.scheduleSource !== "calculated";
  if (shouldUseOfficialWindsor) {
    const context: LoadedPrayerTimes = {
      prayerTimes: (bundledSchedule as PrayerFile).prayer_times,
      live: true,
      location: { latitude, longitude, timezone: WINDSOR_TIME_ZONE, label: CITY_LABEL, source: "windsor_islamic_association" },
      calculationMethod: null
    };
    await saveContext(context);
    return context;
  }

  try {
    const remote = await fetchRemoteWindow(latitude, longitude, prefs);
    const refreshed: LoadedPrayerTimes = {
      prayerTimes: remote.prayerTimes,
      live: true,
      location: { latitude, longitude, timezone: remote.timezone, label, source },
      calculationMethod: remote.method
    };
    await saveContext(refreshed);
    return refreshed;
  } catch {
    if (currentGps) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || saved?.location.timezone || "UTC";
      const local: LoadedPrayerTimes = {
        prayerTimes: calculateLocalWindow(latitude, longitude, timezone, prefs),
        live: true,
        location: { latitude, longitude, timezone, label, source: "local_calculation" },
        calculationMethod: methodFor(prefs, latitude, longitude)
      };
      await saveContext(local);
      return local;
    }
    return saved || locationRequiredFallback();
  }
}
'''

NEARBY = r'''import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadPrayerCalculationPreferences, savePrayerCalculationPreferences, type SelectedMosque } from "./prayerCalculationSettings";

type Props = { locale: "en" | "ar"; onBack: () => void };
type Row = SelectedMosque & { distanceKm: number };
const terms = ["mosque", "masjid", "Islamic centre"];
function distanceKm(a: number, b: number, c: number, d: number) { const r=(v:number)=>v*Math.PI/180, x=r(c-a), y=r(d-b), q=Math.sin(x/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(y/2)**2; return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q)); }
async function searchNearby(latitude: number, longitude: number): Promise<Row[]> {
  const delta = 0.18;
  const viewbox = `${longitude-delta},${latitude+delta},${longitude+delta},${latitude-delta}`;
  const settled = await Promise.allSettled(terms.map(async (term) => {
    const params = new URLSearchParams({ format:"jsonv2", addressdetails:"1", namedetails:"1", limit:"20", q:term, viewbox, bounded:"1" });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { "Accept-Language":"en", Accept:"application/json" } });
    if (!response.ok) return [] as any[];
    return await response.json() as any[];
  }));
  const map = new Map<string, Row>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      const lat=Number(item.lat), lon=Number(item.lon); if (!Number.isFinite(lat)||!Number.isFinite(lon)) continue;
      const display=String(item.display_name||""); const name=String(item.name||item.namedetails?.name||display.split(",")[0]||"Mosque");
      if (!/mosque|masjid|islamic|muslim|جامع|مسجد/i.test(`${name} ${display}`)) continue;
      const a=item.address||{}; const id=String(item.place_id||`${lat}:${lon}`);
      map.set(id,{ id,name,displayName:display,latitude:lat,longitude:lon,city:String(a.city||a.town||a.village||a.municipality||""),region:String(a.state||a.region||""),country:String(a.country||""),distanceKm:distanceKm(latitude,longitude,lat,lon) });
    }
  }
  return [...map.values()].sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,30);
}
export default function NearbyMosquesPage({ locale, onBack }: Props) {
  const ar=locale==="ar", t=(en:string,arabic:string)=>ar?arabic:en;
  const [rows,setRows]=useState<Row[]>([]), [loading,setLoading]=useState(true), [error,setError]=useState("");
  useEffect(()=>{ void (async()=>{ try { const p=await Location.getForegroundPermissionsAsync(); const granted=p.granted?p:await Location.requestForegroundPermissionsAsync(); if(!granted.granted) throw new Error("Location permission is required to find nearby mosques."); const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}); setRows(await searchNearby(pos.coords.latitude,pos.coords.longitude)); } catch(e){ setError(e instanceof Error?e.message:String(e)); } finally { setLoading(false); } })(); },[]);
  const useGps=async()=>{ const prefs=await loadPrayerCalculationPreferences(); await savePrayerCalculationPreferences({...prefs,locationMode:"gps",selectedMosque:null}); onBack(); };
  const choose=async(row:Row)=>{ const prefs=await loadPrayerCalculationPreferences(); const {distanceKm:_distance,...selected}=row; await savePrayerCalculationPreferences({...prefs,locationMode:"mosque",selectedMosque:selected}); onBack(); };
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={onBack}><Text style={styles.back}>‹</Text></Pressable><View><Text style={styles.title}>{t("Nearby Mosques","المساجد القريبة")}</Text><Text style={styles.sub}>{t("Choose a masjid as your prayer location source.","اختر مسجداً كمصدر لموقع مواقيت الصلاة.")}</Text></View></View>
    <Pressable onPress={()=>void useGps()} style={styles.gps}><Text style={styles.gpsTitle}>📍 {t("Use my GPS location","استخدم موقعي عبر GPS")}</Text><Text style={styles.gpsText}>{t("Recommended. Windsor uses the official local timetable; everywhere else uses exact coordinates.","موصى به. وندسور تستخدم الجدول الرسمي، وباقي المواقع تستخدم الإحداثيات الدقيقة.")}</Text></Pressable>
    {loading?<ActivityIndicator size="large" color="#0b654f"/>:null}
    {!!error?<Text style={styles.error}>{error}</Text>:null}
    {!loading&&!error&&!rows.length?<Text style={styles.empty}>{t("No nearby mosques were found. Try again with Location enabled.","لم يتم العثور على مساجد قريبة. حاول مجدداً بعد تفعيل الموقع.")}</Text>:null}
    {rows.map(row=><Pressable key={row.id} onPress={()=>void choose(row)} style={styles.card}><View style={{flex:1}}><Text style={styles.name}>🕌 {row.name}</Text><Text style={styles.address}>{row.displayName}</Text><Text style={styles.distance}>{row.distanceKm<1?`${Math.round(row.distanceKm*1000)} m`:`${row.distanceKm.toFixed(1)} km`} · {t("Use this masjid","استخدم هذا المسجد")}</Text></View><Text style={styles.arrow}>›</Text></Pressable>)}
    <Text style={styles.note}>{t("If Hassoun has a trusted official timetable for the selected mosque/location, it is used. Otherwise Hassoun calculates from the mosque's exact coordinates with AlAdhan.","إذا كان لدى حسون جدول رسمي موثوق للمسجد أو الموقع فسيتم استخدامه، وإلا تُحسب المواقيت من إحداثيات المسجد الدقيقة عبر AlAdhan.")}</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:"#f7f4ec"},content:{padding:18,paddingBottom:48,gap:10},header:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:5},back:{fontSize:44,color:"#0b654f"},title:{fontSize:24,fontWeight:"900",color:"#173f35"},sub:{fontSize:11,color:"#71807a",marginTop:2},gps:{backgroundColor:"#0b654f",borderRadius:20,padding:16},gpsTitle:{color:"#fff",fontWeight:"900",fontSize:15},gpsText:{color:"#d9ebe5",fontSize:11,lineHeight:17,marginTop:5},card:{flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderWidth:1,borderColor:"#dfddd5",borderRadius:18,padding:14},name:{color:"#173f35",fontSize:14,fontWeight:"900"},address:{color:"#7b8782",fontSize:9.5,lineHeight:14,marginTop:4},distance:{color:"#0b654f",fontSize:10,fontWeight:"800",marginTop:6},arrow:{fontSize:28,color:"#0b654f"},error:{color:"#a04735",backgroundColor:"#fff0e9",padding:14,borderRadius:14},empty:{color:"#6f7c77",padding:18,textAlign:"center"},note:{color:"#7b8782",fontSize:9.5,lineHeight:15,marginTop:8}});
'''

CALC_PAGE = r'''import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import NearbyMosquesPage from "./NearbyMosquesPage";
import { DEFAULT_CALCULATION_PREFS, METHOD_OPTIONS, loadPrayerCalculationPreferences, savePrayerCalculationPreferences, type PrayerCalculationPreferences } from "./prayerCalculationSettings";
import { loadInitialPrayerTimes } from "./prayerData";

type Props={locale:"en"|"ar";onBack:()=>void};
export default function PrayerCalculationSettingsPage({locale,onBack}:Props){
 const ar=locale==="ar",t=(en:string,a:string)=>ar?a:en; const [prefs,setPrefs]=useState<PrayerCalculationPreferences>(DEFAULT_CALCULATION_PREFS); const [nearby,setNearby]=useState(false); const [source,setSource]=useState("");
 useEffect(()=>{void loadPrayerCalculationPreferences().then(setPrefs);void loadInitialPrayerTimes().then(v=>setSource(`${v.location.label} · ${v.location.source}`));},[]);
 if(nearby)return <NearbyMosquesPage locale={locale} onBack={()=>{setNearby(false);void loadPrayerCalculationPreferences().then(setPrefs);}}/>;
 const save=async()=>{await savePrayerCalculationPreferences(prefs);Alert.alert(t("Saved","تم الحفظ"),t("Prayer source settings are active now.","تم تفعيل إعدادات مصدر مواقيت الصلاة."));};
 return <ScrollView style={s.page} contentContainerStyle={s.content}>
  <View style={s.header}><Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable><View><Text style={s.title}>{t("Prayer Calculation","حساب مواقيت الصلاة")}</Text><Text style={s.sub}>{source}</Text></View></View>
  <View style={s.hero}><Text style={s.heroTitle}>{t("GPS first by default","GPS أولاً بشكل افتراضي")}</Text><Text style={s.heroText}>{t("In Windsor, Hassoun uses the official Windsor timetable. Everywhere else, exact coordinates are sent to AlAdhan. Windsor is never used as a fallback for another city.","في وندسور يستخدم حسون الجدول الرسمي. في أي مكان آخر تُستخدم الإحداثيات الدقيقة مع AlAdhan، ولا تُستخدم وندسور كبديل لمدينة أخرى.")}</Text></View>
  <Text style={s.label}>{t("PRAYER LOCATION","موقع الصلاة")}</Text>
  <Pressable onPress={()=>setPrefs(p=>({...p,locationMode:"gps",selectedMosque:null}))} style={[s.choice,prefs.locationMode==="gps"&&s.active]}><Text style={s.choiceTitle}>📍 {t("My GPS location","موقعي عبر GPS")}</Text><Text style={s.choiceText}>{t("Recommended automatic location.","الموقع التلقائي الموصى به.")}</Text></Pressable>
  <Pressable onPress={()=>setNearby(true)} style={[s.choice,prefs.locationMode==="mosque"&&s.active]}><Text style={s.choiceTitle}>🕌 {prefs.selectedMosque?.name||t("Nearby Mosques / Prayer Location","المساجد القريبة / موقع الصلاة")}</Text><Text style={s.choiceText}>{t("Find nearby masjids and choose one as the prayer source.","ابحث عن المساجد القريبة واختر مسجداً كمصدر للصلاة.")}</Text></Pressable>
  <Text style={s.label}>{t("SOURCE BEHAVIOR","سلوك المصدر")}</Text>
  <Pressable onPress={()=>setPrefs(p=>({...p,scheduleSource:"smart"}))} style={[s.choice,prefs.scheduleSource==="smart"&&s.active]}><Text style={s.choiceTitle}>{t("Smart Automatic","تلقائي ذكي")}</Text><Text style={s.choiceText}>{t("Official Windsor schedule in Windsor; otherwise calculated from exact coordinates.","جدول وندسور الرسمي داخل وندسور؛ وإلا الحساب من الإحداثيات الدقيقة.")}</Text></Pressable>
  <Pressable onPress={()=>setPrefs(p=>({...p,scheduleSource:"calculated"}))} style={[s.choice,prefs.scheduleSource==="calculated"&&s.active]}><Text style={s.choiceTitle}>{t("Always calculated","محسوب دائماً")}</Text><Text style={s.choiceText}>{t("Always use the selected calculation method, even in Windsor.","استخدم دائماً طريقة الحساب المختارة حتى داخل وندسور.")}</Text></Pressable>
  <Text style={s.label}>{t("CALCULATION METHOD","طريقة الحساب")}</Text>
  <View style={s.row}><Pressable onPress={()=>setPrefs(p=>({...p,mode:"smart"}))} style={[s.chip,prefs.mode==="smart"&&s.chipOn]}><Text style={[s.chipText,prefs.mode==="smart"&&s.chipTextOn]}>{t("Smart","ذكي")}</Text></Pressable><Pressable onPress={()=>setPrefs(p=>({...p,mode:"manual"}))} style={[s.chip,prefs.mode==="manual"&&s.chipOn]}><Text style={[s.chipText,prefs.mode==="manual"&&s.chipTextOn]}>{t("Manual","يدوي")}</Text></Pressable></View>
  {prefs.mode==="manual"?METHOD_OPTIONS.map(m=><Pressable key={m.id} onPress={()=>setPrefs(p=>({...p,method:m.id}))} style={[s.method,prefs.method===m.id&&s.active]}><Text style={s.choiceTitle}>{m.name}</Text><Text style={s.choiceText}>{m.note}</Text></Pressable>):null}
  <Text style={s.label}>{t("ASR SCHOOL","مذهب العصر")}</Text><View style={s.row}><Pressable onPress={()=>setPrefs(p=>({...p,school:0}))} style={[s.chip,prefs.school===0&&s.chipOn]}><Text style={[s.chipText,prefs.school===0&&s.chipTextOn]}>{t("Standard","قياسي")}</Text></Pressable><Pressable onPress={()=>setPrefs(p=>({...p,school:1}))} style={[s.chip,prefs.school===1&&s.chipOn]}><Text style={[s.chipText,prefs.school===1&&s.chipTextOn]}>{t("Hanafi","حنفي")}</Text></Pressable></View>
  <Pressable onPress={()=>void save()} style={s.save}><Text style={s.saveText}>{t("Save & use these settings","حفظ واستخدام هذه الإعدادات")}</Text></Pressable>
 </ScrollView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:"#f7f4ec"},content:{padding:18,paddingBottom:48,gap:9},header:{flexDirection:"row",alignItems:"center",gap:10},back:{fontSize:44,color:"#0b654f"},title:{fontSize:24,fontWeight:"900",color:"#173f35"},sub:{fontSize:10,color:"#75827d",marginTop:2},hero:{backgroundColor:"#0b654f",borderRadius:20,padding:16},heroTitle:{color:"#fff",fontSize:15,fontWeight:"900"},heroText:{color:"#d9ebe5",fontSize:11,lineHeight:17,marginTop:5},label:{fontSize:10,fontWeight:"900",color:"#94773c",letterSpacing:1,marginTop:9},choice:{backgroundColor:"#fff",borderRadius:17,borderWidth:1,borderColor:"#dfddd5",padding:14},active:{borderColor:"#0b654f",backgroundColor:"#edf7f2"},choiceTitle:{color:"#173f35",fontSize:13,fontWeight:"900"},choiceText:{color:"#798680",fontSize:10,lineHeight:15,marginTop:3},row:{flexDirection:"row",gap:8},chip:{flex:1,minHeight:44,borderRadius:14,borderWidth:1,borderColor:"#d9ddd8",backgroundColor:"#fff",alignItems:"center",justifyContent:"center"},chipOn:{backgroundColor:"#0b654f",borderColor:"#0b654f"},chipText:{color:"#51615b",fontWeight:"900",fontSize:11},chipTextOn:{color:"#fff"},method:{backgroundColor:"#fff",borderRadius:15,borderWidth:1,borderColor:"#dfddd5",padding:12},save:{marginTop:12,minHeight:52,borderRadius:17,backgroundColor:"#0b654f",alignItems:"center",justifyContent:"center"},saveText:{color:"#fff",fontSize:12,fontWeight:"900"}});
'''

PERMISSIONS = r'''import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from "expo-audio";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props={locale:"en"|"ar";onBack:()=>void};
type State={location:string;precise:string;services:boolean;notifications:string;sounds:boolean;microphone:string};
const empty:State={location:"undetermined",precise:"unknown",services:false,notifications:"undetermined",sounds:false,microphone:"undetermined"};
export default function PermissionsStatusPage({locale,onBack}:Props){
 const ar=locale==="ar",t=(en:string,a:string)=>ar?a:en; const [state,setState]=useState<State>(empty),[busy,setBusy]=useState("");
 const refresh=useCallback(async()=>{ const [loc,services,noti,mic]=await Promise.all([Location.getForegroundPermissionsAsync(),Location.hasServicesEnabledAsync(),Notifications.getPermissionsAsync(),getRecordingPermissionsAsync()]); const ios=(loc as any).ios; setState({location:loc.status,precise:ios?.accuracy||"unknown",services,notifications:noti.status,sounds:(noti as any).ios?.allowsSound!==false,microphone:mic.status});},[]);
 useEffect(()=>{void refresh();const sub=AppState.addEventListener("change",s=>{if(s==="active")setTimeout(()=>void refresh(),250)});return()=>sub.remove();},[refresh]);
 const requestLocation=async()=>{setBusy("location");try{const r=await Location.requestForegroundPermissionsAsync();if(!r.granted&&r.canAskAgain===false)await Linking.openSettings();}finally{setBusy("");await refresh();}};
 const requestNotifications=async()=>{setBusy("notifications");try{const r=await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowBadge:true,allowSound:true}});if(!r.granted&&r.canAskAgain===false)await Linking.openSettings();}finally{setBusy("");await refresh();}};
 const requestMic=async()=>{setBusy("microphone");try{const r=await requestRecordingPermissionsAsync();if(!r.granted&&r.canAskAgain===false)await Linking.openSettings();}finally{setBusy("");await refresh();}};
 const Card=({emoji,title,body,enabled,action,label}:{emoji:string;title:string;body:string;enabled:boolean;action:()=>void;label:string})=><View style={s.card}><Text style={s.icon}>{emoji}</Text><View style={{flex:1}}><View style={s.top}><Text style={s.cardTitle}>{title}</Text><Text style={[s.badge,enabled?s.on:s.off]}>{enabled?t("ENABLED","مفعّل"):t("OFF / NEEDS ATTENTION","متوقف / يحتاج انتباه")}</Text></View><Text style={s.body}>{body}</Text><Pressable onPress={action} style={s.button}><Text style={s.buttonText}>{label}</Text></Pressable></View></View>;
 return <ScrollView style={s.page} contentContainerStyle={s.content}><View style={s.header}><Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable><View><Text style={s.title}>{t("Permissions","الأذونات")}</Text><Text style={s.sub}>{t("Live status and controls for everything Hassoun needs.","حالة مباشرة وتحكم بكل ما يحتاجه حسون.")}</Text></View></View>
 <Card emoji="📍" title={t("Location","الموقع")} body={`${t("App permission","إذن التطبيق")}: ${state.location} · ${t("Location Services","خدمات الموقع")}: ${state.services?t("On","مفعلة"):t("Off","متوقفة")} · ${t("Accuracy","الدقة")}: ${state.precise}`} enabled={state.location==="granted"&&state.services} action={()=>state.location==="granted"?void Linking.openSettings():void requestLocation()} label={busy==="location"?t("Checking…","جارٍ التحقق…"):state.location==="granted"?t("Manage / Disable in iPhone Settings","إدارة / تعطيل من إعدادات iPhone"):t("Enable location","تفعيل الموقع")}/>
 <Card emoji="🔔" title={t("Notifications & Adhan sound","الإشعارات وصوت الأذان")} body={`${t("Notifications","الإشعارات")}: ${state.notifications} · ${t("Sounds","الأصوات")}: ${state.sounds?t("On","مفعلة"):t("Off","متوقفة")}`} enabled={state.notifications==="granted"&&state.sounds} action={()=>state.notifications==="granted"?void Linking.openSettings():void requestNotifications()} label={busy==="notifications"?t("Checking…","جارٍ التحقق…"):state.notifications==="granted"?t("Manage sounds / notifications","إدارة الأصوات / الإشعارات"):t("Enable notifications","تفعيل الإشعارات")}/>
 <Card emoji="🎙️" title={t("Microphone","الميكروفون")} body={t("Used only for Qur’an recitation practice and speech comparison.","يستخدم فقط لتدريب تلاوة القرآن ومقارنة النطق.")} enabled={state.microphone==="granted"} action={()=>state.microphone==="granted"?void Linking.openSettings():void requestMic()} label={busy==="microphone"?t("Checking…","جارٍ التحقق…"):state.microphone==="granted"?t("Manage / Disable in iPhone Settings","إدارة / تعطيل من إعدادات iPhone"):t("Enable microphone","تفعيل الميكروفون")}/>
 <Card emoji="🗣️" title={t("Speech Recognition","التعرف على الكلام")} body={t("iOS controls this permission in Settings. Hassoun asks for it only when recitation practice needs speech recognition.","يتحكم iOS بهذا الإذن من الإعدادات ويطلبه حسون فقط عند الحاجة للتعرف على الكلام في تدريب التلاوة.")} enabled={true} action={()=>void Linking.openSettings()} label={t("Open iPhone app settings","فتح إعدادات التطبيق في iPhone")}/>
 <Pressable onPress={()=>void refresh()} style={s.refresh}><Text style={s.refreshText}>{t("Refresh all permission status","تحديث حالة جميع الأذونات")}</Text></Pressable><Text style={s.note}>{t("Apple does not allow apps to revoke permissions themselves. When a permission is already granted, Hassoun opens the iPhone app settings so you can turn it off or change its level.","لا تسمح Apple للتطبيق بإلغاء الإذن بنفسه. عندما يكون الإذن مفعلاً يفتح حسون إعدادات التطبيق لتتمكن من تعطيله أو تغيير مستواه.")}</Text></ScrollView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:"#f7f4ec"},content:{padding:18,paddingBottom:48,gap:10},header:{flexDirection:"row",alignItems:"center",gap:11,marginBottom:4},back:{fontSize:44,color:"#0b654f"},title:{fontSize:24,fontWeight:"900",color:"#173f35"},sub:{fontSize:10,color:"#77847f",marginTop:2},card:{flexDirection:"row",gap:12,backgroundColor:"#fff",borderWidth:1,borderColor:"#deddd6",borderRadius:20,padding:14},icon:{fontSize:24},top:{flexDirection:"row",alignItems:"center",gap:8,flexWrap:"wrap"},cardTitle:{fontSize:14,fontWeight:"900",color:"#173f35"},badge:{fontSize:7,fontWeight:"900",borderRadius:999,paddingHorizontal:7,paddingVertical:4,overflow:"hidden"},on:{color:"#0b6b51",backgroundColor:"#e6f5ee"},off:{color:"#a05432",backgroundColor:"#fff0e7"},body:{fontSize:10.5,lineHeight:16,color:"#78827e",marginTop:5},button:{alignSelf:"flex-start",marginTop:10,minHeight:36,borderRadius:11,paddingHorizontal:12,backgroundColor:"#0b654f",justifyContent:"center"},buttonText:{color:"#fff",fontSize:9.5,fontWeight:"900"},refresh:{minHeight:46,borderRadius:14,borderWidth:1,borderColor:"#0b654f",alignItems:"center",justifyContent:"center",marginTop:3},refreshText:{color:"#0b654f",fontSize:11,fontWeight:"900"},note:{fontSize:9.5,lineHeight:15,color:"#7b8782"}});
'''

Path("src/prayerCalculationSettings.ts").write_text(PRAYER_SETTINGS, encoding="utf-8")
Path("src/prayerData.ts").write_text(PRAYER_DATA, encoding="utf-8")
Path("src/NearbyMosquesPage.tsx").write_text(NEARBY, encoding="utf-8")
Path("src/PrayerCalculationSettingsPage.tsx").write_text(CALC_PAGE, encoding="utf-8")
Path("src/PermissionsStatusPage.tsx").write_text(PERMISSIONS, encoding="utf-8")

# Wire SettingsHub to the functional pages.
hub_path = Path("src/SettingsHub.tsx")
hub = hub_path.read_text(encoding="utf-8")
for import_line in [
    'import PrayerCalculationSettingsPage from "./PrayerCalculationSettingsPage";',
    'import PermissionsStatusPage from "./PermissionsStatusPage";'
]:
    if import_line not in hub:
        hub = hub.replace('import AboutHassounPage from "./AboutHassounPage";', 'import AboutHassounPage from "./AboutHassounPage";\n' + import_line, 1)
hub = re.sub(r'type SettingsPage = ([^;]+);', lambda m: 'type SettingsPage = ' + (m.group(1) if '"calculation"' in m.group(1) else m.group(1) + ' | "calculation"') + ';', hub, count=1)
if 'title={t("Prayer calculation"' not in hub:
    alert = re.search(r'(<Row emoji="🔔" title=\{t\("Prayer & Adhan alerts".*?onPress=\{onOpenAlerts\} />)', hub, re.S)
    if not alert: raise SystemExit("Prayer alerts row anchor missing")
    row='\n        <Row emoji="🧭" title={t("Prayer calculation", "حساب مواقيت الصلاة")} text={t("GPS source, nearby mosques, calculation methods and Asr school", "مصدر GPS والمساجد القريبة وطرق الحساب ومذهب العصر")} onPress={() => setPage("calculation")} />'
    hub=hub[:alert.end()]+row+hub[alert.end():]
# Replace old explanatory permissions renderer.
start=hub.find('  if (page === "permissions") {')
if start>=0:
    end=hub.find('\n  if (page === "data") {', start)
    if end<0: raise SystemExit("Permissions renderer end missing")
    hub=hub[:start]+'  if (page === "permissions") return <PermissionsStatusPage locale={locale} onBack={() => setPage("root")} />;\n\n'+hub[end+1:]
marker='  if (page === "guide") return <FeatureGuidePage'
idx=hub.find(marker)
if idx<0: raise SystemExit("Settings renderer anchor missing")
if 'page === "calculation"' not in hub:
    hub=hub[:idx]+'  if (page === "calculation") return <PrayerCalculationSettingsPage locale={locale} onBack={() => setPage("root")} />;\n\n'+hub[idx:]
hub_path.write_text(hub, encoding="utf-8")

# Refresh App immediately after a source/method/mosque change.
app_path=Path("App.tsx")
app=app_path.read_text(encoding="utf-8")
import_line='import { subscribePrayerCalculationChanges } from "./src/prayerCalculationSettings";'
if import_line not in app:
    app=app.replace('import { loadPrayerTimes, type PrayerLocation } from "./src/prayerData";', 'import { loadPrayerTimes, type PrayerLocation } from "./src/prayerData";\n'+import_line, 1)
anchor='  useEffect(() => {\n    const sync = () => { if (QuranAudio) setGlobalQuranAudio(QuranAudio.getStatus()); };'
if 'subscribePrayerCalculationChanges(() =>' not in app:
    idx=app.find(anchor)
    if idx<0: raise SystemExit("App effect anchor missing")
    effect='''  useEffect(() => subscribePrayerCalculationChanges(() => {\n    void loadPrayerTimes({ forceLocation: true }).then((refreshed) => {\n      setPrayerTimes(refreshed.prayerTimes);\n      setPrayerLocation(refreshed.location);\n      setLive(refreshed.live);\n    }).catch(() => undefined);\n  }), []);\n\n'''
    app=app[:idx]+effect+app[idx:]
app_path.write_text(app, encoding="utf-8")

print("Applied iOS v1.0.37 GPS-first prayer source, nearby mosques, calculation controls, and functional permissions")
