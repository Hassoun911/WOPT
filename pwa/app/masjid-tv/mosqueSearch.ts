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
      if(!map.has(normalized.id))map.set(normalized.id,normalized);
    }
  }
  return [...map.values()].slice(0,40);
}

export async function geocodeCanadaLocation(input:{city?:string;province?:string;postalCode?:string;country?:string}){
  const country=clean(input.country)||"Canada";
  const q=[clean(input.postalCode),clean(input.city),clean(input.province),country].filter(Boolean).join(" ");
  if(!q)return null;
  const rows=await nominatim(q,country);
  if(!rows.length)return null;
  return normalize(rows[0]);
}

export const CANADA_PROVINCES=[
  "Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Nova Scotia","Ontario","Prince Edward Island","Quebec","Saskatchewan","Northwest Territories","Nunavut","Yukon"
];
