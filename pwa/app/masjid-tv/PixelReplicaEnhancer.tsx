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
        root.setAttribute("data-grand-version", "20260830-html1");
        root.style.background = "#012f29";
        root.style.overflow = "hidden";
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
      const verse = text(source.querySelector(".header-verse")) || "Indeed, in the remembrance of Allah do hearts find rest.";
      const nextEn = text(source.querySelector(".next-name strong")) || "Fajr";
      const nextTime = text(source.querySelector(".next-time b")) || "—";
      const nextIqama = text(source.querySelector(".next-time small")).replace(/^Iqama\s*/i, "") || "—";
      const rows = [...source.querySelectorAll(".tv-prayer-table .table-row")].slice(0,5).map(r => ({
        name: text(r.querySelector("strong")).replace(/[☾☀◉◒☽]/g, "").trim(),
        adhan: text(r.querySelector("b:not(.iqama)")),
        iqama: text(r.querySelector("b.iqama")) || "—"
      }));
      const anns = [...source.querySelectorAll(".tv-announcements article")].slice(0,4).map(a => ({title:text(a.querySelector("strong")), body:text(a.querySelector("p"))}));
      const websiteRaw = text(source.querySelector(".tv-donation strong"));
      const website = !websiteRaw || /Add donation|website link in setup/i.test(websiteRaw) ? "Add link in Studio" : websiteRaw;

      const dataKey = JSON.stringify({mosque, location, sourceLogo, dates, verse, nextEn, nextTime, nextIqama, rows, anns, website});
      if (dataKey === lastDataKey) {
        const clockNode = root.querySelector<HTMLElement>("#grand-live-clock");
        if (clockNode && clockNode.textContent !== clock) clockNode.textContent = clock;
        return;
      }
      lastDataKey = dataKey;

      const rowHtml = rows.map((r,i) => {
        const icon = ["☀","☀","☀","◒","☾"][i];
        return `<div style="height:18%;border-top:1px solid rgba(165,138,76,.34);position:relative;color:#f7f4eb;font-family:Arial,Helvetica,sans-serif">
          <span style="position:absolute;left:3%;top:29%;color:#d9b36b;font-size:1.45vw">${icon}</span>
          <strong style="position:absolute;left:10%;top:28%;font-size:1.45vw;font-weight:700">${esc(r.name)}</strong>
          <span style="position:absolute;left:50%;top:29%;font-size:1.35vw;font-weight:600">${esc(r.adhan)}</span>
          <span style="position:absolute;left:78%;top:29%;font-size:1.35vw;font-weight:700;color:#70c88e">${esc(r.iqama)}</span>
        </div>`;
      }).join("");

      const annHtml = anns.map((a,i) => `<div style="position:relative;height:23%;border-top:${i===0?'0':'1px solid rgba(165,138,76,.28)'};font-family:Arial,Helvetica,sans-serif">
        <div style="position:absolute;left:2%;top:22%;width:3.1vw;height:3.1vw;border:1px solid #a58a4c;border-radius:50%;color:#d9b36b;text-align:center;line-height:3.1vw;font-size:1.1vw">${["▣","◯","▦","♡"][i] || "•"}</div>
        <strong style="position:absolute;left:12%;top:23%;color:#f7f4eb;font-size:1.15vw">${esc(a.title || "Announcement")}</strong>
        <span style="position:absolute;left:12%;top:52%;color:#c8d5cf;font-size:.92vw">${esc(a.body || "")}</span>
      </div>`).join("");

      const logoHtml = sourceLogo
        ? `<img src="${esc(sourceLogo)}" alt="Masjid logo" style="position:absolute;left:2.8%;top:2.7%;width:9.2%;height:15.5%;object-fit:contain">`
        : `<div style="position:absolute;left:4.1%;top:4%;width:6.2%;height:11.5%;border:3px solid #d7b873;border-bottom:0;border-radius:42px 42px 0 0"></div><div style="position:absolute;left:5.2%;top:8.5%;width:4.1%;height:6.5%;border:3px solid #d7b873"></div>`;

      root.innerHTML = `<div style="position:absolute;inset:0;background:#012f29;color:#f7f4eb;font-family:Arial,Helvetica,sans-serif;overflow:hidden">
        <div style="position:absolute;inset:0;opacity:.18;background-image:linear-gradient(45deg,rgba(11,101,83,.35) 25%,transparent 25%),linear-gradient(-45deg,rgba(11,101,83,.35) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(11,101,83,.35) 75%),linear-gradient(-45deg,transparent 75%,rgba(11,101,83,.35) 75%);background-size:54px 54px;background-position:0 0,0 27px,27px -27px,-27px 0"></div>
        ${logoHtml}
        <div style="position:absolute;left:4.7%;top:18.2%;font-family:Georgia,'Times New Roman',serif;font-size:2.2vw;font-weight:700;white-space:nowrap">${esc(mosque)}</div>
        <div style="position:absolute;left:4.8%;top:22.1%;color:#d9b36b;font-size:.84vw;letter-spacing:.24em;text-transform:uppercase;white-space:nowrap">${esc(location)}</div>

        <div id="grand-live-clock" style="position:absolute;left:31%;top:4%;width:38%;text-align:center;font-size:5.35vw;line-height:1;font-weight:500;letter-spacing:-.04em;white-space:nowrap">${esc(clock)}</div>
        <div style="position:absolute;left:31%;top:16.9%;width:38%;text-align:center;font-size:1.1vw;white-space:nowrap">${esc((dates[0] || "") + (dates[1] ? " | " + dates[1] : ""))}</div>

        <div style="position:absolute;right:4.3%;top:5%;width:27%;text-align:right;color:#d9b36b;font-family:Georgia,'Times New Roman',serif;font-size:1.55vw">وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ</div>
        <div style="position:absolute;right:4.3%;top:10.7%;width:29%;text-align:right;color:#f7f4eb;font-size:.98vw;line-height:1.4">${esc(verse)}</div>

        <div style="position:absolute;left:4%;top:26%;width:92%;height:11.5%;background:#033a31;border:1px solid #a58a4c;border-radius:18px">
          <div style="position:absolute;left:17%;top:27%;width:3.5vw;height:3.5vw;border:1px solid #a58a4c;border-radius:50%;color:#d9b36b;text-align:center;line-height:3.5vw;font-size:1.6vw">◷</div>
          <div style="position:absolute;left:23%;top:20%;color:#d9b36b;font-size:1vw">NEXT PRAYER</div>
          <div style="position:absolute;left:23%;top:51%;font-size:1.8vw;font-weight:700">${esc(nextEn)}</div>
          <div style="position:absolute;left:44%;top:22%;width:22%;text-align:center;color:#d9b36b;font-size:3.1vw;font-weight:500">${esc(nextTime)}</div>
          <div style="position:absolute;left:66%;top:18%;width:1px;height:64%;background:#a58a4c"></div>
          <div style="position:absolute;left:73%;top:27%;width:3.5vw;height:3.5vw;border:1px solid #a58a4c;border-radius:50%;color:#d9b36b;text-align:center;line-height:3.5vw;font-size:1.4vw">♙</div>
          <div style="position:absolute;left:79%;top:20%;color:#d9b36b;font-size:1vw">IQAMA</div>
          <div style="position:absolute;left:79%;top:51%;font-size:1.8vw">${esc(nextIqama)}</div>
        </div>

        <div style="position:absolute;left:4%;top:39.5%;width:41%;height:49%;background:#033a31;border:1px solid #a58a4c;border-radius:18px;overflow:hidden">
          <div style="height:10%;position:relative;color:#d9b36b;font-size:1.1vw;font-weight:700">
            <span style="position:absolute;left:5%;top:34%">SALAH</span><span style="position:absolute;left:50%;top:34%">AZAN</span><span style="position:absolute;left:78%;top:34%">IQAMA</span>
          </div>${rowHtml}
        </div>

        <div style="position:absolute;left:46.2%;top:39.5%;width:49.8%;height:49%;background:#033a31;border:1px solid #a58a4c;border-radius:18px;overflow:hidden">
          <div style="position:absolute;left:4%;top:4%;color:#d9b36b;font-size:1.25vw;font-weight:700">ANNOUNCEMENTS</div>
          <div style="position:absolute;left:3%;top:13%;width:67%;height:78%">${annHtml}</div>
          <div style="position:absolute;left:72%;top:5%;width:1px;height:88%;background:#a58a4c"></div>
          <div style="position:absolute;left:75%;top:11%;width:22%;text-align:center;color:#d9b36b;font-size:1vw;font-weight:700">SUPPORT YOUR MASJID</div>
          <div style="position:absolute;left:75%;top:22%;width:22%;text-align:center;color:#f7f4eb;font-size:.82vw;line-height:1.35">Every contribution makes<br>a lasting impact.</div>
          <div style="position:absolute;left:80%;top:42%;width:6.4vw;height:6.4vw;background:#f8f5eb;border-radius:8px;color:#111;text-align:center;line-height:6.4vw;font-size:3.5vw">▦</div>
          <div style="position:absolute;left:75%;top:73%;width:22%;text-align:center;color:#d9b36b;font-size:1vw">OR</div>
          <div style="position:absolute;left:75%;top:80%;width:22%;text-align:center;color:#f7f4eb;font-size:.82vw">Visit our website</div>
          <div style="position:absolute;left:75%;top:87%;width:22%;text-align:center;color:#70c88e;font-size:.82vw;font-weight:700">${esc(website.slice(0,24))}</div>
        </div>

        <div style="position:absolute;left:0;bottom:0;width:100%;height:7%;background:#073b32;border-top:1px solid rgba(165,138,76,.45);text-align:center;color:#bccbc3;font-size:1vw;line-height:5.5vh">Powered by Hassoun</div>
        <button class="px-clock-hotspot" type="button" aria-label="Open Masjid Display Studio" style="position:absolute;left:31%;top:2%;width:38%;height:22%;border:0;background:transparent;cursor:pointer"></button>
      </div>`;
    };

    sync();
    const timer = window.setInterval(sync, 500);
    return () => { window.clearInterval(timer); document.querySelector(".pixel-replica-one")?.remove(); };
  }, []);

  return null;
}
