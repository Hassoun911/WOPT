from pathlib import Path
import re

ROOT = Path('.')
PRAYER = ROOT / 'src/prayerData.ts'
CALC = ROOT / 'src/PrayerCalculationSettingsPage.tsx'
MOSQUES = ROOT / 'src/NearbyMosquesPage.tsx'
PREF = ROOT / 'src/nearestMosquePreference.ts'
APP = ROOT / 'App.tsx'
HUB = ROOT / 'src/SettingsHub.tsx'
CONFIG = ROOT / 'app.config.ts'

# -----------------------------------------------------------------------------
# Persistent Home nearest-mosque preference.
# -----------------------------------------------------------------------------
PREF.write_text(r'''import AsyncStorage from "@react-native-async-storage/async-storage";

export const SHOW_NEAREST_MOSQUE_HOME_KEY = "hassoun:nearest-mosque-home:v1";
const listeners = new Set<(enabled: boolean) => void>();

export async function loadShowNearestMosqueOnHome() {
  try { return (await AsyncStorage.getItem(SHOW_NEAREST_MOSQUE_HOME_KEY)) === "1"; }
  catch { return false; }
}

export async function saveShowNearestMosqueOnHome(enabled: boolean) {
  await AsyncStorage.setItem(SHOW_NEAREST_MOSQUE_HOME_KEY, enabled ? "1" : "0");
  for (const listener of listeners) { try { listener(enabled); } catch {} }
}

export function subscribeShowNearestMosqueOnHome(listener: (enabled: boolean) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
''', encoding='utf-8')

# -----------------------------------------------------------------------------
# Mosques Near Me. Mosque choice is directory/navigation only and never affects
# prayer calculation coordinates. Windsor has a trusted seed directory and live
# providers can enrich it. All requests have hard deadlines.
# -----------------------------------------------------------------------------
MOSQUES.write_text(r'''import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { loadPrayerCalculationPreferences, savePrayerCalculationPreferences, type SelectedMosque } from "./prayerCalculationSettings";
import { loadShowNearestMosqueOnHome, saveShowNearestMosqueOnHome } from "./nearestMosquePreference";

type Props = { locale: "en" | "ar"; onBack: () => void };
export type MosqueRow = SelectedMosque & { distanceKm: number };

const WINDSOR_CENTER = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_TRUSTED_MOSQUES = [
  { id: "windsor-mosque", name: "Windsor Mosque", address: "1320 Northwood St, Windsor, ON N9E 1A4, Canada", latitude: 42.27742, longitude: -83.03205 },
  { id: "wia-centre", name: "Windsor Islamic Association Centre", address: "2555 McKay Ave, Windsor, ON N9E 2P4, Canada", latitude: 42.27438, longitude: -83.03135 },
  { id: "tarbiyah-centre", name: "Tarbiyah Centre", address: "1955 Provincial Rd Unit 2 & 3, Windsor, ON N8W 5V7, Canada" },
  { id: "west-musallah", name: "West Musallah Windsor", address: "3324 Bloomfield Rd, Windsor, ON N9C 1R3, Canada" },
  { id: "rose-city", name: "Rose City Islamic Centre (RCIC)", address: "5420 Empress St, Windsor, ON N8T 1B4, Canada" },
  { id: "masjid-at-taqwa", name: "MASJID AT-TAQWA", address: "1970 Tourangeau Rd, Windsor, ON N8W 4N3, Canada" },
  { id: "noor-ul-islam", name: "Masjid Noor-ul-Islam", address: "659 Lincoln Rd, Windsor, ON N8Y 2G8, Canada", latitude: 42.32117, longitude: -83.01546 },
  { id: "alber-mosque", name: "ALBER Mosque", address: "65 Ellis St E, Windsor, ON N8X 2G8, Canada" },
  { id: "al-hijra", name: "Al-Hijra Academy - Masjid And Islamic School", address: "5100 Howard Ave, Windsor, ON N9H 0M3, Canada", latitude: 42.22755, longitude: -82.9964 }
] as const;

function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number){const r=(v:number)=>v*Math.PI/180,dLat=r(lat2-lat1),dLon=r(lon2-lon1);const a=Math.sin(dLat/2)**2+Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function first(...values:unknown[]){for(const value of values){if(typeof value==="string"&&value.trim())return value.trim();}return "";}
function withDeadline<T>(promise:Promise<T>,ms:number,code:string):Promise<T>{return Promise.race([promise,new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error(code)),ms))]);}
async function fetchWithTimeout(url:string,init:RequestInit={},ms=5000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...init,signal:controller.signal});}finally{clearTimeout(timer);}}
function normalizedName(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function addRow(map:Map<string,MosqueRow>,row:MosqueRow){const duplicate=[...map.values()].some(v=>normalizedName(v.name)===normalizedName(row.name)||distanceKm(v.latitude,v.longitude,row.latitude,row.longitude)<0.08);if(!duplicate)map.set(row.id,row);}

async function trustedWindsor(latitude:number,longitude:number){
  const rows:MosqueRow[]=[];
  for(const seed of WINDSOR_TRUSTED_MOSQUES){
    let lat="latitude" in seed?Number(seed.latitude):NaN,lon="longitude" in seed?Number(seed.longitude):NaN;
    if(!Number.isFinite(lat)||!Number.isFinite(lon)){
      try{const points=await withDeadline(Location.geocodeAsync(seed.address),2500,"GEOCODE_TIMEOUT");lat=Number(points[0]?.latitude);lon=Number(points[0]?.longitude);}catch{}
    }
    if(!Number.isFinite(lat)||!Number.isFinite(lon)){
      try{const params=new URLSearchParams({format:"jsonv2",limit:"1",q:seed.address});const response=await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`,{headers:{Accept:"application/json","Accept-Language":"en"}},2200);if(response.ok){const raw=(await response.json() as any[])[0];lat=Number(raw?.lat);lon=Number(raw?.lon);}}catch{}
    }
    if(Number.isFinite(lat)&&Number.isFinite(lon))rows.push({id:`trusted:${seed.id}`,name:seed.name,displayName:seed.address,latitude:lat,longitude:lon,city:"Windsor",region:"Ontario",country:"Canada",distanceKm:distanceKm(latitude,longitude,lat,lon)});
  }
  return rows;
}

async function queryOverpass(latitude:number,longitude:number,radiusMeters:number){
  const query=`[out:json][timeout:7];(node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});node["building"="mosque"](around:${radiusMeters},${latitude},${longitude});way["building"="mosque"](around:${radiusMeters},${latitude},${longitude});node["name"~"mosque|masjid|islamic centre|islamic center|مسجد|جامع",i](around:${radiusMeters},${latitude},${longitude}););out center tags;`;
  let lastError:unknown=null;
  for(const endpoint of ["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"]){
    try{const response=await fetchWithTimeout(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:`data=${encodeURIComponent(query)}`},5000);if(!response.ok)throw new Error(`HTTP_${response.status}`);const payload=await response.json() as {elements?:any[]};return payload.elements||[];}catch(error){lastError=error;}
  }
  throw lastError||new Error("OVERPASS_UNAVAILABLE");
}

function overpassRow(element:any,latitude:number,longitude:number):MosqueRow|null{
  const lat=Number(element?.lat??element?.center?.lat),lon=Number(element?.lon??element?.center?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;const tags=element?.tags||{};const name=first(tags.name,tags["name:en"],tags["name:ar"],"Mosque");const address=[tags["addr:housenumber"],tags["addr:street"],tags["addr:city"]||tags["addr:town"],tags["addr:state"]].filter(Boolean).join(", ");return{id:`osm:${element?.type||"place"}:${element?.id||`${lat}:${lon}`}`,name,displayName:address||name,latitude:lat,longitude:lon,city:first(tags["addr:city"],tags["addr:town"],tags["addr:village"])||undefined,region:first(tags["addr:state"],tags["addr:province"])||undefined,country:first(tags["addr:country"])||undefined,distanceKm:distanceKm(latitude,longitude,lat,lon)};
}

export async function findNearbyMosques(latitude:number,longitude:number):Promise<MosqueRow[]>{
  const map=new Map<string,MosqueRow>(),windsor=distanceKm(latitude,longitude,WINDSOR_CENTER.latitude,WINDSOR_CENTER.longitude)<=45;let providerSucceeded=false;
  if(windsor){try{for(const row of await withDeadline(trustedWindsor(latitude,longitude),7000,"WINDSOR_DIRECTORY_TIMEOUT"))addRow(map,row);}catch{}}
  try{for(const element of await queryOverpass(latitude,longitude,windsor?45000:30000)){const row=overpassRow(element,latitude,longitude);if(row&&row.distanceKm<=(windsor?45:30))addRow(map,row);}providerSucceeded=true;}catch{}
  if(map.size<5){
    try{const places=await withDeadline(Location.reverseGeocodeAsync({latitude,longitude}),3500,"REVERSE_GEOCODE_TIMEOUT");const p=places[0],where=[p?.city||p?.subregion||p?.district,p?.region,p?.country].filter(Boolean).join(" ");for(const word of ["mosque","masjid","Islamic centre"]){const params=new URLSearchParams({format:"jsonv2",addressdetails:"1",namedetails:"1",limit:"30",q:`${word} ${where}`});const response=await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`,{headers:{Accept:"application/json","Accept-Language":"en"}},3500);if(!response.ok)continue;providerSucceeded=true;for(const raw of await response.json() as any[]){const lat=Number(raw?.lat),lon=Number(raw?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;const d=distanceKm(latitude,longitude,lat,lon);if(d>(windsor?45:30))continue;const a=raw?.address||{},name=first(raw?.namedetails?.name,raw?.name,raw?.display_name?.split(",")[0],"Mosque");addRow(map,{id:`nom:${raw?.place_id||`${lat}:${lon}`}`,name,displayName:first(raw?.display_name,name),latitude:lat,longitude:lon,city:first(a.city,a.town,a.village,a.municipality)||undefined,region:first(a.state,a.region)||undefined,country:first(a.country)||undefined,distanceKm:d});}}
    }catch{}
  }
  if(!map.size&&!providerSucceeded)throw new Error("MOSQUE_DIRECTORY_UNAVAILABLE");
  return [...map.values()].sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,50);
}

export default function NearbyMosquesPage({locale,onBack}:Props){
  const ar=locale==="ar",t=(en:string,a:string)=>ar?a:en;
  const [rows,setRows]=useState<MosqueRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[showHome,setShowHome]=useState(false),[selected,setSelected]=useState<SelectedMosque|null>(null);
  const load=async()=>{setLoading(true);setError("");try{const permission=await Location.getForegroundPermissionsAsync();const granted=permission.granted?permission:await Location.requestForegroundPermissionsAsync();if(!granted.granted)throw new Error("LOCATION_PERMISSION_DENIED");const last=await Location.getLastKnownPositionAsync({maxAge:10*60*1000,requiredAccuracy:5000});let pos=last;try{pos=await withDeadline(Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}),6500,"LOCATION_TIMEOUT");}catch{}if(!pos)throw new Error("LOCATION_TIMEOUT");setRows(await withDeadline(findNearbyMosques(pos.coords.latitude,pos.coords.longitude),14000,"MOSQUE_SEARCH_TIMEOUT"));}catch(e){const code=e instanceof Error?e.message:String(e);setError(code==="LOCATION_PERMISSION_DENIED"?t("Location permission is required to find mosques near you.","يلزم إذن الموقع للعثور على المساجد القريبة."):code==="LOCATION_TIMEOUT"?t("Could not get your GPS location. Tap refresh to try again.","تعذر الحصول على موقع GPS. اضغط تحديث للمحاولة مرة أخرى."):code==="MOSQUE_SEARCH_TIMEOUT"?t("Mosque search timed out. Tap refresh to try again.","انتهت مهلة البحث عن المساجد. اضغط تحديث للمحاولة مرة أخرى."):t("Mosque directory is temporarily unavailable. Tap refresh to try again.","دليل المساجد غير متاح مؤقتاً. اضغط تحديث للمحاولة مرة أخرى."));}finally{setLoading(false);}};
  useEffect(()=>{void loadPrayerCalculationPreferences().then(v=>setSelected(v.selectedMosque));void loadShowNearestMosqueOnHome().then(setShowHome);void load();},[]);
  const visible=useMemo(()=>{const q=query.trim().toLowerCase();return q?rows.filter(r=>`${r.name} ${r.displayName}`.toLowerCase().includes(q)):rows;},[query,rows]);
  const choose=async(row:MosqueRow)=>{const prefs=await loadPrayerCalculationPreferences();const {distanceKm:_distance,...mosque}=row;await savePrayerCalculationPreferences({...prefs,locationMode:"mosque",selectedMosque:mosque});setSelected(mosque);};
  const clear=async()=>{const prefs=await loadPrayerCalculationPreferences();await savePrayerCalculationPreferences({...prefs,locationMode:"gps",selectedMosque:null});setSelected(null);};
  const toggle=async(value:boolean)=>{setShowHome(value);await saveShowNearestMosqueOnHome(value);};
  const distance=(km:number)=>km<1?`${Math.max(50,Math.round(km*1000/50)*50)} m`:km<10?`${km.toFixed(1)} km`:`${Math.round(km)} km`;
  return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.header}><Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable><View style={{flex:1}}><Text style={s.title}>{t("Mosques Near Me","المساجد القريبة مني")}</Text><Text style={s.sub}>{t("Mosques are for location, distance and directions only. Prayer times always use your phone GPS.","المساجد للموقع والمسافة والاتجاهات فقط. مواقيت الصلاة تستخدم GPS الهاتف دائماً.")}</Text></View></View>
    <View style={s.switchCard}><View style={{flex:1}}><Text style={s.switchTitle}>{t("Show nearest mosque on Home","إظهار أقرب مسجد في الرئيسية")}</Text><Text style={s.switchText}>{t("Shows the closest mosque and distance at the bottom of Home.","يعرض أقرب مسجد والمسافة أسفل الصفحة الرئيسية.")}</Text></View><Switch value={showHome} onValueChange={v=>void toggle(v)} /></View>
    {selected?<Pressable onPress={()=>void clear()} style={s.selected}><Text style={s.selectedTitle}>✓ {selected.name}</Text><Text style={s.selectedText}>{t("Saved mosque. Prayer calculation still uses GPS. Tap to clear selection.","المسجد محفوظ. حساب الصلاة ما زال يستخدم GPS. اضغط لمسح الاختيار.")}</Text></Pressable>:null}
    <TextInput value={query} onChangeText={setQuery} placeholder={t("Search mosque name or address","ابحث باسم المسجد أو العنوان")} placeholderTextColor="#8b9691" style={s.search} autoCorrect={false}/>
    <Pressable onPress={()=>void load()} style={s.refresh}><Text style={s.refreshText}>↻ {t("Refresh from my GPS location","تحديث من موقع GPS")}</Text></Pressable>
    {loading?<View style={s.loading}><ActivityIndicator size="large" color="#0b654f"/><Text style={s.loadingText}>{t("Loading mosques near you…","جارٍ تحميل المساجد القريبة منك…")}</Text></View>:null}
    {!!error?<Text style={s.error}>{error}</Text>:null}
    {!loading&&!error&&visible.length===0?<Text style={s.empty}>{t("No mosques found in this search.","لم يتم العثور على مساجد في هذا البحث.")}</Text>:null}
    {visible.map(row=><Pressable key={row.id} onPress={()=>void choose(row)} style={s.card}><View style={{flex:1}}><Text style={s.name}>{row.name}</Text><Text style={s.address}>{row.displayName}</Text><Text style={s.distance}>🚗 {distance(row.distanceKm)}</Text></View><Text style={s.arrow}>›</Text></Pressable>)}
  </ScrollView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:"#f7f4ec"},content:{padding:18,paddingBottom:52,gap:10},header:{flexDirection:"row",alignItems:"flex-start",gap:12,marginBottom:4},back:{fontSize:44,color:"#0b654f",lineHeight:44},title:{fontSize:24,fontWeight:"900",color:"#173f35"},sub:{fontSize:10.5,lineHeight:16,color:"#71807a",marginTop:3},switchCard:{flexDirection:"row",alignItems:"center",gap:12,padding:15,borderRadius:18,backgroundColor:"#fff",borderWidth:1,borderColor:"#d9ddd8"},switchTitle:{fontSize:14,fontWeight:"900",color:"#173f35"},switchText:{fontSize:10.5,lineHeight:15,color:"#74817c",marginTop:3},selected:{padding:14,borderRadius:16,backgroundColor:"#eaf5f0",borderWidth:1,borderColor:"#9fcdbf"},selectedTitle:{fontSize:13,fontWeight:"900",color:"#0b654f"},selectedText:{fontSize:10,lineHeight:15,color:"#62736c",marginTop:3},search:{minHeight:46,borderRadius:14,paddingHorizontal:14,backgroundColor:"#fff",borderWidth:1,borderColor:"#d9ddd8",color:"#173f35"},refresh:{minHeight:44,borderRadius:14,borderWidth:1,borderColor:"#0b654f",alignItems:"center",justifyContent:"center"},refreshText:{color:"#0b654f",fontSize:11,fontWeight:"900"},loading:{alignItems:"center",gap:8,padding:20},loadingText:{color:"#697771",fontSize:11},error:{color:"#a04735",backgroundColor:"#fff0e9",padding:14,borderRadius:14},empty:{color:"#6f7c77",padding:18,textAlign:"center"},card:{flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderWidth:1,borderColor:"#dfddd5",borderRadius:18,padding:14},name:{color:"#173f35",fontSize:14,fontWeight:"900"},address:{color:"#7b8782",fontSize:9.5,lineHeight:14,marginTop:4},distance:{color:"#0b654f",fontSize:10,fontWeight:"800",marginTop:6},arrow:{fontSize:28,color:"#0b654f"}});
''', encoding='utf-8')

# -----------------------------------------------------------------------------
# Prayer Calculation page: GPS automatically decides source. Mosque selection is
# deliberately absent from the prayer-time equation.
# -----------------------------------------------------------------------------
CALC.write_text(r'''import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import NearbyMosquesPage from "./NearbyMosquesPage";
import { DEFAULT_CALCULATION_PREFS, METHOD_OPTIONS, loadPrayerCalculationPreferences, savePrayerCalculationPreferences, type PrayerCalculationPreferences } from "./prayerCalculationSettings";
import { loadPrayerTimes } from "./prayerData";

type Props={locale:"en"|"ar";onBack:()=>void};
const OFFSETS=["fajr","dhuhr","asr","maghrib","isha"] as const;
export default function PrayerCalculationSettingsPage({locale,onBack}:Props){
 const ar=locale==="ar",t=(en:string,a:string)=>ar?a:en;const [prefs,setPrefs]=useState<PrayerCalculationPreferences>(DEFAULT_CALCULATION_PREFS),[nearby,setNearby]=useState(false),[routeReady,setRouteReady]=useState(false),[source,setSource]=useState("");
 useEffect(()=>{void loadPrayerCalculationPreferences().then(setPrefs);void loadPrayerTimes().then(v=>setSource(`${v.location.label} · ${v.location.source}`));void AsyncStorage.getItem("hassoun:prayer-calc-child-route:v1").then(v=>{if(v==="mosques")setNearby(true)}).finally(()=>setRouteReady(true));},[]);
 useEffect(()=>{if(routeReady)void AsyncStorage.setItem("hassoun:prayer-calc-child-route:v1",nearby?"mosques":"calculation");},[nearby,routeReady]);
 if(nearby)return <NearbyMosquesPage locale={locale} onBack={()=>{setNearby(false);void loadPrayerCalculationPreferences().then(setPrefs);}}/>;
 const save=async()=>{await savePrayerCalculationPreferences({...prefs,scheduleSource:"smart"});Alert.alert(t("Saved","تم الحفظ"),t("Calculation settings are saved. GPS automatically chooses the prayer source.","تم حفظ إعدادات الحساب. يختار GPS مصدر مواقيت الصلاة تلقائياً."));};
 const setOffset=(key:typeof OFFSETS[number],value:string)=>{const n=Math.max(-60,Math.min(60,Number(value)||0));setPrefs(p=>({...p,offsets:{...p.offsets,[key]:n}}));};
 return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <View style={s.header}><Pressable onPress={onBack}><Text style={s.back}>‹</Text></Pressable><View style={{flex:1}}><Text style={s.title}>{t("Prayer Calculation","حساب مواقيت الصلاة")}</Text><Text style={s.sub}>{source}</Text></View></View>
  <View style={s.hero}><Text style={s.heroTitle}>📍 {t("Automatic by GPS","تلقائي حسب GPS")}</Text><Text style={s.heroText}>{t("Hassoun always uses your phone GPS. In Windsor, official Hassoun/Windsor data is used when available for today. Everywhere else — or if Windsor data is unavailable — prayer times are calculated from GPS. Choosing a mosque never changes prayer times.","يستخدم حسون دائماً GPS الهاتف. في وندسور تُستخدم بيانات حسون/وندسور الرسمية عند توفرها لليوم. في أي مكان آخر، أو إذا لم تتوفر بيانات وندسور، تُحسب المواقيت من GPS. اختيار مسجد لا يغيّر مواقيت الصلاة.")}</Text></View>
  <Text style={s.label}>{t("MOSQUE DIRECTORY","دليل المساجد")}</Text>
  <Pressable onPress={()=>setNearby(true)} style={s.mosque}><View style={{flex:1}}><Text style={s.mosqueTitle}>🕌 {t("Mosques Near Me","المساجد القريبة مني")}</Text><Text style={s.mosqueText}>{prefs.selectedMosque?t(`Saved: ${prefs.selectedMosque.name}. This does not affect prayer calculations.`,`محفوظ: ${prefs.selectedMosque.name}. هذا لا يؤثر على حساب مواقيت الصلاة.`):t("Find nearby mosques, see distance, save one and open directions. Prayer calculations remain GPS-based.","ابحث عن المساجد القريبة والمسافة واحفظ مسجداً وافتح الاتجاهات. حساب الصلاة يبقى معتمداً على GPS.")}</Text></View><Text style={s.arrow}>›</Text></Pressable>
  <Text style={s.label}>{t("CALCULATION METHOD","طريقة الحساب")}</Text>
  <View style={s.row}><Pressable onPress={()=>setPrefs(p=>({...p,mode:"smart"}))} style={[s.chip,prefs.mode==="smart"&&s.chipOn]}><Text style={[s.chipText,prefs.mode==="smart"&&s.chipTextOn]}>{t("Smart","ذكي")}</Text></Pressable><Pressable onPress={()=>setPrefs(p=>({...p,mode:"manual"}))} style={[s.chip,prefs.mode==="manual"&&s.chipOn]}><Text style={[s.chipText,prefs.mode==="manual"&&s.chipTextOn]}>{t("Manual","يدوي")}</Text></Pressable></View>
  {prefs.mode==="manual"?METHOD_OPTIONS.map(method=><Pressable key={method.id} onPress={()=>setPrefs(p=>({...p,method:method.id}))} style={[s.choice,prefs.method===method.id&&s.active]}><Text style={s.choiceTitle}>{prefs.method===method.id?"✓ ":""}{method.name}</Text><Text style={s.choiceText}>{method.note}</Text></Pressable>):<Text style={s.note}>{t("Smart chooses a suitable method for the GPS region when official Windsor data is not active.","يختار الوضع الذكي طريقة مناسبة لمنطقة GPS عندما لا تكون بيانات وندسور الرسمية فعالة.")}</Text>}
  <Text style={s.label}>{t("ASR SCHOOL","مذهب العصر")}</Text><View style={s.row}><Pressable onPress={()=>setPrefs(p=>({...p,school:0}))} style={[s.chip,prefs.school===0&&s.chipOn]}><Text style={[s.chipText,prefs.school===0&&s.chipTextOn]}>{t("Standard / Shafi‘i","قياسي / شافعي")}</Text></Pressable><Pressable onPress={()=>setPrefs(p=>({...p,school:1}))} style={[s.chip,prefs.school===1&&s.chipOn]}><Text style={[s.chipText,prefs.school===1&&s.chipTextOn]}>{t("Hanafi","حنفي")}</Text></Pressable></View>
  <Text style={s.label}>{t("HIGH LATITUDE","خطوط العرض العليا")}</Text><View style={s.row}>{[[3,t("Angle based","حسب الزاوية")],[1,t("Middle night","منتصف الليل")],[2,t("One seventh","السُبع")],[0,t("None","بدون")]].map(([id,label])=><Pressable key={String(id)} onPress={()=>setPrefs(p=>({...p,highLatitude:Number(id) as 0|1|2|3}))} style={[s.smallChip,prefs.highLatitude===Number(id)&&s.chipOn]}><Text style={[s.chipText,prefs.highLatitude===Number(id)&&s.chipTextOn]}>{String(label)}</Text></Pressable>)}</View>
  <Text style={s.label}>{t("MINUTE TUNING","ضبط الدقائق")}</Text>{OFFSETS.map(key=><View key={key} style={s.offsetRow}><Text style={s.offsetName}>{key[0].toUpperCase()+key.slice(1)}</Text><TextInput keyboardType="numbers-and-punctuation" value={String(prefs.offsets[key])} onChangeText={v=>setOffset(key,v)} style={s.offsetInput}/><Text style={s.offsetUnit}>{t("min","د")}</Text></View>)}
  <Pressable onPress={()=>void save()} style={s.save}><Text style={s.saveText}>{t("Save calculation settings","حفظ إعدادات الحساب")}</Text></Pressable>
  <Text style={s.note}>{t("Prayer source is automatic by GPS. Mosque choices are for finding, saving and navigating only; they never change the prayer calculation.","مصدر الصلاة تلقائي حسب GPS. اختيارات المسجد للبحث والحفظ والاتجاهات فقط ولا تغيّر حساب الصلاة أبداً.")}</Text>
 </ScrollView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:"#f7f4ec"},content:{padding:18,paddingBottom:52,gap:10},header:{flexDirection:"row",alignItems:"center",gap:11},back:{fontSize:44,color:"#0b654f"},title:{fontSize:24,fontWeight:"900",color:"#173f35"},sub:{fontSize:10,color:"#77847f",marginTop:2},hero:{padding:16,borderRadius:18,backgroundColor:"#0b654f"},heroTitle:{fontSize:16,fontWeight:"900",color:"#fff"},heroText:{fontSize:10.5,lineHeight:16,color:"#dcebe6",marginTop:5},label:{fontSize:10,fontWeight:"900",color:"#8d7631",letterSpacing:.8,marginTop:7},mosque:{flexDirection:"row",alignItems:"center",gap:10,padding:15,borderRadius:18,backgroundColor:"#fff",borderWidth:1,borderColor:"#d8ddd8"},mosqueTitle:{fontSize:15,fontWeight:"900",color:"#173f35"},mosqueText:{fontSize:10.5,lineHeight:16,color:"#74817c",marginTop:3},arrow:{fontSize:30,color:"#0b654f"},row:{flexDirection:"row",gap:8,flexWrap:"wrap"},chip:{paddingHorizontal:13,paddingVertical:10,borderRadius:13,borderWidth:1,borderColor:"#d8ddd8",backgroundColor:"#fff"},smallChip:{paddingHorizontal:10,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:"#d8ddd8",backgroundColor:"#fff"},chipOn:{backgroundColor:"#0b654f",borderColor:"#0b654f"},chipText:{fontSize:10.5,fontWeight:"800",color:"#45554f"},chipTextOn:{color:"#fff"},choice:{padding:13,borderRadius:15,borderWidth:1,borderColor:"#d8ddd8",backgroundColor:"#fff"},active:{borderColor:"#0b654f",backgroundColor:"#edf6f2"},choiceTitle:{fontSize:12.5,fontWeight:"900",color:"#173f35"},choiceText:{fontSize:9.5,color:"#78827e",marginTop:3},offsetRow:{flexDirection:"row",alignItems:"center",gap:10,padding:11,borderRadius:14,backgroundColor:"#fff",borderWidth:1,borderColor:"#e0ded7"},offsetName:{flex:1,fontSize:12,fontWeight:"800",color:"#173f35"},offsetInput:{width:65,height:36,borderRadius:10,borderWidth:1,borderColor:"#ccd4d0",textAlign:"center",color:"#173f35",backgroundColor:"#fafcfb"},offsetUnit:{width:24,fontSize:10,color:"#78827e"},save:{minHeight:48,borderRadius:15,backgroundColor:"#0b654f",alignItems:"center",justifyContent:"center",marginTop:8},saveText:{color:"#fff",fontSize:12,fontWeight:"900"},note:{fontSize:10,lineHeight:15,color:"#74817c"}});
''', encoding='utf-8')

# -----------------------------------------------------------------------------
# Prayer runtime: GPS is always the coordinate source. Windsor official data is
# automatic only when GPS is in Windsor and today's bundled date exists.
# -----------------------------------------------------------------------------
prayer = PRAYER.read_text(encoding='utf-8')
pattern = re.compile(r'''  let latitude: number, longitude: number, label: string, source: PrayerLocation\["source"\];\n  let currentGps = false;\n\n  if \(prefs\.locationMode === "mosque" && prefs\.selectedMosque\) \{.*?\n  \}\n\n  const shouldUseOfficialWindsor = isNearWindsor\(latitude, longitude\) && prefs\.scheduleSource !== "calculated";''', re.S)
replacement = '''  let latitude: number, longitude: number, label: string, source: PrayerLocation["source"];
  let currentGps = false;

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

  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: WINDSOR_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values: Record<string,string> = {}; for (const part of parts) values[part.type] = part.value;
  const windsorToday = `${values.year}-${values.month}-${values.day}`;
  const officialWindsorAvailable = Boolean((bundledSchedule as PrayerFile).prayer_times[windsorToday]);
  const shouldUseOfficialWindsor = isNearWindsor(latitude, longitude) && officialWindsorAvailable;'''
prayer, count = pattern.subn(replacement, prayer, count=1)
if count != 1: raise SystemExit('Could not install GPS-only prayer runtime')
PRAYER.write_text(prayer, encoding='utf-8')

# -----------------------------------------------------------------------------
# Preserve nested Settings page across process recreation and make iOS widget
# wording/capabilities native instead of Android-specific.
# -----------------------------------------------------------------------------
hub = HUB.read_text(encoding='utf-8')
if 'import AsyncStorage from "@react-native-async-storage/async-storage";' not in hub:
    hub = 'import AsyncStorage from "@react-native-async-storage/async-storage";\n' + hub
state = '  const [page, setPage] = useState<SettingsPage>("root");'
if state in hub and 'settingsRouteReady' not in hub:
    hub = hub.replace(state, state + '\n  const [settingsRouteReady, setSettingsRouteReady] = useState(false);', 1)
    anchor = '  const [readerOpen, setReaderOpen] = useState(false);'
    effects = '''\n\n  useEffect(() => { let alive=true; void AsyncStorage.getItem("hassoun:settings-nested-route:v1").then(saved=>{if(alive&&saved)setPage(saved as SettingsPage);}).finally(()=>{if(alive)setSettingsRouteReady(true);}); return()=>{alive=false}; }, []);\n  useEffect(() => { if(settingsRouteReady) void AsyncStorage.setItem("hassoun:settings-nested-route:v1", page).catch(()=>undefined); }, [page, settingsRouteReady]);'''
    if anchor not in hub: raise SystemExit('Settings route anchor missing')
    hub = hub.replace(anchor, anchor + effects, 1)
hub = hub.replace('actual size Android gives it', 'widget family selected on iPhone or iPad')
hub = hub.replace('follows your Android light/dark setting', 'follows your iPhone or iPad light/dark setting')
hub = hub.replace('مظهر أندرويد', 'مظهر iPhone أو iPad')
hub = hub.replace('Android gives it', 'iPhone or iPad provides')
HUB.write_text(hub, encoding='utf-8')

# -----------------------------------------------------------------------------
# Home: nearest mosque card at the bottom, animated car, Maps/Copy menu, and real
# iOS widget context sync. v1.0.38 already provides pull-to-refresh/daily cards.
# -----------------------------------------------------------------------------
app = APP.read_text(encoding='utf-8')
app = app.replace('import { useCallback, useEffect, useMemo, useState } from "react";', 'import { useCallback, useEffect, useMemo, useRef, useState } from "react";', 1) if 'useCallback' in app else app.replace('import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";', 1)
if '  Animated,\n' not in app: app = app.replace('  Alert,\n', '  Alert,\n  Animated,\n', 1)
if '  Linking,\n' not in app: app = app.replace('  Image,\n', '  Image,\n  Linking,\n', 1)
if 'import * as Clipboard from "expo-clipboard";' not in app: app = app.replace('import { StatusBar } from "expo-status-bar";\n', 'import { StatusBar } from "expo-status-bar";\nimport * as Clipboard from "expo-clipboard";\n', 1)
imports_anchor = 'import { PRAYER_KEYS, type PrayerKey, type PrayerTimes } from "./src/types";\n'
extra = 'import { findNearbyMosques, type MosqueRow } from "./src/NearbyMosquesPage";\nimport { loadShowNearestMosqueOnHome, subscribeShowNearestMosqueOnHome } from "./src/nearestMosquePreference";\n'
if 'subscribeShowNearestMosqueOnHome' not in app:
    if imports_anchor not in app: raise SystemExit('App imports anchor missing')
    app = app.replace(imports_anchor, imports_anchor + extra, 1)
state_anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
if state_anchor not in app: raise SystemExit('App state anchor missing')
if 'nearestMosqueEnabled' not in app:
    app = app.replace(state_anchor, state_anchor + '''
  const [nearestMosqueEnabled, setNearestMosqueEnabled] = useState(false);
  const [nearestMosque, setNearestMosque] = useState<MosqueRow | null>(null);
  const [nearestMosqueState, setNearestMosqueState] = useState<"idle"|"loading"|"empty"|"error">("idle");
  const nearestMosqueCarX = useRef(new Animated.Value(0)).current;''', 1)
# widget gets current location/timezone context
app = app.replace('HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);', 'HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale, { timeZone: activeTimeZone, locationLabel: activeLocationLabel });')
app = app.replace('  }, [prayerTimes, locale]);', '  }, [prayerTimes, locale, activeTimeZone, activeLocationLabel]);', 1)
# effects before toggleLocale
anchor = '  const toggleLocale = async () => {'
if anchor not in app: raise SystemExit('App toggleLocale anchor missing')
if 'HASSOUN_IOS_NEAREST_MOSQUE_V1044' not in app:
    effects = '''  // HASSOUN_IOS_NEAREST_MOSQUE_V1044
  useEffect(() => { let alive=true; void loadShowNearestMosqueOnHome().then(v=>{if(alive)setNearestMosqueEnabled(v)}); const unsubscribe=subscribeShowNearestMosqueOnHome(setNearestMosqueEnabled); return()=>{alive=false;unsubscribe();}; }, []);
  useEffect(() => { if(!nearestMosqueEnabled){nearestMosqueCarX.setValue(0);return;} const drive=Animated.loop(Animated.sequence([Animated.timing(nearestMosqueCarX,{toValue:9,duration:850,useNativeDriver:true}),Animated.timing(nearestMosqueCarX,{toValue:0,duration:850,useNativeDriver:true})])); drive.start(); return()=>drive.stop(); }, [nearestMosqueEnabled, nearestMosqueCarX]);
  useEffect(() => { let alive=true; if(!nearestMosqueEnabled){setNearestMosque(null);setNearestMosqueState("idle");return()=>{alive=false};} setNearestMosqueState("loading"); void Promise.race([findNearbyMosques(prayerLocation.latitude,prayerLocation.longitude),new Promise<MosqueRow[]>((_,reject)=>setTimeout(()=>reject(new Error("TIMEOUT")),14000))]).then(rows=>{if(!alive)return;setNearestMosque(rows[0]||null);setNearestMosqueState(rows.length?"idle":"empty");}).catch(()=>{if(!alive)return;setNearestMosque(null);setNearestMosqueState("error");}); return()=>{alive=false}; }, [nearestMosqueEnabled, prayerLocation.latitude, prayerLocation.longitude]);

  const mosqueDistanceLabel = (km:number) => km < 1 ? `${Math.max(50, Math.round(km*1000/50)*50)} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  const openNearestMosqueActions = () => { if(!nearestMosque)return; const d=mosqueDistanceLabel(nearestMosque.distanceKm); const copy=`${nearestMosque.name}\n${nearestMosque.displayName}\n${d}`; const maps=`https://maps.apple.com/?q=${encodeURIComponent(nearestMosque.name)}&ll=${nearestMosque.latitude},${nearestMosque.longitude}`; Alert.alert(nearestMosque.name,d,[{text:locale==="ar"?"فتح في الخرائط":"Open with Maps",onPress:()=>{void Linking.openURL(maps)}},{text:locale==="ar"?"نسخ":"Copy",onPress:()=>{void Clipboard.setStringAsync(copy)}},{text:locale==="ar"?"إلغاء":"Cancel",style:"cancel"}]); };

'''
    app = app.replace(anchor, effects + anchor, 1)
footer = '      <Text style={styles.footer}>{prayerLocation.source === "windsor_islamic_association" ? "Official Windsor Islamic Association schedule" : "Local prayer times by current device location"} • {activeTimeZone}</Text>'
if footer not in app: raise SystemExit('Home footer anchor missing')
if 'styles.nearestMosqueCard' not in app:
    card = '''      {nearestMosqueEnabled ? <View style={styles.nearestMosqueCard}><Animated.View style={[styles.nearestMosqueCar,{transform:[{translateX:nearestMosqueCarX}]}]}><Text style={styles.nearestMosqueCarEmoji}>🚗</Text></Animated.View><View style={styles.nearestMosqueCopy}><Text style={styles.nearestMosqueEyebrow}>{locale==="ar"?"أقرب مسجد":"NEAREST MOSQUE"}</Text><Text numberOfLines={1} style={styles.nearestMosqueName}>{nearestMosque?nearestMosque.name:nearestMosqueState==="loading"?(locale==="ar"?"جارٍ البحث عن أقرب مسجد…":"Finding the nearest mosque…"):nearestMosqueState==="error"?(locale==="ar"?"دليل المساجد غير متاح مؤقتاً":"Mosque directory temporarily unavailable"):(locale==="ar"?"لم يتم العثور على مسجد قريب":"No nearby mosque found")}</Text><Text style={styles.nearestMosqueDistance}>{nearestMosque?`🚗 ${mosqueDistanceLabel(nearestMosque.distanceKm)}`:(locale==="ar"?"يُحدّث من موقع GPS":"Updates from your GPS location")}</Text></View><Pressable disabled={!nearestMosque} onPress={openNearestMosqueActions} style={[styles.mosqueActionButton,!nearestMosque&&styles.mosqueActionButtonDisabled]}><Text style={styles.mosqueActionText}>⧉</Text></Pressable></View> : null}

'''
    app = app.replace(footer, card + footer, 1)
style_anchor = 'const styles = StyleSheet.create({'
if style_anchor not in app: raise SystemExit('App styles anchor missing')
if 'nearestMosqueCard:' not in app:
    app = app.replace(style_anchor, style_anchor + '''
  nearestMosqueCard:{flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#fff",borderRadius:18,borderWidth:1,borderColor:"#d8e2dc",padding:14},
  nearestMosqueCar:{width:46,height:46,borderRadius:15,backgroundColor:"#edf6f2",alignItems:"center",justifyContent:"center"},nearestMosqueCarEmoji:{fontSize:23},nearestMosqueCopy:{flex:1,minWidth:0},nearestMosqueEyebrow:{color:"#8d7631",fontSize:10.5,fontWeight:"900",letterSpacing:.8},nearestMosqueName:{color:"#075f4a",fontSize:16,fontWeight:"900",marginTop:2},nearestMosqueDistance:{color:"#6c7772",fontSize:11.5,marginTop:2},mosqueActionButton:{width:42,height:42,borderRadius:13,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#d8e2dc",backgroundColor:"#f7faf8"},mosqueActionButtonDisabled:{opacity:.35},mosqueActionText:{color:"#075f4a",fontSize:23,fontWeight:"900"},
''', 1)
# iOS copy cleanup
app = app.replace('Native Android reader','Native Qur’an reader').replace('قارئ أندرويد أصلي','قارئ قرآن أصلي')
APP.write_text(app, encoding='utf-8')

# -----------------------------------------------------------------------------
# Native iOS WidgetKit via Expo Widgets (SDK 57). One kind supports Home Screen
# small/medium and Lock Screen circular/rectangular/inline families.
# -----------------------------------------------------------------------------
config = CONFIG.read_text(encoding='utf-8')
widget_plugin = '''    [
      "expo-widgets",
      {
        bundleIdentifier: "ca.wopt.windsorprayertimes.widgets",
        groupIdentifier: "group.ca.wopt.windsorprayertimes",
        widgets: [
          {
            name: "HassounPrayerWidget",
            displayName: "Hassoun Prayer Times",
            description: "Next prayer, today's prayer times and your current prayer location.",
            ios: { supportedFamilies: ["systemSmall", "systemMedium", "accessoryCircular", "accessoryRectangular", "accessoryInline"] }
          }
        ]
      }
    ],
'''
if '"expo-widgets"' not in config:
    anchor = '  plugins: [\n'
    if anchor not in config: raise SystemExit('app.config plugins anchor missing')
    config = config.replace(anchor, anchor + widget_plugin, 1)
CONFIG.write_text(config, encoding='utf-8')

# Final parity invariants.
checks = {
    PRAYER:['officialWindsorAvailable','const position = await getPosition(force)','shouldUseOfficialWindsor = isNearWindsor(latitude, longitude) && officialWindsorAvailable'],
    MOSQUES:['Mosques Near Me','WINDSOR_TRUSTED_MOSQUES','Show nearest mosque on Home','Prayer times always use your phone GPS','Open'],
    CALC:['Automatic by GPS','Choosing a mosque never changes prayer times','Mosques Near Me','hassoun:prayer-calc-child-route:v1'],
    APP:['HASSOUN_IOS_NEAREST_MOSQUE_V1044','Open with Maps','Clipboard.setStringAsync','nearestMosqueCarX','locationLabel: activeLocationLabel'],
    HUB:['hassoun:settings-nested-route:v1'],
    CONFIG:['expo-widgets','HassounPrayerWidget','accessoryRectangular']
}
for path,needles in checks.items():
    text=path.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text: raise SystemExit(f'Missing iOS v1.0.44 parity marker {needle!r} in {path}')
print('HASSOUN_IOS_V1044_FULL_PARITY_WIDGET_APPLIED')
