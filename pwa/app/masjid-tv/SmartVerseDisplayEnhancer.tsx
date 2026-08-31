"use client";

import { useEffect } from "react";

const SETTINGS_KEY="hassoun:web-masjid-tv:v2";
const DAILY=[
  "Indeed, in the remembrance of Allah do hearts find rest. — Qur’an 13:28",
  "Indeed, Allah is with the patient. — Qur’an 2:153",
  "So surely with hardship comes ease. — Qur’an 94:5",
  "Whoever relies upon Allah — then He is sufficient for him. — Qur’an 65:3",
  "Allah does not burden a soul beyond that it can bear. — Qur’an 2:286",
  "And whatever you spend of good — it will be fully repaid to you. — Qur’an 2:272",
  "And speak to people good words. — Qur’an 2:83",
  "Indeed, prayer prohibits immorality and wrongdoing. — Qur’an 29:45",
  "My mercy encompasses all things. — Qur’an 7:156",
  "And whoever is grateful — his gratitude is only for the benefit of himself. — Qur’an 31:12"
];

function read(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}") as Record<string,unknown>}catch{return {}}}
function dayIndex(){const d=new Date();const start=new Date(d.getFullYear(),0,0);return Math.floor((d.getTime()-start.getTime())/86400000)%DAILY.length}

export default function SmartVerseDisplayEnhancer(){
  useEffect(()=>{
    const apply=()=>{
      const s=read();if(s.verseMode!=="daily")return;
      const verse=DAILY[dayIndex()];
      document.querySelectorAll<HTMLElement>(".header-verse,.tv-verse").forEach(el=>{if(el.textContent!==verse)el.textContent=verse});
    };
    apply();const timer=window.setInterval(apply,15000);window.addEventListener("storage",apply);
    return()=>{window.clearInterval(timer);window.removeEventListener("storage",apply)};
  },[]);
  return null;
}
