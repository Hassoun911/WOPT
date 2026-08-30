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
      const verse = text(source.querySelector(".header-verse")) || "And establish prayer and give zakah and bow with those who bow.";
      const nextEn = text(source.querySelector(".next-name strong"));
      const nextTime = text(source.querySelector(".next-time b"));
      const nextIqama = text(source.querySelector(".next-time small")).replace(/^Iqama\s*/i, "") || "—";
      const rows = [...source.querySelectorAll(".tv-prayer-table .table-row")].slice(0,5).map(r => ({
        name: text(r.querySelector("strong")).replace(/[☾☀◉◒☽]/g, "").trim(),
        adhan: text(r.querySelector("b:not(.iqama)")),
        iqama: text(r.querySelector("b.iqama")) || "—"
      }));
      const anns = [...source.querySelectorAll(".tv-announcements article")].slice(0,4).map(a => ({title:text(a.querySelector("strong")), body:text(a.querySelector("p"))}));
      const website = text(source.querySelector(".tv-donation strong")) || "hassoun.app";

      const rowSvg = rows.map((r,i) => {
        const y = 402 + i*57;
        const icon = ["☀","☀","☀","◒","☾"][i];
        return `<line x1="78" y1="${y+30}" x2="630" y2="${y+30}" class="line"/><text x="92" y="${y}" class="gold icon">${icon}</text><text x="142" y="${y}" class="prayer">${esc(r.name)}</text><text x="356" y="${y}" class="time">${esc(r.adhan)}</text><text x="524" y="${y}" class="iq">${esc(r.iqama)}</text>`;
      }).join("");
      const annSvg = anns.map((a,i) => {
        const y = 420 + i*83;
        const icon = ["▣","◯","▦","♡"][i];
        return `<line x1="684" y1="${y+46}" x2="1144" y2="${y+46}" class="line"/><circle cx="708" cy="${y-8}" r="24" class="iconCircle"/><text x="708" y="${y-1}" text-anchor="middle" class="gold annIcon">${icon}</text><text x="758" y="${y-13}" class="annTitle">${esc(a.title || "Announcement")}</text><text x="758" y="${y+14}" class="annBody">${esc(a.body || "")}</text>`;
      }).join("");

      root.innerHTML = `<svg class="px-reference-art" viewBox="0 0 1440 790" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#012f29"/><stop offset=".55" stop-color="#064b3d"/><stop offset="1" stop-color="#022e28"/></linearGradient>
          <pattern id="pat" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M27 1L40 14 53 27 40 40 27 53 14 40 1 27 14 14Z" fill="none" stroke="#0b6553" stroke-width="1" opacity=".22"/><circle cx="27" cy="27" r="8" fill="none" stroke="#0b6553" opacity=".16"/></pattern>
          <style>
            .serif{font-family:Georgia,'Times New Roman',serif}.sans{font-family:Arial,Helvetica,sans-serif}.gold{fill:#d9b36b}.white{fill:#f7f4eb}.muted{fill:#bccbc3}.line{stroke:#9a8246;stroke-width:1;opacity:.42}.box{fill:#043e34;fill-opacity:.76;stroke:#a58a4c;stroke-width:1.3}.iconCircle{fill:#0c5648;stroke:#a58a4c;stroke-width:1}.prayer{fill:#f7f4eb;font:600 24px Arial}.time{fill:#f7f4eb;font:600 22px Arial}.iq{fill:#70c88e;font:600 22px Arial}.icon{font:27px Arial}.annIcon{font:19px Arial}.annTitle{fill:#f7f4eb;font:600 18px Arial}.annBody{fill:#c8d5cf;font:15px Arial}
          </style>
        </defs>
        <rect width="1440" height="790" fill="url(#bg)"/><rect width="1440" height="790" fill="url(#pat)"/>

        <!-- Header: logo/brand, clock/date, verse -->
        <g>
          <path d="M82 150V79c0-31 24-54 51-54s51 23 51 54v71" fill="none" stroke="#d7b873" stroke-width="4"/>
          <path d="M100 150V103h66v47" fill="none" stroke="#d7b873" stroke-width="4"/>
          <path d="M133 103V74" stroke="#d7b873" stroke-width="4"/><circle cx="133" cy="68" r="8" fill="#d7b873"/>
          <text x="72" y="184" class="serif white" font-size="37" font-weight="700">${esc(mosque)}</text>
          <text x="74" y="211" class="sans gold" font-size="15" letter-spacing="4">${esc(location.toUpperCase())}</text>

          <text x="720" y="112" text-anchor="middle" class="serif white" font-size="82">${esc(clock)}</text>
          <text x="720" y="158" text-anchor="middle" class="sans white" font-size="20">${esc((dates[0] || "") + (dates[1] ? "   |   " + dates[1] : ""))}</text>

          <text x="1368" y="65" text-anchor="end" class="serif gold" font-size="28">وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ</text>
          <text x="1368" y="105" text-anchor="end" class="sans white" font-size="17">${esc(verse.slice(0,58))}</text>
          <text x="1368" y="132" text-anchor="end" class="sans white" font-size="17">${esc(verse.length > 58 ? verse.slice(58,116) : "")}</text>
        </g>

        <!-- Next prayer bar -->
        <rect x="60" y="220" width="1320" height="92" rx="18" class="box"/>
        <circle cx="294" cy="266" r="30" class="iconCircle"/><text x="294" y="276" text-anchor="middle" class="gold" font-size="28">◷</text>
        <text x="350" y="250" class="sans gold" font-size="17">NEXT PRAYER</text><text x="350" y="283" class="sans white" font-size="31" font-weight="700">${esc(nextEn)}</text>
        <text x="720" y="279" text-anchor="middle" class="serif gold" font-size="50">${esc(nextTime)}</text>
        <line x1="880" y1="237" x2="880" y2="295" stroke="#a58a4c"/><circle cx="1010" cy="266" r="30" class="iconCircle"/><text x="1010" y="276" text-anchor="middle" class="gold" font-size="24">♙</text><text x="1062" y="252" class="sans gold" font-size="16">IQAMA</text><text x="1062" y="285" class="sans white" font-size="30">${esc(nextIqama)}</text>

        <!-- Lower left prayer table -->
        <rect x="60" y="326" width="590" height="390" rx="18" class="box"/>
        <text x="90" y="365" class="sans gold" font-size="18" font-weight="700">SALAH</text><text x="350" y="365" class="sans gold" font-size="18" font-weight="700">AZAN</text><text x="518" y="365" class="sans gold" font-size="18" font-weight="700">IQAMA</text>${rowSvg}

        <!-- Lower center announcements + right donation -->
        <rect x="665" y="326" width="715" height="390" rx="18" class="box"/>
        <text x="712" y="365" class="sans gold" font-size="20" font-weight="700">ANNOUNCEMENTS</text>${annSvg}
        <line x1="1170" y1="346" x2="1170" y2="695" stroke="#a58a4c"/>
        <text x="1275" y="382" text-anchor="middle" class="sans gold" font-size="17" font-weight="700">SUPPORT YOUR MASJID</text>
        <text x="1275" y="415" text-anchor="middle" class="sans white" font-size="15">Every contribution makes</text><text x="1275" y="436" text-anchor="middle" class="sans white" font-size="15">a lasting impact.</text>
        <rect x="1220" y="468" width="110" height="110" rx="8" fill="#f8f5eb"/>
        <g fill="#111"><rect x="1233" y="481" width="26" height="26"/><rect x="1291" y="481" width="26" height="26"/><rect x="1233" y="539" width="26" height="26"/><rect x="1267" y="514" width="13" height="13"/><rect x="1285" y="530" width="13" height="13"/><rect x="1263" y="550" width="16" height="15"/></g>
        <text x="1275" y="618" text-anchor="middle" class="sans gold" font-size="18">OR</text><text x="1275" y="650" text-anchor="middle" class="sans white" font-size="15">Visit our website</text><text x="1275" y="677" text-anchor="middle" class="sans" fill="#6ec793" font-size="17" font-weight="700">${esc(website)}</text>

        <rect y="735" width="1440" height="55" fill="#073b32" opacity=".94"/><rect y="735" width="1440" height="55" fill="url(#pat)"/><text x="720" y="770" text-anchor="middle" class="sans muted" font-size="16">Powered by Hassoun</text>
      </svg><button class="px-clock-hotspot" type="button" aria-label="Open Masjid Display Studio"></button>`;
    };

    draw();
    const timer = window.setInterval(draw, 1000);
    return () => { window.clearInterval(timer); document.querySelector(".pixel-replica-one")?.remove(); };
  }, []);

  return null;
}
