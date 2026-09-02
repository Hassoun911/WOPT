"use client";

import { useEffect } from "react";

const STORAGE = "hassoun:web-masjid-tv:v2";
const field = "width:100%;padding:9px 10px;border-radius:9px;border:1px solid #c9d1cc;background:#fff;color:#17362e;font-size:14px";

function readSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE) || "{}") as Record<string, any>; }
  catch { return {}; }
}
function writeSettings(next: Record<string, any>) {
  localStorage.setItem(STORAGE, JSON.stringify(next));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE, newValue: JSON.stringify(next) }));
}

export default function DirectTvAdvancedSettingsEnhancer() {
  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, "");
    if (path !== "/masjid-tv") return;

    const enhance = () => {
      const admin = document.querySelector<HTMLElement>(".webtv-admin");
      if (!admin || admin.querySelector('[data-direct-advanced="1"]')) return;
      let settings = readSettings();

      const box = document.createElement("details");
      box.dataset.directAdvanced = "1";
      box.open = true;
      box.style.cssText = "margin:14px 0 18px;padding:14px;border:1px solid #c7ad68;border-radius:16px;background:#fffdf6;color:#17362e";
      box.innerHTML = `<summary style="cursor:pointer;font-size:18px;font-weight:900;color:#0b5b47">Advanced Masjid controls</summary>
      <div style="display:grid;gap:16px;margin-top:14px">
        <section style="display:grid;gap:8px"><strong>Prayer location & source</strong>
          <label>Source mode<select data-k="prayerSourceMode" style="${field}"><option value="auto">Automatic — best source</option><option value="official">Prefer official mosque timetable</option><option value="calculated">Calculated by city / coordinates</option><option value="manual">Manual only</option></select></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>City<input data-k="prayerCity" style="${field}" placeholder="Windsor"></label><label>Country<input data-k="prayerCountry" style="${field}" placeholder="Canada"></label></div>
          <label>Search mosque<input data-mosque-search style="${field}" placeholder="Al Hijra Mosque"></label><button data-find-mosque type="button" style="justify-self:start;padding:9px 13px;border-radius:999px;border:1px solid #0b5b47;background:#0b5b47;color:#fff;font-weight:900">Find mosques</button><div data-mosque-results style="display:grid;gap:7px"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Latitude<input data-k="prayerLatitude" style="${field}"></label><label>Longitude<input data-k="prayerLongitude" style="${field}"></label></div>
          <label>Calculation method<select data-n="calculationMethod" style="${field}"><option value="2">ISNA</option><option value="3">Muslim World League</option><option value="4">Umm Al-Qura</option><option value="5">Egyptian Authority</option></select></label>
          <small data-source-label style="color:#5e756d"></small>
        </section>
        <section style="display:grid;gap:8px;border-top:1px solid #d9dedb;padding-top:12px"><strong>Smart Grand display</strong>
          <label>Center panel<select data-k="centerPanelMode" style="${field}"><option value="announcements">Announcements</option><option value="clock">Digital clock</option><option value="mixed">Clock + announcements</option></select></label>
          <label><input data-b="showNextPrayerCountdown" type="checkbox"> Show next-prayer countdown</label>
          <label><input data-b="highlightNextPrayer" type="checkbox"> Highlight next prayer row</label>
          <label><input data-b="showArabicPrayerNames" type="checkbox"> Show Arabic prayer names</label>
          <label><input data-b="showPrayerIcons" type="checkbox"> Show prayer icons</label>
        </section>
        <section style="display:grid;gap:8px;border-top:1px solid #d9dedb;padding-top:12px"><strong>Business / community spotlight</strong>
          <label><input data-b="showBusinessCard" type="checkbox"> Show business/community card</label>
          <label>Name<input data-k="businessName" style="${field}"></label><label>Message<input data-k="businessMessage" style="${field}"></label><label>Website<input data-k="businessUrl" style="${field}"></label>
        </section>
        <section style="display:grid;gap:8px;border-top:1px solid #d9dedb;padding-top:12px"><strong>Before & during prayer</strong>
          <label><input data-b="prePrayerFocusEnabled" type="checkbox"> Enable pre-prayer focus</label>
          <label>Focus minutes before prayer<input data-n="prePrayerFocusMinutes" min="1" max="30" type="number" style="${field}"></label>
          <label><input data-b="prayerInProgressEnabled" type="checkbox"> Show prayer-in-progress screen</label>
          <label>Prayer screen duration<input data-n="prayerDurationMinutes" min="3" max="30" type="number" style="${field}"></label>
          <label>Prayer screen message<input data-k="prayerInProgressMessage" style="${field}"></label>
        </section>
        <section style="display:grid;gap:8px;border-top:1px solid #d9dedb;padding-top:12px"><strong>Announcement ticker</strong>
          <label>Ticker text<input data-k="tickerText" style="${field}"></label>
          <label>Speed (seconds)<input data-n="tickerSpeed" min="6" max="40" type="number" style="${field}"></label>
          <label>Text color<input data-k="tickerColor" type="color" style="${field};height:42px;padding:4px"></label>
          <label>Effect<select data-k="tickerEffect" style="${field}"><option value="none">None</option><option value="pulse">Pulse</option><option value="flash">Flash</option></select></label>
        </section>
        <div data-direct-status style="color:#0b7657;font-size:12px;font-weight:800"></div>
      </div>`;

      const head = admin.querySelector(".webtv-admin-head");
      head?.insertAdjacentElement("afterend", box);
      const status = box.querySelector<HTMLElement>("[data-direct-status]")!;
      const sourceLabel = box.querySelector<HTMLElement>("[data-source-label]")!;

      const hydrate = () => {
        settings = readSettings();
        box.querySelectorAll<HTMLInputElement>("input[data-b]").forEach(i => i.checked = settings[i.dataset.b!] !== false);
        box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[data-k],select[data-k]").forEach(i => {
          const k = i.dataset.k!;
          const fallback = k === "prayerSourceMode" ? "auto" : k === "prayerCountry" ? "Canada" : k === "centerPanelMode" ? "announcements" : k === "tickerColor" ? "#f3d47e" : k === "tickerEffect" ? "none" : "";
          i.value = String(settings[k] ?? fallback);
        });
        box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[data-n],select[data-n]").forEach(i => {
          const k = i.dataset.n!;
          const fallback = k === "calculationMethod" ? 2 : k === "prePrayerFocusMinutes" ? 10 : k === "prayerDurationMinutes" ? 12 : k === "tickerSpeed" ? 18 : 0;
          i.value = String(settings[k] ?? fallback);
        });
        sourceLabel.textContent = settings.prayerSourceResolved ? `Current source: ${settings.prayerSourceResolved}` : "Automatic resolver will choose the best available prayer source.";
      };
      hydrate();

      let timer: number | undefined;
      const persist = (patch: Record<string, any>) => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          settings = { ...readSettings(), ...patch };
          if (patch.prayerCity && !String(settings.mosqueLocation || "").trim()) settings.mosqueLocation = patch.prayerCity;
          writeSettings(settings);
          status.textContent = "Saved · TV updated";
          window.setTimeout(() => status.textContent = "", 1500);
        }, 180);
      };

      box.querySelectorAll<HTMLInputElement>("input[data-b]").forEach(i => i.onchange = () => persist({ [i.dataset.b!]: i.checked }));
      box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[data-k],select[data-k]").forEach(i => i.oninput = () => persist({ [i.dataset.k!]: i.value }));
      box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[data-n],select[data-n]").forEach(i => i.onchange = () => persist({ [i.dataset.n!]: Number(i.value) }));

      const search = box.querySelector<HTMLInputElement>("[data-mosque-search]")!;
      const results = box.querySelector<HTMLElement>("[data-mosque-results]")!;
      box.querySelector<HTMLButtonElement>("[data-find-mosque]")!.onclick = async () => {
        results.textContent = "Searching…";
        const city = String(readSettings().prayerCity || "");
        const country = String(readSettings().prayerCountry || "Canada");
        try {
          const query = [search.value, "mosque", city, country].filter(Boolean).join(" ");
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(query)}`, { headers: { "Accept-Language": "en" } });
          const rows = await r.json() as any[];
          results.innerHTML = "";
          if (!rows.length) { results.textContent = "No mosque results found. City-based prayer times can still be used."; return; }
          rows.forEach(row => {
            const b = document.createElement("button");
            b.type = "button";
            b.style.cssText = "text-align:left;padding:9px 10px;border-radius:10px;border:1px solid #b8c8c1;background:#f7faf8;color:#17362e;cursor:pointer";
            b.textContent = row.display_name;
            b.onclick = () => {
              const name = String(row.name || row.display_name.split(",")[0] || "Mosque");
              settings = { ...readSettings(), selectedMosqueName: name, mosqueName: name, mosqueLocation: [city, country].filter(Boolean).join(", "), prayerLatitude: String(row.lat || ""), prayerLongitude: String(row.lon || ""), prayerSourceMode: "auto" };
              writeSettings(settings);
              results.textContent = "Mosque selected. Prayer source will resolve automatically.";
              hydrate();
            };
            results.appendChild(b);
          });
        } catch { results.textContent = "Mosque search is temporarily unavailable. City-based prayer times will still work."; }
      };
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
