"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type Chapter = {
  id: number;
  name_simple?: string;
  name_complex?: string;
  name_arabic?: string;
  revelation_place?: string;
  revelation_order?: number;
  verses_count?: number;
  pages?: number[];
  translated_name?: { name?: string };
};

function stripHtml(value = "") {
  const div = document.createElement("div");
  div.innerHTML = value;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function arabicText(ayah: HTMLElement) {
  return Array.from(ayah.querySelectorAll<HTMLElement>(".quran-word"))
    .filter((node) => !node.classList.contains("wopt-ref-duplicate-number"))
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

export default function QuranInfoMeaningEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptInfoMeaningFix = "true";
    style.textContent = `
      .wopt-detail-backdrop{position:fixed;z-index:2200;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.34);padding:12px}.wopt-detail-backdrop.open{display:flex}
      .wopt-detail-sheet{width:min(680px,100%);max-height:84dvh;overflow:auto;border-radius:24px 24px 16px 16px;background:#fff;color:#202020;box-shadow:0 28px 90px rgba(0,0,0,.3);font-family:Arial,sans-serif}
      .wopt-detail-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;background:#fff;border-bottom:1px solid #eee}.wopt-detail-head strong{font-size:20px}.wopt-detail-head small{display:block;margin-top:4px;color:#777}.wopt-detail-close{width:42px;height:42px;border:0;border-radius:50%;background:#f2f2f2;font-size:22px}
      .wopt-detail-arabic{padding:22px 22px 18px;background:#fbfaf7;direction:rtl;text-align:right;font-family:"Noto Naskh Arabic","Amiri",serif;font-size:28px;line-height:1.8}
      .wopt-detail-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 16px;border-top:1px solid #eee;border-bottom:1px solid #eee}.wopt-detail-tabs button{height:42px;border:1px solid #ddd;border-radius:12px;background:#fff;color:#555;font-weight:800}.wopt-detail-tabs button.active{background:#1e2825;color:#fff;border-color:#1e2825}
      .wopt-detail-body{padding:20px;font-size:16px;line-height:1.8}.wopt-detail-body.ar{direction:rtl;text-align:right;font-family:"Noto Naskh Arabic","Amiri",serif;font-size:20px}.wopt-detail-body.translit{font-style:italic;color:#555}.wopt-detail-source{padding:0 20px 20px;color:#888;font-size:11px}
      .wopt-info-hero{display:grid;grid-template-columns:110px 1fr;gap:18px;align-items:center;padding:22px}.wopt-info-hero .arabic{font-family:"Noto Naskh Arabic","Amiri",serif;font-size:42px;text-align:center;direction:rtl}.wopt-info-hero h3{margin:0;font-size:24px}.wopt-info-hero p{margin:5px 0 0;color:#666}
      .wopt-info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:0 20px 22px}.wopt-info-item{padding:15px;border-radius:14px;background:#f6f7f7}.wopt-info-item span{display:block;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.wopt-info-item strong{display:block;margin-top:5px;font-size:15px}.wopt-info-note{margin:0 20px 22px;padding:15px;border-left:3px solid #37aaa7;background:#f3fbf9;color:#52615d;font-size:13px;line-height:1.55}
      @media(max-width:700px){.wopt-detail-backdrop{padding:0 8px 8px}.wopt-detail-arabic{font-size:25px}.wopt-info-hero{grid-template-columns:86px 1fr}.wopt-info-hero .arabic{font-size:36px}.wopt-info-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);

    const meaning = document.createElement("div");
    meaning.className = "wopt-detail-backdrop";
    meaning.innerHTML = `<section class="wopt-detail-sheet" role="dialog" aria-modal="true"><div class="wopt-detail-head"><div><strong data-title>Ayah meaning</strong><small>Selected ayah only</small></div><button class="wopt-detail-close" type="button">×</button></div><div class="wopt-detail-arabic" data-arabic></div><div class="wopt-detail-tabs"><button class="active" data-tab="en" type="button">English</button><button data-tab="ar" type="button">العربية</button><button data-tab="translit" type="button">English letters</button></div><div class="wopt-detail-body" data-body>Loading…</div><div class="wopt-detail-source" data-source></div></section>`;
    document.body.appendChild(meaning);

    const info = document.createElement("div");
    info.className = "wopt-detail-backdrop";
    info.innerHTML = `<section class="wopt-detail-sheet" role="dialog" aria-modal="true"><div class="wopt-detail-head"><div><strong>Surah information</strong><small>Current Surah</small></div><button class="wopt-detail-close" type="button">×</button></div><div data-info-content><div class="wopt-detail-body">Loading Surah information…</div></div></section>`;
    document.body.appendChild(info);

    let english = "";
    let transliteration = "";
    let arabicMeaning = "";
    let source = "Dr. Mustafa Khattab, The Clear Quran";

    const renderTab = (tab: "en" | "ar" | "translit") => {
      meaning.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
      const body = meaning.querySelector<HTMLElement>("[data-body]")!;
      body.className = `wopt-detail-body${tab === "ar" ? " ar" : tab === "translit" ? " translit" : ""}`;
      body.textContent = tab === "ar" ? arabicMeaning : tab === "translit" ? transliteration : english;
      meaning.querySelector<HTMLElement>("[data-source]")!.textContent = tab === "en"
        ? `Source: ${source}`
        : tab === "ar"
          ? "Arabic explanation from available Qur’an tafsir data."
          : "English-letter transliteration from Qur’an word data.";
    };

    const openMeaning = async (ayah: HTMLElement) => {
      const key = ayah.dataset.verseKey || "";
      if (!key) return;

      meaning.querySelector<HTMLElement>("[data-title]")!.textContent = `Ayah ${key}`;
      meaning.querySelector<HTMLElement>("[data-arabic]")!.textContent = arabicText(ayah);
      meaning.querySelector<HTMLElement>("[data-body]")!.textContent = "Loading verified meaning…";
      meaning.querySelector<HTMLElement>("[data-source]")!.textContent = "";
      meaning.classList.add("open");

      english = "";
      transliteration = "";
      arabicMeaning = "";
      source = "Dr. Mustafa Khattab, The Clear Quran";

      try {
        const response = await fetch(`${API}/verses/by_key/${encodeURIComponent(key)}?language=en&words=true&translations=131&fields=text_uthmani&word_fields=text_uthmani,transliteration`);
        if (response.ok) {
          const data = await response.json();
          const verse = data.verse || data.verses?.[0] || {};
          const translations = Array.isArray(verse.translations) ? verse.translations : [];
          const selectedTranslation = translations.find((item: { resource_id?: number }) => Number(item.resource_id) === 131) || translations[0];
          english = stripHtml(selectedTranslation?.text || "");
          source = selectedTranslation?.resource_name || source;
          transliteration = (verse.words || [])
            .map((word: { transliteration?: { text?: string } }) => word.transliteration?.text || "")
            .filter(Boolean)
            .join(" ");
        }
      } catch {
        // handled by explicit fallback text below
      }

      if (!english) {
        const existing = ayah.querySelector<HTMLElement>(".inline-translation")?.textContent?.trim();
        if (existing) english = existing;
      }

      if (!transliteration) {
        const existing = ayah.querySelector<HTMLElement>(".inline-transliteration")?.textContent?.trim();
        if (existing) transliteration = existing;
      }

      try {
        const tafsir = await fetch(`${API}/tafsirs/16/by_ayah/${encodeURIComponent(key)}`);
        if (tafsir.ok) {
          const data = await tafsir.json();
          arabicMeaning = stripHtml(data.tafsir?.text || data.tafsirs?.[0]?.text || "");
        }
      } catch {
        // Arabic explanation is optional
      }

      if (!english) english = "English meaning could not be loaded. Please check your connection and try again.";
      if (!transliteration) transliteration = "English-letter transliteration could not be loaded for this ayah.";
      if (!arabicMeaning) arabicMeaning = "التفسير العربي غير متاح حاليًا لهذا الموضع. حاول مرة أخرى عند توفر الاتصال.";

      renderTab("en");
    };

    const openInfo = async () => {
      const firstKey = document.querySelector<HTMLElement>(".mushaf-ayah[data-verse-key]")?.dataset.verseKey || "";
      const chapterId = Number(firstKey.split(":")[0]);
      if (!chapterId) return;

      info.classList.add("open");
      const content = info.querySelector<HTMLElement>("[data-info-content]")!;
      content.innerHTML = `<div class="wopt-detail-body">Loading Surah information…</div>`;

      try {
        const response = await fetch(`${API}/chapters/${chapterId}?language=en`);
        if (!response.ok) throw new Error("chapter");
        const data = await response.json();
        const c = data.chapter as Chapter;
        const place = c.revelation_place ? `${c.revelation_place.charAt(0).toUpperCase()}${c.revelation_place.slice(1)}` : "—";
        const pages = c.pages?.length
          ? (c.pages[0] === c.pages[c.pages.length - 1] ? `${c.pages[0]}` : `${c.pages[0]}–${c.pages[c.pages.length - 1]}`)
          : "—";
        content.innerHTML = `<div class="wopt-info-hero"><div class="arabic">${c.name_arabic || ""}</div><div><h3>${c.id}. ${c.name_simple || "Surah"}</h3><p>${c.translated_name?.name || ""}</p></div></div><div class="wopt-info-grid"><div class="wopt-info-item"><span>Ayat</span><strong>${c.verses_count ?? "—"}</strong></div><div class="wopt-info-item"><span>Revelation</span><strong>${place}</strong></div><div class="wopt-info-item"><span>Revelation order</span><strong>${c.revelation_order ?? "—"}</strong></div><div class="wopt-info-item"><span>Pages</span><strong>${pages}</strong></div></div><p class="wopt-info-note">Surah information is shown without changing the reading screen.</p>`;
      } catch {
        const en = document.querySelector<HTMLElement>(".quran-title-line strong")?.textContent?.trim() || `Surah ${chapterId}`;
        const ar = document.querySelector<HTMLElement>(".quran-heading-block h1")?.textContent?.trim() || "";
        content.innerHTML = `<div class="wopt-info-hero"><div class="arabic">${ar}</div><div><h3>${chapterId}. ${en}</h3><p>Surah details are temporarily unavailable.</p></div></div>`;
      }
    };

    const closeIfBackdrop = (event: MouseEvent, el: HTMLElement) => {
      const target = event.target as HTMLElement;
      if (target === el || target.closest(".wopt-detail-close")) el.classList.remove("open");
    };

    meaning.addEventListener("click", (event) => {
      closeIfBackdrop(event, meaning);
      const tab = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tab]")?.dataset.tab as "en" | "ar" | "translit" | undefined;
      if (tab) renderTab(tab);
    });
    info.addEventListener("click", (event) => closeIfBackdrop(event, info));

    const capture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const translate = target.closest<HTMLElement>("[data-vm='translate']");
      if (translate) {
        const ayah = document.querySelector<HTMLElement>(".mushaf-ayah.wopt-menu-selected[data-verse-key]");
        if (!ayah) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        document.querySelector<HTMLElement>(".wopt-verse-menu")?.classList.remove("open");
        void openMeaning(ayah);
        return;
      }

      const infoButton = target.closest<HTMLElement>("[data-ref='info']");
      if (infoButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void openInfo();
      }
    };

    document.addEventListener("click", capture, true);

    return () => {
      document.removeEventListener("click", capture, true);
      meaning.remove();
      info.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
