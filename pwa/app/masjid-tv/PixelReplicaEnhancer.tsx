"use client";

import { useEffect } from "react";

const text = (el: Element | null) => (el?.textContent || "").trim();
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] || c));

export default function PixelReplicaEnhancer() {
  useEffect(() => {
    const draw = () => {
      const shell = document.querySelector<HTMLElement>(".webtv-shell.layout-grand");
      const source = document.querySelector<HTMLElement>(".template-grand");
      if (!shell || !source) {
        document.querySelector(".pixel-replica-one")?.remove();
        return;
      }

      let root = shell.querySelector<HTMLElement>(".pixel-replica-one");
      if (!root) {
        root = document.createElement("section");
        root.className = "pixel-replica-one";
        shell.appendChild(root);
        root.addEventListener("click", (e) => {
          const target = e.target as Element;
          if (target.closest(".px-clock-hotspot")) (source.querySelector(".tv-clock") as HTMLButtonElement | null)?.click();
        });
      }

      const mosque = text(source.querySelector(".tv-brand strong")) || "YOUR MASJID NAME";
      const location = text(source.querySelector(".tv-brand small")) || "MOSQUE LOCATION NOT SET";
      const clock = text(source.querySelector(".tv-clock"));
      const dates = [...source.querySelectorAll(".tv-dates span")].map(text);
      const verse = text(source.querySelector(".header-verse"));
      const nextEn = text(source.querySelector(".next-name strong"));
      const nextTime = text(source.querySelector(".next-time b"));
      const nextIqama = text(source.querySelector(".next-time small")).replace(/^Iqama\s*/i, "") || "—";
      const rows = [...source.querySelectorAll(".tv-prayer-table .table-row")].slice(0,5).map(r => ({
        name: text(r.querySelector("strong")).replace(/[☾☀◉◒☽]/g, "").trim(),
        adhan: text(r.querySelector("b:not(.iqama)")),
        iqama: text(r.querySelector("b.iqama")) || "—"
      }));
      const anns = [...source.querySelectorAll(".tv-announcements article")].slice(0,4).map(a => ({title:text(a.querySelector("strong")), body:text(a.querySelector("p"))}));
      const website = text(source.querySelector(".tv-donation strong"));

      const rowSvg = rows.map((r,i) => {
        const y = 392 + i*58;
        const icon = ["☀","☀","☀","◒","☾"][i];
        return `<line x1="78" y1="${y+31}" x2="630" y2="${y+31}" class="line"/><text x="86" y="${y}" class="gold icon">${icon}</text><text x="138" y="${y}" class="prayer">${esc(r.name)}</text><text x="352" y="${y}" class="time">${esc(r.adhan)}</text><text x="520" y="${y}" class="iq">${esc(r.iqama)}</text>`;
      }).join("");
      const annSvg = anns.map((a,i) => {
        const y = 390 + i*88;
        const icon = ["▣","◯","▦","♡"][i];
        return `<line x1="684" y1="${y+51}" x2="1152" y2="${y+51}" class="line"/><circle cx="704" cy="${y-8}" r="25" class="iconCircle"/><text x="704" y="${y-1}" text-anchor="middle" class="gold annIcon">${icon}</text><text x="752" y="${y-13}" class="annTitle">${esc(a.title || "Announcement")}</text><text x="752" y="${y+14}" class="annBody">${esc(a.body || "")}</text>`;
      }).join("");

      root.innerHTML = `<svg class="px-reference-art" viewBox="0 0 1440 790" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#01382e"/><stop offset="0.55" stop-color="#05513f"/><stop offset="1" stop-color="#02362e"/></linearGradient>
          <pattern id="pat" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M27 1L40 14 53 27 40 40 27 53 14 40 1 27 14 14Z" fill="none" stroke="#0b6553" stroke-width="1" opacity=".22"/><circle cx="27" cy="27" r="8" fill="none" stroke="#0b6553" opacity=".16"/></pattern>
          <style>
            .serif{font-family:Georgia,'Times New Roman',serif}.sans{font-family:Arial,Helvetica,sans-serif}.gold{fill:#d8ad55}.white{fill:#f5f3ec}.muted{fill:#b8c8bf}.line{stroke:#9a8246;stroke-width:1;opacity:.45}.box{fill:#034437;fill-opacity:.72;stroke:#a58a4c;stroke-width:1.3}.iconCircle{fill:#0d5b4b;stroke:#a58a4c;stroke-width:1}.prayer{fill:#f5f3ec;font:600 25px Arial}.time{fill:#f5f3ec;font:600 23px Arial}.iq{fill:#6bc58b;font:600 23px Arial}.icon{font:28px Arial}.annIcon{font:20px Arial}.annTitle{fill:#f5f3ec;font:600 19px Arial}.annBody{fill:#c8d5cf;font:16px Arial}
          </style>
        </defs>
        <rect width="1440" height="790" fill="url(#bg)"/><rect width="1440" height="790" fill="url(#pat)"/>
        <g>
          <path d="M76 132V72c0-25 22-44 45-44s45 19 45 44v60" fill="none" stroke="#d4b16b" stroke-width="4"/><path d="M94 132V92h54v40" fill="none" stroke="#d4b16b" stroke-width="4"/><circle cx="121" cy="68" r="8" fill="#d4b16b"/><path d="M121 60v-17" stroke="#d4b16b" stroke-width="4"/>
          <text x="66" y="177" class="serif white" font-size="42" font-weight="700">${esc(mosque)}</text><text x="67" y="207" class="sans gold" font-size="18" letter-spacing="5">${esc(location.toUpperCase())}</text>
          <text x="720" y="118" text-anchor="middle" class="serif white" font-size="98">${esc(clock)}</text><text x="720" y="160" text-anchor="middle" class="sans white" font-size="21">${esc(dates[0] || "")}</text><text x="720" y="190" text-anchor="middle" class="sans white" font-size="21">${esc(dates[1] || "")}</text>
          <text x="1370" y="72" text-anchor="end" class="serif gold" font-size="30">وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ</text><text x="1370" y="112" text-anchor="end" class="sans white" font-size="18">${esc(verse || "And establish prayer and give zakah")}</text>
        </g>
        <rect x="60" y="220" width="1320" height="92" rx="18" class="box"/>
        <circle cx="295" cy="266" r="30" class="iconCircle"/><text x="295" y="276" text-anchor="middle" class="gold" font-size="28">◷</text>
        <text x="350" y="250" class="sans gold" font-size="17">NEXT PRAYER</text><text x="350" y="283" class="sans white" font-size="31" font-weight="700">${esc(nextEn)}</text>
        <text x="735" y="279" text-anchor="middle" class="serif gold" font-size="50">${esc(nextTime)}</text>
        <line x1="875" y1="237" x2="875" y2="295" stroke="#a58a4c"/><circle cx="1000" cy="266" r="30" class="iconCircle"/><text x="1000" y="276" text-anchor="middle" class="gold" font-size="25">♙</text><text x="1050" y="252" class="sans gold" font-size="16">IQAMA</text><text x="1050" y="285" class="sans white" font-size="30">${esc(nextIqama)}</text>
        <rect x="60" y="326" width="590" height="390" rx="18" class="box"/><text x="90" y="365" class="sans gold" font-size="18" font-weight="700">SALAH</text><text x="350" y="365" class="sans gold" font-size="18" font-weight="700">AZAN</text><text x="518" y="365" class="sans gold" font-size="18" font-weight="700">IQAMA</text>${rowSvg}
        <rect x="665" y="326" width="715" height="390" rx="18" class="box"/><text x="715" y="365" class="sans gold" font-size="20" font-weight="700">ANNOUNCEMENTS</text>${annSvg}
        <line x1="1175" y1="346" x2="1175" y2="695" stroke="#a58a4c"/><text x="1275" y="380" text-anchor="middle" class="sans gold" font-size="17" font-weight="700">SUPPORT YOUR MASJID</text><text x="1275" y="415" text-anchor="middle" class="sans white" font-size="15">Every contribution makes</text><text x="1275" y="436" text-anchor="middle" class="sans white" font-size="15">a lasting impact.</text>
        <rect x="1220" y="470" width="110" height="110" rx="8" fill="#f8f5eb"/><g fill="#111"><rect x="1233" y="483" width="26" height="26"/><rect x="1291" y="483" width="26" height="26"/><rect x="1233" y="541" width="26" height="26"/><rect x="1267" y="516" width="13" height="13"/><rect x="1285" y="532" width="13" height="13"/><rect x="1263" y="552" width="16" height="15"/></g>
        <text x="1275" y="618" text-anchor="middle" class="sans gold" font-size="18">OR</text><text x="1275" y="652" text-anchor="middle" class="sans white" font-size="15">Visit our website</text><text x="1275" y="680" text-anchor="middle" class="sans" fill="#6ec793" font-size="18" font-weight="700">${esc(website || "hassoun.app")}</text>
        <rect y="735" width="1440" height="55" fill="#073b32" opacity=".9"/><rect y="735" width="1440" height="55" fill="url(#pat)"/><text x="720" y="770" text-anchor="middle" class="sans muted" font-size="16">Powered by Hassoun</text>
      </svg><button class="px-clock-hotspot" type="button" aria-label="Open Masjid Display Studio"></button>`;
    };

    draw();
    const timer = window.setInterval(draw, 1000);
    return () => { window.clearInterval(timer); document.querySelector(".pixel-replica-one")?.remove(); };
  }, []);

  return null;
}
