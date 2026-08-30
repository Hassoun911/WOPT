"use client";

import { useEffect } from "react";

function text(el: Element | null) {
  return (el?.textContent || "").trim();
}

export default function ReplicaOneEnhancer() {
  useEffect(() => {
    let timer = 0;

    const render = () => {
      const shell = document.querySelector(".webtv-shell");
      const source = document.querySelector(".template-grand");
      if (!shell || !source || !shell.classList.contains("layout-grand")) {
        document.querySelector(".reference-replica-one")?.remove();
        return;
      }

      let replica = document.querySelector(".reference-replica-one") as HTMLElement | null;
      if (!replica) {
        replica = document.createElement("section");
        replica.className = "reference-replica-one";
        shell.appendChild(replica);
      }

      const brand = source.querySelector(".tv-brand");
      const logo = brand?.querySelector("img")?.getAttribute("src") || "";
      const mosqueName = text(brand?.querySelector("strong") || null) || "Your Masjid Name";
      const location = text(brand?.querySelector("small") || null);
      const clock = text(source.querySelector(".tv-clock"));
      const dates = Array.from(source.querySelectorAll(".tv-dates span")).map(text);
      const nextPrayer = text(source.querySelector(".next-name strong"));
      const nextTime = text(source.querySelector(".next-time > b"));
      const iqamaNext = text(source.querySelector(".next-time small")).replace(/^Iqama\s*/i, "");
      const verse = text(source.querySelector(".header-verse"));

      const prayerRows = Array.from(source.querySelectorAll(".table-row")).map((row) => ({
        name: text(row.querySelector("strong")),
        adhan: text(row.querySelector(":scope > b:not(.iqama)")),
        iqama: text(row.querySelector(".iqama")),
      }));

      const announcements = Array.from(source.querySelectorAll(".tv-announcements article")).slice(0, 4).map((row) => ({
        title: text(row.querySelector("strong")),
        body: text(row.querySelector("p")),
      }));

      const donationTitle = text(source.querySelector(".tv-donation h3")) || "SUPPORT YOUR MASJID";
      const donationBody = text(source.querySelector(".tv-donation p")) || "Every contribution makes a lasting impact.";
      const website = text(source.querySelector(".tv-donation strong"));

      const prayerIcons = ["☼", "☀", "☀", "◒", "☾"];
      const announcementIcons = ["▣", "◉", "▦", "♡"];

      replica.innerHTML = `
        <div class="replica-one-pattern"></div>
        <header class="replica-one-header">
          <div class="replica-one-brand">
            ${logo ? `<img src="${logo}" alt="Masjid logo" />` : `<div class="replica-one-logo-mark">◢</div>`}
            <div><h1>${mosqueName}</h1>${location ? `<p>${location}</p>` : ""}</div>
          </div>
          <div class="replica-one-time-wrap">
            <button class="replica-one-clock" type="button">${clock}</button>
            <div class="replica-one-dates"><span>${dates[0] || ""}</span><i></i><span>${dates[1] || ""}</span></div>
          </div>
          <div class="replica-one-verse">${verse || "And establish prayer and give zakah and bow with those who bow."}</div>
        </header>

        <section class="replica-one-nextbar">
          <div class="replica-next-icon">◷</div>
          <div class="replica-next-label"><small>NEXT PRAYER</small><strong>${nextPrayer || "—"}</strong></div>
          <div class="replica-next-time">${nextTime || "—"}</div>
          <div class="replica-next-divider"></div>
          <div class="replica-iqama-icon">♙</div>
          <div class="replica-next-label"><small>IQAMA</small><strong>${iqamaNext || "—"}</strong></div>
        </section>

        <section class="replica-one-main">
          <div class="replica-prayer-table">
            <div class="replica-table-head"><span>SALAH</span><span>AZAN</span><span>IQAMA</span></div>
            ${prayerRows.map((row, index) => `<div class="replica-table-row"><span class="replica-prayer-name"><b>${prayerIcons[index] || "◉"}</b>${row.name}</span><strong>${row.adhan}</strong><strong class="replica-iqama-value">${row.iqama || "—"}</strong></div>`).join("")}
          </div>

          <div class="replica-announcements">
            <div class="replica-section-title"><span>◉</span> ANNOUNCEMENTS</div>
            ${announcements.map((item, index) => `<article><span class="replica-ann-icon">${announcementIcons[index] || "◉"}</span><div><strong>${item.title}</strong><p>${item.body}</p></div></article>`).join("") || `<article><span class="replica-ann-icon">▣</span><div><strong>Announcements</strong><p>Add announcements from Masjid Display Studio.</p></div></article>`}
          </div>

          <aside class="replica-donation">
            <h3>${donationTitle}</h3>
            <p>${donationBody}</p>
            <div class="replica-qr" aria-label="Donation QR placeholder"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
            <div class="replica-or">OR</div>
            <div class="replica-website"><span>◎</span><div>Visit our website<strong>${website || "Add website in setup"}</strong></div></div>
          </aside>
        </section>

        <footer class="replica-one-footer">
          <div><span>◉</span><strong>Prayer • Community • Connection</strong></div>
          <div>Powered by Hassoun</div>
        </footer>
      `;

      replica.querySelector(".replica-one-clock")?.addEventListener("click", () => {
        (source.querySelector(".tv-clock") as HTMLButtonElement | null)?.click();
      });
    };

    render();
    timer = window.setInterval(render, 1000);
    const observer = new MutationObserver(render);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      document.querySelector(".reference-replica-one")?.remove();
    };
  }, []);

  return null;
}
