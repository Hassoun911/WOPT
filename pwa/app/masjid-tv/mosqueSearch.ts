export type MosqueSearchInput={
  text?:string;
  city?:string;
  province?:string;
  postalCode?:string;
  country?:string;
};

export type MosqueResult={
  id:string;
  name:string;
  displayName:string;
  lat:string;
  lon:string;
  city:string;
  province:string;
  postalCode:string;
  country:string;
};

const NOMINATIM="https://nominatim.openstreetmap.org/search";

function clean(v:any){return String(v??"").trim()}
function norm(v:any){return clean(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function compactPostal(v:any){return clean(v).toUpperCase().replace(/\s+/g,"")}
function key(row:any){return String(row?.place_id||`${row?.lat||""}:${row?.lon||""}:${row?.display_name||""}`)}
function first(...values:any[]){for(const value of values){const v=clean(value);if(v)return v}return""}
function normalize(row:any):MosqueResult{
  const a=row?.address||{};
  const displayName=clean(row?.display_name);
  return{
    id:key(row),
    name:first(row?.name,row?.namedetails?.name,displayName.split(",")[0],"Mosque"),
    displayName,
    lat:clean(row?.lat),
    lon:clean(row?.lon),
    city:first(a.city,a.town,a.municipality,a.village,a.hamlet),
    province:first(a.state,a.province,a.region),
    postalCode:first(a.postcode),
    country:first(a.country,"Canada"),
  };
}

async function nominatim(q:string,country:string){
  const params=new URLSearchParams({format:"jsonv2",addressdetails:"1",namedetails:"1",limit:"20",q});
  if(country.toLowerCase().includes("canada"))params.set("countrycodes","ca");
  const r=await fetch(`${NOMINATIM}?${params.toString()}`,{headers:{"Accept-Language":"en"},cache:"no-store"});
  if(!r.ok)throw new Error("Mosque directory unavailable");
  return await r.json() as any[];
}

function cityMatches(row:MosqueResult,city:string){
  if(!city)return true;
  const wanted=norm(city),actual=norm(row.city),display=norm(row.displayName);
  return (!!actual&&actual===wanted)||display.split(" ").includes(wanted)||display.includes(` ${wanted} `)||display.startsWith(`${wanted} `)||display.endsWith(` ${wanted}`);
}
function provinceMatches(row:MosqueResult,province:string){
  if(!province)return true;
  const wanted=norm(province),actual=norm(row.province),display=norm(row.displayName);
  return (!!actual&&actual===wanted)||display.includes(wanted);
}
function countryMatches(row:MosqueResult,country:string){
  if(!country)return true;
  const wanted=norm(country),actual=norm(row.country),display=norm(row.displayName);
  return (!!actual&&actual===wanted)||display.includes(wanted);
}
function score(row:MosqueResult,input:{text:string;city:string;province:string;postal:string}){
  let n=0;const text=norm(input.text),name=norm(row.name),display=norm(row.displayName);
  if(text){if(name===text)n+=100;else if(name.startsWith(text))n+=75;else if(name.includes(text))n+=55;else if(display.includes(text))n+=35;}
  if(input.city&&cityMatches(row,input.city))n+=60;
  if(input.province&&provinceMatches(row,input.province))n+=25;
  const targetPostal=compactPostal(input.postal),rowPostal=compactPostal(row.postalCode);
  if(targetPostal&&rowPostal){if(rowPostal===targetPostal)n+=50;else if(rowPostal.slice(0,3)===targetPostal.slice(0,3))n+=20;}
  return n;
}

export async function searchMosques(input:MosqueSearchInput):Promise<MosqueResult[]>{
  const text=clean(input.text),city=clean(input.city),province=clean(input.province),postal=clean(input.postalCode),country=clean(input.country)||"Canada";
  const where=[city,province,postal,country].filter(Boolean).join(" ");
  const terms:string[]=[];
  if(text){
    terms.push([text,where].filter(Boolean).join(" "));
    terms.push([text,"mosque",where].filter(Boolean).join(" "));
    terms.push([text,"masjid",where].filter(Boolean).join(" "));
  }
  terms.push(["mosque",where].filter(Boolean).join(" "));
  terms.push(["masjid",where].filter(Boolean).join(" "));
  terms.push(["Islamic centre",where].filter(Boolean).join(" "));
  terms.push(["Islamic center",where].filter(Boolean).join(" "));
  const uniqueTerms=[...new Set(terms.map(x=>x.trim()).filter(x=>x.length>2))].slice(0,text?6:4);
  const settled=await Promise.allSettled(uniqueTerms.map(q=>nominatim(q,country)));
  const map=new Map<string,MosqueResult>();
  for(const result of settled){
    if(result.status!=="fulfilled")continue;
    for(const row of result.value){
      const normalized=normalize(row);
      const hay=`${normalized.name} ${normalized.displayName}`.toLowerCase();
      const looksIslamic=/mosque|masjid|islamic|muslim|جامع|مسجد/i.test(hay);
      if(!looksIslamic&&text&&!hay.includes(text.toLowerCase()))continue;
      if(!countryMatches(normalized,country))continue;
      // If an admin selected a city, that city is authoritative: never mix in distant cities.
      if(city&&!cityMatches(normalized,city))continue;
      // Province is also a hard boundary when supplied.
      if(province&&!provinceMatches(normalized,province))continue;
      if(!map.has(normalized.id))map.set(normalized.id,normalized);
    }
  }
  return [...map.values()]
    .sort((a,b)=>score(b,{text,city,province,postal})-score(a,{text,city,province,postal}))
    .slice(0,40);
}

export async function geocodeCanadaLocation(input:{city?:string;province?:string;postalCode?:string;country?:string}){
  const country=clean(input.country)||"Canada";
  const q=[clean(input.postalCode),clean(input.city),clean(input.province),country].filter(Boolean).join(" ");
  if(!q)return null;
  const rows=await nominatim(q,country);
  if(!rows.length)return null;
  const wantedCity=clean(input.city),wantedProvince=clean(input.province);
  const normalized=rows.map(normalize).filter(r=>cityMatches(r,wantedCity)&&provinceMatches(r,wantedProvince));
  return normalized[0]||normalize(rows[0]);
}

export const CANADA_PROVINCES=[
  "Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Nova Scotia","Ontario","Prince Edward Island","Quebec","Saskatchewan","Northwest Territories","Nunavut","Yukon"
];
