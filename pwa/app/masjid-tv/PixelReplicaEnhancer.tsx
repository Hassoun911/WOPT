"use client";

import { useEffect } from "react";

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch));

const text = (el: Element | null) => (el?.textContent || "").trim();

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
        root.style.backgroundImage = 'url("/masjid-tv/reference-replica.webp")';
        shell.appendChild(root);
      }

      const brand = source.querySelector(".tv-brand");
      const logo = brand?.querySelector("img")?.getAttribute("src") || "";
      const mosqueName = text(brand?.querySelector("strong") || null) || "Your Masjid Name";
      const location = text(brand?.querySelector("small") || null) || "Mosque location not set";
      const clock = text(source.querySelector(".tv-clock"));
      const dates = Array.from(source.querySelectorAll(".tv-dates span")).map(text);
      const verse = text(source.querySelector(".header-verse"));
      const nextPrayer = text(source.querySelector(".next-name strong")) || "—";
      const nextTime = text(source.querySelector(".next-time > b")) || "—";
      const iqamaNext = text(source.querySelector(".next-time small")).replace(/^Iqama\s*/i, "") || "—";

      const prayerRows = Array.from(source.querySelectorAll(".table-row")).slice(0, 5).map((row) => ({
        name: text(row.querySelector("strong")).replace(/[☼☀◒☾◉]/g, "").trim(),
        adhan: text(row.querySelector(":scope > b:not(.iqama)")),
        iqama: text(row.querySelector(".iqama")) || "—",
      }));

      const anns = Array.from(source.querySelectorAll(".tv-announcements article")).slice(0, 4).map((row) => ({
        title: text(row.querySelector("strong")),
        body: text(row.querySelector("p")),
      }));
      const website = text(source.querySelector(".tv-donation strong"));

      root.innerHTML = `
        <div class="px-brand-mask"></div>
        <div class="px-brand-live">
          ${logo ? `<img src="${esc(logo)}" alt="Masjid logo">` : ""}
          <div><h1>${esc(mosqueName)}</h1><p>${esc(location)}</p></div>
        </div>

        <div class="px-clock-mask"></div>
        <div class="px-clock-live">
          <button class="px-clock" type="button">${esc(clock)}</button>
          <div class="px-dates"><span>${esc(dates[0] || "")}</span><i></i><span>${esc(dates[1] || "")}</span></div>
        </div>

        <div class="px-verse-mask"></div>
        <div class="px-verse-live">${esc(verse || "And establish prayer and give zakah and bow with those who bow.")}</div>

        <div class="px-next-name-mask"></div><div class="px-next-name"><small>NEXT PRAYER</small><strong>${esc(nextPrayer)}</strong></div>
        <div class="px-next-time-mask"></div><div class="px-next-time">${esc(nextTime)}</div>
        <div class="px-next-iqama-mask"></div><div class="px-next-iqama"><small>IQAMA</small><strong>${esc(iqamaNext)}</strong></div>

        <div class="px-prayer-values">
          ${prayerRows.map((row, i) => `
            <div class="px-row px-row-${i}">
              <span class="px-pname">${esc(row.name)}</span>
              <span class="px-adhan">${esc(row.adhan)}</span>
              <span class="px-iqama">${esc(row.iqama)}</span>
            </div>`).join("")}
        </div>

        <div class="px-ann-values">
          ${(anns.length ? anns : [{title:"Announcements",body:"Add announcements from Masjid Display Studio."}]).map((a, i) => `
            <div class="px-ann px-ann-${i}">
              <strong>${esc(a.title)}</strong><span>${esc(a.body)}</span>
            </div>`).join("")}
        </div>

        ${website ? `<div class="px-website-mask"></div><div class="px-website-value">${esc(website)}</div>` : ""}
      `;

      root.querySelector(".px-clock")?.addEventListener("click", () => {
        (source.querySelector(".tv-clock") as HTMLButtonElement | null)?.click();
      });
    };

    draw();
    const timer = window.setInterval(draw, 1000);
    return () => {
      window.clearInterval(timer);
      document.querySelector(".pixel-replica-one")?.remove();
    };
  }, []);

  return null;
}
