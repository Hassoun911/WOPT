"use client";

import { useEffect } from "react";

const previewSvg = (kind: string) => {
  const base = (inner: string, bg = "#043f34", fg = "#f3efe2", gold = "#d8ad55") => `
    <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="320" height="180" rx="10" fill="${bg}"/>
      <defs><pattern id="p-${kind}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12 1L23 12 12 23 1 12Z" fill="none" stroke="#0f6957" opacity=".22"/></pattern></defs>
      <rect width="320" height="180" rx="10" fill="url(#p-${kind})"/>
      <style>.w{fill:${fg}}.g{fill:${gold}}.l{stroke:${gold};stroke-width:1;opacity:.65}.b{fill:#075244;stroke:${gold};stroke-width:.8}.t{font-family:Arial,sans-serif;font-weight:700}</style>
      ${inner}
    </svg>`;

  switch (kind) {
    case "grand": return base(`
      <text x="18" y="27" class="w t" font-size="12">MASJID</text><text x="160" y="30" text-anchor="middle" class="w t" font-size="22">12:45 PM</text><text x="302" y="20" text-anchor="end" class="g" font-size="8">وَأَقِيمُوا الصَّلَاةَ</text>
      <rect x="14" y="42" width="292" height="27" rx="6" class="b"/><text x="58" y="58" class="g t" font-size="8">NEXT PRAYER</text><text x="156" y="60" class="g t" font-size="15">1:15 PM</text><text x="244" y="58" class="w t" font-size="8">IQAMA 1:30</text>
      <rect x="14" y="76" width="126" height="85" rx="6" class="b"/><text x="24" y="89" class="g t" font-size="7">SALAH</text><text x="86" y="89" class="g t" font-size="7">AZAN</text><text x="113" y="89" class="g t" font-size="7">IQAMA</text>
      <g class="w t" font-size="7"><text x="24" y="105">FAJR</text><text x="86" y="105">4:15</text><text x="114" y="105">4:30</text><text x="24" y="120">DHUHR</text><text x="86" y="120">1:15</text><text x="114" y="120">1:30</text><text x="24" y="135">ASR</text><text x="86" y="135">5:15</text><text x="114" y="135">5:30</text><text x="24" y="150">MAGHRIB</text><text x="86" y="150">8:20</text><text x="114" y="150">8:25</text></g>
      <rect x="146" y="76" width="160" height="85" rx="6" class="b"/><text x="158" y="90" class="g t" font-size="8">ANNOUNCEMENTS</text><line x1="258" y1="82" x2="258" y2="154" class="l"/><g class="w t" font-size="6"><text x="174" y="106">QURAN STUDY</text><text x="174" y="123">YOUTH HALAQA</text><text x="174" y="140">COMMUNITY IFTAR</text></g><rect x="272" y="103" width="20" height="20" fill="#f7f2e7"/><text x="282" y="137" text-anchor="middle" class="g t" font-size="6">DONATE</text>
    `);
    case "community": return base(`
      <rect width="320" height="48" fill="#07513f"/><text x="20" y="24" class="w t" font-size="11">MASJID</text><text x="160" y="29" text-anchor="middle" class="w t" font-size="22">12:45</text><text x="298" y="20" text-anchor="end" class="w" font-size="7">FRIDAY</text>
      <rect x="12" y="58" width="94" height="68" rx="6" fill="#07513f" stroke="#d8ad55"/><text x="59" y="73" text-anchor="middle" class="g t" font-size="8">NEXT PRAYER</text><text x="59" y="98" text-anchor="middle" class="w t" font-size="16">ASR</text>
      <rect x="113" y="58" width="88" height="68" rx="6" fill="#fff8e9" stroke="#d8ad55"/><text x="157" y="74" text-anchor="middle" fill="#154237" class="t" font-size="8">JUMU'AH</text><text x="157" y="98" text-anchor="middle" fill="#154237" class="t" font-size="14">1:15 PM</text>
      <rect x="208" y="58" width="100" height="68" rx="6" fill="#fff8e9" stroke="#d8ad55"/><text x="258" y="74" text-anchor="middle" fill="#154237" class="t" font-size="8">ANNOUNCEMENTS</text><text x="219" y="91" fill="#154237" font-size="6">Qur'an Class</text><text x="219" y="105" fill="#154237" font-size="6">Youth Program</text>
      <g fill="#07513f">${[0,1,2,3,4].map(i=>`<rect x="${12+i*60}" y="135" width="52" height="32" rx="4"/>`).join("")}</g>
    `,"#f2e8d4","#143d33");
    case "announcements": return base(`
      <text x="18" y="27" class="w t" font-size="11">MASJID</text><text x="160" y="29" text-anchor="middle" class="w t" font-size="21">12:45</text><rect x="12" y="43" width="118" height="95" rx="7" class="b"/><text x="71" y="61" text-anchor="middle" class="g t" font-size="8">NEXT PRAYER</text><text x="71" y="88" text-anchor="middle" class="w t" font-size="18">DHUHR</text><rect x="138" y="43" width="170" height="95" rx="7" class="b"/><text x="152" y="59" class="g t" font-size="8">ANNOUNCEMENTS</text><g class="w" font-size="7"><text x="153" y="78">Qur'an Class</text><text x="153" y="96">Community Dinner</text><text x="153" y="114">Youth Halaqa</text></g><g fill="#075244">${[0,1,2,3,4].map(i=>`<rect x="${12+i*60}" y="145" width="52" height="23" rx="4" stroke="#d8ad55"/>`).join("")}</g>
    `);
    case "cinematic": return base(`
      <rect width="320" height="180" fill="#091015"/><circle cx="160" cy="74" r="47" fill="#1a1f23"/><rect x="136" y="44" width="48" height="55" rx="3" fill="#17100c"/><text x="18" y="24" class="w t" font-size="10">MASJID</text><text x="160" y="30" text-anchor="middle" class="w t" font-size="22">7:24 PM</text><rect x="12" y="45" width="94" height="91" rx="8" fill="#071219" stroke="#b6883e" opacity=".9"/><text x="59" y="67" text-anchor="middle" class="g t" font-size="8">NEXT PRAYER</text><text x="59" y="94" text-anchor="middle" class="w t" font-size="16">MAGHRIB</text><rect x="214" y="45" width="94" height="42" rx="8" fill="#071219" stroke="#b6883e"/><rect x="214" y="94" width="94" height="42" rx="8" fill="#071219" stroke="#b6883e"/><g fill="#111b22">${[0,1,2,3,4].map(i=>`<rect x="${12+i*60}" y="145" width="52" height="23" rx="4" stroke="#b6883e"/>`).join("")}</g>
    `,"#091015");
    case "board": return base(`
      <text x="18" y="26" class="w t" font-size="10">PRAYER BOARD</text><text x="160" y="29" text-anchor="middle" class="w t" font-size="20">12:45</text><rect x="14" y="43" width="152" height="113" rx="7" class="b"/><text x="25" y="59" class="g t" font-size="8">SALAH</text><text x="88" y="59" class="g t" font-size="8">AZAN</text><text x="132" y="59" class="g t" font-size="8">IQAMA</text><g class="w" font-size="7">${["FAJR","DHUHR","ASR","MAGHRIB","ISHA"].map((n,i)=>`<text x="25" y="${78+i*15}">${n}</text><text x="88" y="${78+i*15}">${["5:15","1:15","4:45","8:08","9:45"][i]}</text><text x="132" y="${78+i*15}">—</text>`).join("")}</g><rect x="174" y="43" width="132" height="54" rx="7" class="b"/><rect x="174" y="104" width="132" height="52" rx="7" class="b"/>
    `);
    case "jumuah": return base(`
      <rect width="320" height="48" fill="#07513f"/><text x="20" y="24" class="w t" font-size="11">MASJID</text><text x="160" y="29" text-anchor="middle" class="w t" font-size="22">12:45</text><rect x="12" y="57" width="92" height="72" rx="6" fill="#07513f" stroke="#d8ad55"/><text x="58" y="74" text-anchor="middle" class="g t" font-size="8">NEXT PRAYER</text><text x="58" y="100" text-anchor="middle" class="w t" font-size="16">ASR</text><rect x="111" y="57" width="92" height="72" rx="6" fill="#fff9e9" stroke="#d8ad55"/><text x="157" y="76" text-anchor="middle" fill="#154237" class="t" font-size="9">JUMU'AH</text><text x="157" y="99" text-anchor="middle" fill="#154237" class="t" font-size="14">1:15 PM</text><rect x="210" y="57" width="98" height="72" rx="6" fill="#fff9e9" stroke="#d8ad55"/><text x="259" y="76" text-anchor="middle" fill="#154237" class="t" font-size="8">ANNOUNCEMENTS</text><g fill="#07513f">${[0,1,2,3,4].map(i=>`<rect x="${12+i*60}" y="139" width="52" height="28" rx="4"/>`).join("")}</g>
    `,"#f2e8d4","#143d33");
    case "adaptive": return base(`
      <text x="18" y="25" class="w t" font-size="10">MASJID</text><text x="160" y="29" text-anchor="middle" class="w t" font-size="21">12:45</text><rect x="12" y="44" width="142" height="82" rx="7" class="b"/><rect x="162" y="44" width="146" height="82" rx="7" class="b"/><text x="83" y="64" text-anchor="middle" class="g t" font-size="8">NEXT PRAYER</text><text x="235" y="64" text-anchor="middle" class="g t" font-size="8">ANNOUNCEMENTS</text><g fill="#075244">${[0,1,2,3,4].map(i=>`<rect x="${12+i*60}" y="136" width="52" height="31" rx="4" stroke="#d8ad55"/>`).join("")}</g>
    `);
    case "minimal": return base(`
      <text x="20" y="24" class="w t" font-size="10">MASJID</text><text x="160" y="57" text-anchor="middle" class="w t" font-size="34">12:45 PM</text><rect x="34" y="79" width="252" height="61" rx="9" class="b"/><text x="160" y="98" text-anchor="middle" class="g t" font-size="8">NEXT PRAYER</text><text x="160" y="124" text-anchor="middle" class="w t" font-size="18">DHUHR 1:15 PM</text><line x1="70" y1="153" x2="250" y2="153" class="l"/>
    `);
    default: return base("");
  }
};

export default function StudioPreviewEnhancer() {
  useEffect(() => {
    const enhance = () => {
      document.querySelectorAll<HTMLElement>(".layout-mini").forEach(el => {
        if (el.dataset.previewReady === "1") return;
        const cls = [...el.classList].find(c => c.startsWith("mini-"));
        if (!cls) return;
        el.innerHTML = previewSvg(cls.replace("mini-", ""));
        el.dataset.previewReady = "1";
      });
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
