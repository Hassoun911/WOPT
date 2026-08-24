"use client";

import { useMemo, useState } from "react";
import "./sheikh.css";

type Translation = { text?: string };
type QuranResult = { verse_key?: string; text?: string; highlighted?: string; translations?: Translation[] };

type HadithRef = {
  keywords: string[];
  title: string;
  collection: string;
  reference: string;
  summary: string;
  url: string;
};

const HADITH: HadithRef[] = [
  { keywords:["intention","intentions","niyyah","نية"], title:"Actions are judged by intentions", collection:"Sahih al-Bukhari", reference:"1", summary:"The Prophet ﷺ taught that actions are judged according to intentions.", url:"https://sunnah.com/bukhari:1" },
  { keywords:["prayer","salah","salat","صلاة"], title:"The prayer was prescribed at fixed times", collection:"Sahih Muslim", reference:"612", summary:"Authentic narrations explain the established times of the five daily prayers.", url:"https://sunnah.com/muslim:612" },
  { keywords:["fast","fasting","ramadan","صيام","رمضان"], title:"Fasting Ramadan with faith", collection:"Sahih al-Bukhari", reference:"38", summary:"Whoever fasts Ramadan with faith and seeking reward is promised forgiveness for previous sins.", url:"https://sunnah.com/bukhari:38" },
  { keywords:["charity","sadaqah","zakat","صدقة","زكاة"], title:"Charity does not decrease wealth", collection:"Sahih Muslim", reference:"2588", summary:"The Prophet ﷺ taught that charity does not diminish wealth in the sight of Allah.", url:"https://sunnah.com/muslim:2588" },
  { keywords:["parents","mother","father","والدين","ام","أم","اب"], title:"Your mother, then your mother", collection:"Sahih al-Bukhari", reference:"5971", summary:"Good companionship and kindness to parents—especially the mother—are strongly emphasized.", url:"https://sunnah.com/bukhari:5971" },
  { keywords:["anger","angry","غضب"], title:"Do not become angry", collection:"Sahih al-Bukhari", reference:"6116", summary:"The Prophet ﷺ repeatedly advised a man: do not become angry.", url:"https://sunnah.com/bukhari:6116" },
  { keywords:["marriage","wife","husband","زوج","زواج"], title:"The best of you are best to their families", collection:"Jami` at-Tirmidhi", reference:"3895", summary:"Good character toward one’s family is a central measure of conduct.", url:"https://sunnah.com/tirmidhi:3895" },
  { keywords:["knowledge","learn","quran","قرآن","علم"], title:"The best learn and teach the Qur’an", collection:"Sahih al-Bukhari", reference:"5027", summary:"The Prophet ﷺ praised those who learn the Qur’an and teach it.", url:"https://sunnah.com/bukhari:5027" },
  { keywords:["mercy","forgive","forgiveness","رحمة","مغفرة"], title:"Allah is more merciful to His servants", collection:"Sahih al-Bukhari", reference:"5999", summary:"Authentic hadith emphasize the vastness of Allah’s mercy toward His servants.", url:"https://sunnah.com/bukhari:5999" },
  { keywords:["neighbor","neighbour","جار"], title:"Be good to your neighbour", collection:"Sahih al-Bukhari", reference:"6014", summary:"Jibril continued advising the Prophet ﷺ regarding neighbours until he thought they might receive inheritance rights.", url:"https://sunnah.com/bukhari:6014" },
];

const QUICK = [
  "What does Islam say about patience?",
  "What does Islam say about treating parents?",
  "What does Islam say about anger?",
  "What does Islam say about charity?",
  "What does Islam say about marriage and family?",
];

function stripHtml(value="") { return value.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim(); }

export default function AskSheikhPage(){
  const [question,setQuestion]=useState("");
  const [submitted,setSubmitted]=useState("");
  const [results,setResults]=useState<QuranResult[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const hadithMatches=useMemo(()=>{
    const q=submitted.toLowerCase();
    if(!q) return [];
    const matches=HADITH.filter(item=>item.keywords.some(keyword=>q.includes(keyword.toLowerCase())));
    return matches.slice(0,4);
  },[submitted]);

  async function ask(value?:string){
    const q=(value ?? question).trim();
    if(!q) return;
    setQuestion(q); setSubmitted(q); setLoading(true); setError(""); setResults([]);
    try{
      const response=await fetch(`https://api.quran.com/api/v4/search?q=${encodeURIComponent(q)}&size=8&page=1&language=en`);
      if(!response.ok) throw new Error("search");
      const data=await response.json();
      const list=(data.search?.results || data.results || []) as QuranResult[];
      setResults(list.slice(0,6));
      if(!list.length) setError("No direct Qur’an text match was found for that wording. Try a shorter topic such as patience, parents, charity, prayer, or forgiveness.");
    }catch{
      setError("The Qur’an reference service could not be reached right now. You can still use the Sunnah references below or try again shortly.");
    }finally{ setLoading(false); }
  }

  return <main className="sheikh-page">
    <section className="sheikh-hero">
      <div><div className="eyebrow">ISLAMIC REFERENCE ASSISTANT</div><h1>Ask the Sheikh</h1><p>Ask a question in normal language and review relevant Qur’an and Sunnah references without leaving Hassoun.</p></div>
      <div className="sheikh-mark">🕌</div>
    </section>

    <section className="sheikh-search-card">
      <label htmlFor="sheikh-question">What would you like to ask?</label>
      <div className="sheikh-search-row"><textarea id="sheikh-question" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Example: What does Islam say about being patient when life is difficult?" rows={3} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter") void ask();}}/><button type="button" onClick={()=>void ask()} disabled={loading}>{loading?"Searching…":"Ask"}</button></div>
      <div className="sheikh-quick">{QUICK.map(item=><button type="button" key={item} onClick={()=>void ask(item)}>{item}</button>)}</div>
    </section>

    {submitted ? <section className="sheikh-answer">
      <div className="sheikh-answer-head"><div><span>QUESTION</span><h2>{submitted}</h2></div><a href={`https://sunnah.com/search?q=${encodeURIComponent(submitted)}`} target="_blank" rel="noreferrer">Search Sunnah.com ↗</a></div>
      <div className="sheikh-note"><strong>Reference-first guidance</strong><span>Hassoun shows source material to help you research. For personal rulings, complex fiqh, divorce, inheritance, medical matters, or binding religious decisions, consult a qualified local scholar.</span></div>
      {error ? <p className="sheikh-error">{error}</p> : null}

      <div className="sheikh-section-title"><span>۞</span><div><strong>Qur’an references</strong><small>{loading?"Searching Qur’an…":`${results.length} relevant result${results.length===1?"":"s"}`}</small></div></div>
      <div className="sheikh-results">{results.map((item,index)=>{
        const key=item.verse_key || "";
        const translation=stripHtml(item.translations?.[0]?.text || "");
        const arabic=stripHtml(item.text || item.highlighted || "");
        return <article className="sheikh-reference" key={`${key}-${index}`}><div className="sheikh-ref-top"><strong>{key?`Qur’an ${key}`:"Qur’an reference"}</strong>{key?<a href={`https://quran.com/${key}`} target="_blank" rel="noreferrer">Open in Qur’an ↗</a>:null}</div>{arabic?<p className="sheikh-arabic" dir="rtl" lang="ar">{arabic}</p>:null}{translation?<p className="sheikh-translation">{translation}</p>:null}</article>;
      })}</div>

      <div className="sheikh-section-title"><span>◌</span><div><strong>Sunnah references</strong><small>{hadithMatches.length?"Matched to your topic":"Search the hadith collections directly"}</small></div></div>
      <div className="sheikh-results">{hadithMatches.length ? hadithMatches.map(item=><article className="sheikh-reference hadith" key={item.url}><div className="sheikh-ref-top"><strong>{item.collection} {item.reference}</strong><a href={item.url} target="_blank" rel="noreferrer">Open source ↗</a></div><h3>{item.title}</h3><p className="sheikh-translation">{item.summary}</p></article>) : <article className="sheikh-reference hadith"><div className="sheikh-ref-top"><strong>Sunnah.com</strong><a href={`https://sunnah.com/search?q=${encodeURIComponent(submitted)}`} target="_blank" rel="noreferrer">Search this topic ↗</a></div><p className="sheikh-translation">No curated hadith topic matched that exact wording yet. Open the search to review results across the major hadith collections.</p></article>}</div>
    </section> : <section className="sheikh-welcome"><div>۞</div><h2>Ask naturally</h2><p>You can ask about worship, family, character, patience, charity, Qur’an topics, Ramadan, prayer, and everyday Islamic questions.</p></section>}
  </main>;
}
