"use client";

import { useEffect } from "react";

const STORAGE = "hassoun:web-masjid-tv:v2";
const PANEL = "data-hassoun-next-prayer-customizer";
const COLORS = ["#0b6b55", "#08795e", "#0a5b4a", "#146b63", "#255f48", "#4a6c46"];
const PRAYERS = [
  { en: "fajr", ar: "الفجر" },
  { en: "dhuhr", ar: "الظهر" },
  { en: "asr", ar: "العصر" },
  { en: "maghrib", ar: "المغرب" },
  { en: "isha", ar: "العشاء" },
];

function read() {
  try { return JSON.parse(localStorage.getItem(STORAGE) || "{}") as Record<string, any>; }
  catch { return {} as Record<string, any>; }
}
function write(patch: Record<string, any>) {
  const next = { ...read(), ...patch };
  localStorage.setItem(STORAGE, JSON.stringify(next));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE, newValue: JSON.stringify(next) }));
}
function nextPrayer() {
  const source = `${document.querySelector<HTMLElement>(".sg-next-row")?.textContent || ""} ${document.querySelector<HTMLElement>(".sg-next-name")?.textContent || ""}`.toLowerCase();
  return PRAYERS.find(p => source.includes(p.en) || source.includes(p.ar)) || null;
}
function apply() {
  const s = read();
  const enabled = s.highlightNextPrayerCard !== false;
  const miniEnabled = s.highlightNextPrayerMiniCard !== false;
  const bg = String(s.nextPrayerCardColor || "#0b6b55");
  const mini = String(s.nextPrayerMiniCardColor || bg);
  const border = String(s.nextPrayerCardBorderColor || "#e3bd5f");
  document.documentElement.style.setProperty("--hassoun-next-bg", bg);
  document.documentElement.style.setProperty("--hassoun-next-mini-bg", mini);
  document.documentElement.style.setProperty("--hassoun-next-border", border);
  document.querySelectorAll<HTMLElement>(".hassoun-next-big,.hassoun-next-mini").forEach(el => el.classList.remove("hassoun-next-big", "hassoun-next-mini"));
  if (!enabled) return;
  document.querySelectorAll<HTMLElement>(".sg-next").forEach(el => el.classList.add("hassoun-next-big"));
  if (miniEnabled) document.querySelectorAll<HTMLElement>(".sg-next-row").forEach(el => el.classList.add("hassoun-next-mini"));
  const next = nextPrayer();
  if (!next) return;
  document.querySelectorAll<HTMLElement>(".sg-slide,.prayer-slide,.prayer-hero,.big-prayer-card,.prayer-card,[data-prayer],[data-prayer-card]").forEach(el => {
    const text = (el.textContent || "").toLowerCase();
    if (text.includes(next.en) || text.includes(next.ar)) el.classList.add("hassoun-next-big");
  });
}

export default function NextPrayerCardCustomizerEnhancer() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.hassounNextPrayerStyle = "1";
    style.textContent = `
      .hassoun-next-big{background:var(--hassoun-next-bg,#0b6b55)!important;border-color:var(--hassoun-next-border,#e3bd5f)!important;box-shadow:0 14px 34px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.12)!important}
      .hassoun-next-mini{background:var(--hassoun-next-mini-bg,#0b6b55)!important;border-color:var(--hassoun-next-border,#e3bd5f)!important}
      [${PANEL}="1"]{margin:18px 0;padding:18px;border:1px solid rgba(126,214,190,.3);border-radius:16px;background:#0b302a;color:white}
      [${PANEL}="1"] h3{margin:0 0 5px;font-size:20px}[${PANEL}="1"] p{margin:0 0 14px;color:#bed0c9;line-height:1.4}
      .hnp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.hnp-swatch{width:42px;height:42px;border-radius:11px;border:2px solid rgba(255,255,255,.32);cursor:pointer}.hnp-swatch.active{outline:3px solid #f0c96e;outline-offset:2px}.hnp-color{width:54px;height:42px;border:0;background:transparent}.hnp-toggle{display:flex;gap:8px;align-items:center;margin-top:13px;font-weight:800}.hnp-reset{margin-left:auto;border:1px solid #758f87;background:#153e36;color:#fff;border-radius:999px;padding:9px 13px;font-weight:800;cursor:pointer}
    `;
    document.head.appendChild(style);

    const enhance = () => {
      apply();
      const admin = document.querySelector<HTMLElement>(".webtv-admin");
      if (!admin || admin.querySelector(`[${PANEL}="1"]`)) return;
      const s = read();
      const card = document.createElement("section");
      card.setAttribute(PANEL, "1");
      card.innerHTML = `<h3>Next Prayer Card</h3><p>The mini prayer strip always stays visible. The large prayer cards can rotate like a gallery; whichever prayer is next gets this special background.</p><div class="hnp-row"><strong>Next prayer color</strong>${COLORS.map(c => `<button type="button" class="hnp-swatch ${String(s.nextPrayerCardColor || "#0b6b55").toLowerCase()===c ? "active" : ""}" data-color="${c}" style="background:${c}" aria-label="Use ${c}"></button>`).join("")}<input class="hnp-color" type="color" value="${String(s.nextPrayerCardColor || "#0b6b55")}"><button type="button" class="hnp-reset">Reset</button></div><label class="hnp-toggle"><input type="checkbox" class="hnp-enabled" ${s.highlightNextPrayerCard===false ? "" : "checked"}> Highlight the next prayer card</label><label class="hnp-toggle"><input type="checkbox" class="hnp-mini" ${s.highlightNextPrayerMiniCard===false ? "" : "checked"}> Highlight the matching mini card below</label>`;
      const target = admin.querySelector(".hassoun-display-pairing") || admin.firstElementChild;
      target?.insertAdjacentElement("afterend", card);
      const setColor = (value:string) => { write({ nextPrayerCardColor:value, nextPrayerMiniCardColor:value }); card.querySelectorAll(".hnp-swatch").forEach(x => x.classList.toggle("active", (x as HTMLElement).dataset.color===value)); apply(); };
      card.querySelectorAll<HTMLButtonElement>(".hnp-swatch").forEach(btn => btn.addEventListener("click", () => setColor(btn.dataset.color || "#0b6b55")));
      card.querySelector<HTMLInputElement>(".hnp-color")?.addEventListener("input", e => setColor((e.currentTarget as HTMLInputElement).value));
      card.querySelector<HTMLInputElement>(".hnp-enabled")?.addEventListener("change", e => { write({ highlightNextPrayerCard:(e.currentTarget as HTMLInputElement).checked }); apply(); });
      card.querySelector<HTMLInputElement>(".hnp-mini")?.addEventListener("change", e => { write({ highlightNextPrayerMiniCard:(e.currentTarget as HTMLInputElement).checked }); apply(); });
      card.querySelector<HTMLButtonElement>(".hnp-reset")?.addEventListener("click", () => { write({ highlightNextPrayerCard:true, highlightNextPrayerMiniCard:true, nextPrayerCardColor:"#0b6b55", nextPrayerMiniCardColor:"#0b6b55", nextPrayerCardBorderColor:"#e3bd5f" }); setColor("#0b6b55"); });
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    const timer = window.setInterval(apply, 1000);
    window.addEventListener("storage", apply);
    return () => { observer.disconnect(); window.clearInterval(timer); window.removeEventListener("storage", apply); style.remove(); };
  }, []);
  return null;
}
