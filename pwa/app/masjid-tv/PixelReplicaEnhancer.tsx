"use client";

import { useEffect } from "react";

const text = (el: Element | null) => (el?.textContent || "").trim();
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] || c));

export default function PixelReplicaEnhancer() {
  useEffect(() => {
    let lastDataKey = "";

    const sync = () => {
      const shell = document.querySelector<HTMLElement>(".webtv-shell.layout-grand");
      const source = document.querySelector<HTMLElement>(".template-grand");
      if (!shell || !source) {
        document.querySelector(".pixel-replica-one")?.remove();
        lastDataKey = "";
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
      const sourceLogo = source.querySelector<HTMLImageElement>(".tv-brand img")?.src || "";
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
      const websiteRaw = text(source.querySelector(".tv-donation strong"));
      const website = !websiteRaw || /Add donation|website link in setup/i.test(websiteRaw) ? "Add link in Studio" : websiteRaw;

      // Clock changes every second; everything else should only trigger a redraw when its data changes.
      const dataKey = JSON.stringify({mosque, location, sourceLogo, dates, verse, nextEn, nextTime, nextIqama, rows, anns, website});
      if (dataKey === lastDataKey && root.querySelector("#grand-live-clock")) {
        const clockNode = root.querySelector<SVGTextElement>("#grand-live-clock");
        if (clockNode && clockNode.textContent !== clock) clockNode.textContent = clock;
        return;
      }
      lastDataKey = dataKey;

      const rowSvg = rows.map((r,i) => {
        const y = 402 + i*57;
        const icon = ["☀","☀","☀","◒","☾"][i];
        return `<line x1="78" y1="${y+30}" x2="630" y2="${y+30}" class="line"/><text x="92" y="${y}" class="gold icon">${icon}</text><text x="142" y="${y}" class="prayer">${esc(r.name)}</text><text x="356" y="${y}" class="time">${esc(r.adhan)}</text><text x="524" y="${y}" class="iq">${esc(r.iqama)}</text>`;
      }).join("");
      const annSvg = anns.map((a,i) => {
        const y = 420 + i*83;
        const icon = ["▣","◯","▦","♡"][i];
        return `<line x1="684" y1="${y+46}" x2="1168" y2="${y+46}" class="line"/><circle cx="708" cy="${y-8}" r="24" class="iconCircle"/><text x="708" y="${y-1}" text-anchor="middle" class="gold annIcon">${icon}</text><text x="758" y="${y-13}" class="annTitle">${esc(a.title || "Announcement")}</text><text x="758" y="${y+14}" class="annBody">${esc(a.body || "")}</text>`;
      }).join("");

      const logoMarkup = sourceLogo
        ? `<image id="grand-live-logo" x="66" y="22" width="138" height="126" preserveAspectRatio="xMidYMid meet" href="${esc(sourceLogo)}"/>`
        : `<g id="grand-default-logo"><path d="M88 142V82c0-27 21-47 45-47s45 20 45 47v60" fill="none" stroke="#d7b873" stroke-width="4"/><path d="M104 142V103h58v39" fill="none" stroke="#d7b873" stroke-width="4"/><path d="M133 103V78" stroke="#d7b873" stroke-width="4"/><circle cx="133" cy="72" r="7" fill="#d7b873"/></g>`;

      root.innerHTML = `<svg class="px-reference-art" viewBox="0 0 1440 810" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#002b25"/><stop offset=".55" stop-color="#043f35"/><stop offset="1" stop-color="#012a25"/></linearGradient>
          <pattern id="pat" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M27 1L40 14 53 27 40 40 27 53 14 40 1 27 14 14Z" fill="none" stroke="#0b6553" stroke-width="1" opacity=".18"/><circle cx="27" cy="27" r="8" fill="none" stroke="#0b6553" opacity=".12"/></pattern>
          <style>
            .serif{font-family:Georgia,'Times New Roman',serif}.sans{font-family:Arial,Helvetica,sans-serif}.gold{fill:#d9b36b}.white{fill:#f7f4eb}.muted{fill:#bccbc3}.line{stroke:#917a45;stroke-width:1;opacity:.38}.box{fill:#033a31;fill-opacity:.91;stroke:#a58a4c;stroke-width:1.2}.iconCircle{fill:#07473c;stroke:#a58a4c;stroke-width:1}.prayer{fill:#f7f4eb;font:600 24px Arial}.time{fill:#f7f4eb;font:600 22px Arial}.iq{fill:#70c88e;font:600 22px Arial}.icon{font:27px Arial}.annIcon{font:19px Arial}.annTitle{fill:#f7f4eb;font:600 18px Arial}.annBody{fill:#c8d5cf;font:15px Arial}
          </style>
        </defs>
        <rect width="1440" height="810" fill="url(#bg)"/><rect width="1440" height="810" fill="url(#pat)"/>

        <g id="grand-header-art">
          ${logoMarkup}
          <text x="72" y="176" class="serif white" font-size="33" font-weight="700">${esc(mosque)}</text>
          <text x="74" y="201" class="sans gold" font-size="13" letter-spacing="3.5">${esc(location.toUpperCase())}</text>

          <text id="grand-live-clock" x="715" y="104" text-anchor="middle" class="sans white" font-size="80" font-weight="500" letter-spacing="-2">${esc(clock)}</text>
          <text x="715" y="146" text-anchor="middle" class="sans white" font-size="17">${esc((dates[0] || "") + (dates[1] ? "   |   " + dates[1] : ""))}</text>

          <text x="1362" y="63" text-anchor="end" class="serif gold" font-size="25">وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ</text>
          <text x="1362" y="99" text-anchor="end" class="sans white" font-size="15">${esc(verse.slice(0,52))}</text>
          <text x="1362" y="123" text-anchor="end" class="sans white" font-size="15">${esc(verse.length > 52 ? verse.slice(52,104) : "")}</text>
        </g>

        <rect x="60" y="212" width="1320" height="88" rx="18" class="box"/>
        <circle cx="294" cy="256" r="28" class="iconCircle"/><text x="294" y="266" text-anchor="middle" class="gold" font-size="27">◷</text>
        <text x="350" y="243" class="sans gold" font-size="16">NEXT PRAYER</text><text x="350" y="276" class="sans white" font-size="29" font-weight="700">${esc(nextEn)}</text>
        <text x="720" y="269" text-anchor="middle" class="sans gold" font-size="48" font-weight="500">${esc(nextTime)}</text>
        <line x1="880" y1="229" x2="880" y2="283" stroke="#a58a4c"/><circle cx="1010" cy="256" r="28" class="iconCircle"/><text x="1010" y="266" text-anchor="middle" class="gold" font-size="23">♙</text><text x="1062" y="243" class="sans gold" font-size="15">IQAMA</text><text x="1062" y="276" class="sans white" font-size="28">${esc(nextIqama)}</text>

        <rect x="60" y="316" width="590" height="400" rx="18" class="box"/>
        <text x="90" y="355" class="sans gold" font-size="18" font-weight="700">SALAH</text><text x="350" y="355" class="sans gold" font-size="18" font-weight="700">AZAN</text><text x="518" y="355" class="sans gold" font-size="18" font-weight="700">IQAMA</text>${rowSvg}

        <rect x="665" y="316" width="715" height="400" rx="18" class="box"/>
        <text x="712" y="355" class="sans gold" font-size="20" font-weight="700">ANNOUNCEMENTS</text>${annSvg}
        <line x1="1192" y1="336" x2="1192" y2="695" stroke="#a58a4c"/>
        <text x="1285" y="374" text-anchor="middle" class="sans gold" font-size="15" font-weight="700">SUPPORT YOUR MASJID</text>
        <text x="1285" y="405" text-anchor="middle" class="sans white" font-size="13">Every contribution makes</text><text x="1285" y="424" text-anchor="middle" class="sans white" font-size="13">a lasting impact.</text>
        <rect x="1238" y="460" width="94" height="94" rx="8" fill="#f8f5eb"/>
        <g fill="#111"><rect x="1249" y="471" width="22" height="22"/><rect x="1299" y="471" width="22" height="22"/><rect x="1249" y="521" width="22" height="22"/><rect x="1279" y="499" width="11" height="11"/><rect x="1295" y="513" width="11" height="11"/><rect x="1276" y="530" width="14" height="13"/></g>
        <text x="1285" y="594" text-anchor="middle" class="sans gold" font-size="16">OR</text><text x="1285" y="624" text-anchor="middle" class="sans white" font-size="13">Visit our website</text><text x="1285" y="650" text-anchor="middle" class="sans" fill="#6ec793" font-size="13" font-weight="700">${esc(website.slice(0,24))}</text>

        <rect y="735" width="1440" height="75" fill="#073b32" opacity=".94"/><rect y="735" width="1440" height="75" fill="url(#pat)"/><text x="720" y="781" text-anchor="middle" class="sans muted" font-size="16">Powered by Hassoun</text>
      </svg><button class="px-clock-hotspot" type="button" aria-label="Open Masjid Display Studio"></button>`;
    };

    sync();
    const timer = window.setInterval(sync, 500);
    return () => { window.clearInterval(timer); document.querySelector(".pixel-replica-one")?.remove(); };
  }, []);

  return null;
}
