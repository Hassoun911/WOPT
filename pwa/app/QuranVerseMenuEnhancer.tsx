"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const TAG_KEY = "wopt-quran-verse-tags";

type TagMap = Record<string, string[]>;
type TafsirResource = { id?: number; name?: string; language_name?: string };

function safeTags(): TagMap {
  try { return JSON.parse(window.localStorage.getItem(TAG_KEY) || "{}") as TagMap; } catch { return {}; }
}

function stripHtml(value = "") {
  const div = document.createElement("div");
  div.innerHTML = value;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function verseArabic(ayah: HTMLElement) {
  return Array.from(ayah.querySelectorAll<HTMLElement>(".quran-word"))
    .filter((node) => !node.classList.contains("wopt-ref-duplicate-number"))
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function findButton(selector: string, pattern: RegExp) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    .find((button) => pattern.test((button.textContent || "").trim()));
}

export default function QuranVerseMenuEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptVerseMenu = "true";
    style.textContent = `
      .wopt-ref-reciter-row{max-width:720px;margin:0 auto 14px;padding:0 20px;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;font-family:Arial,sans-serif}.wopt-ref-reciter-row label{font-size:11px;font-weight:800;color:#666}.wopt-ref-reciter-row select{min-width:0;height:42px;border:1px solid #e0e3e2;border-radius:12px;background:#fff;padding:0 12px;color:#222;font-size:12px;font-weight:700}
      .wopt-verse-menu{position:fixed;z-index:1200;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%) translateY(14px);width:min(690px,calc(100vw - 24px));padding:12px;border:1px solid rgba(0,0,0,.08);border-radius:18px;background:rgba(22,74,62,.98);box-shadow:0 20px 55px rgba(0,0,0,.28);color:#fff;font-family:Arial,sans-serif;opacity:0;pointer-events:none;transition:.16s ease;backdrop-filter:blur(14px)}.wopt-verse-menu.open{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
      .wopt-verse-menu-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 4px 10px}.wopt-verse-menu-head strong{font-size:13px}.wopt-verse-menu-head span{font-size:10px;color:#cfe4dd}.wopt-verse-menu-head button{border:0;background:transparent;color:#fff;font-size:20px}.wopt-verse-menu-actions{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.wopt-verse-menu-actions button{min-width:0;min-height:54px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:rgba(255,255,255,.06);color:#fff;padding:6px 4px;font-size:9px;font-weight:750;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.wopt-verse-menu-actions button b{font-size:16px;line-height:1}.wopt-verse-menu-actions button.active{background:#fff;color:#145c4c}
      .wopt-verse-tag-pop{display:none;margin-top:9px;padding:10px;border-radius:12px;background:#fff;color:#222}.wopt-verse-tag-pop.open{display:block}.wopt-verse-tag-pop input{width:100%;height:38px;border:1px solid #ddd;border-radius:9px;padding:0 10px}.wopt-verse-tag-pop .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.wopt-verse-tag-pop .chips button{border:1px solid #d7e2df;border-radius:999px;background:#f4f8f7;color:#24695b;padding:6px 9px;font-size:10px}.mushaf-ayah.wopt-menu-selected{background:rgba(59,170,168,.12)!important;box-shadow:0 0 0 4px rgba(59,170,168,.10)!important;border-radius:6px!important}
      .wopt-meaning-backdrop{position:fixed;z-index:1500;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.32);padding:16px}.wopt-meaning-backdrop.open{display:flex}.wopt-meaning-sheet{width:min(650px,100%);max-height:min(82dvh,760px);overflow:auto;background:#fff;color:#222;border-radius:22px 22px 14px 14px;box-shadow:0 25px 80px rgba(0,0,0,.3);font-family:Arial,sans-serif}.wopt-meaning-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:14px;align-items:center;padding:17px 18px;background:#fff;border-bottom:1px solid #eee}.wopt-meaning-head strong{font-size:17px}.wopt-meaning-head span{display:block;margin-top:3px;color:#777;font-size:10px}.wopt-meaning-head button{width:38px;height:38px;border:0;border-radius:50%;background:#f3f3f3;font-size:20px}.wopt-meaning-arabic{padding:22px 20px 18px;direction:rtl;text-align:right;font-family:"Noto Naskh Arabic","Amiri",serif;font-size:29px;line-height:1.8;background:#fbfbf9}.wopt-meaning-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:13px 16px;border-top:1px solid #eee;border-bottom:1px solid #eee}.wopt-meaning-tabs button{height:40px;border:1px solid #ddd;border-radius:12px;background:#fff;color:#555;font-size:11px;font-weight:800}.wopt-meaning-tabs button.active{background:#1f2725;color:#fff;border-color:#1f2725}.wopt-meaning-body{padding:20px;font-size:15px;line-height:1.8}.wopt-meaning-body[data-lang='ar']{direction:rtl;text-align:right;font-family:"Noto Naskh Arabic","Amiri",serif;font-size:20px}.wopt-meaning-body[data-lang='translit']{font-style:italic;color:#555}.wopt-meaning-source{padding:0 20px 20px;color:#888;font-size:10px}.wopt-meaning-loading{padding:28px;text-align:center;color:#777;font-size:13px}
      @media(max-width:700px){.wopt-ref-reciter-row{padding:0 18px;margin-bottom:12px}.wopt-ref-reciter-row select{font-size:11px}.wopt-verse-menu{bottom:10px;padding:10px}.wopt-verse-menu-actions{grid-template-columns:repeat(4,1fr)}.wopt-verse-menu-actions button{min-height:50px}.wopt-meaning-backdrop{padding:0 8px 8px}.wopt-meaning-arabic{font-size:26px}.wopt-meaning-tabs{padding:10px}.wopt-meaning-body{padding:17px}}
    `;
    document.head.appendChild(style);

    let selectedAyah: HTMLElement | null = null;
    let selectedKey = "";
    let cachedEnglish = "";
    let cachedArabicMeaning = "";
    let cachedTranslit = "";
    let cachedSource = "";

    const reciterRow = document.createElement("div");
    reciterRow.className = "wopt-ref-reciter-row";
    reciterRow.innerHTML = `<label for="wopt-visible-reciter">Reciter</label><select id="wopt-visible-reciter" aria-label="Choose Qur’an reciter"><option>Loading reciters…</option></select>`;

    const menu = document.createElement("aside");
    menu.className = "wopt-verse-menu";
    menu.innerHTML = `<div class="wopt-verse-menu-head"><div><strong data-vm-key>Verse</strong><span>Selected ayah actions</span></div><button type="button" data-vm="close">×</button></div><div class="wopt-verse-menu-actions"><button type="button" data-vm="play"><b>▶</b>Play</button><button type="button" data-vm="translate"><b>文</b>Translate</button><button type="button" data-vm="copy"><b>⧉</b>Copy</button><button type="button" data-vm="share"><b>↗</b>Share</button><button type="button" data-vm="tag"><b>◆</b>Tag</button><button type="button" data-vm="bookmark"><b>☆</b>Bookmark</button><button type="button" data-vm="memorize"><b>✦</b>Memorize</button></div><div class="wopt-verse-tag-pop"><input type="text" maxlength="32" placeholder="Type a tag and press Enter"><div class="chips"></div></div>`;
    document.body.appendChild(menu);

    const meaning = document.createElement("div");
    meaning.className = "wopt-meaning-backdrop";
    meaning.innerHTML = `<section class="wopt-meaning-sheet" role="dialog" aria-modal="true" aria-label="Selected ayah meaning"><div class="wopt-meaning-head"><div><strong data-meaning-title>Ayah meaning</strong><span>Selected text only</span></div><button type="button" data-meaning-close>×</button></div><div class="wopt-meaning-arabic" data-meaning-arabic></div><div class="wopt-meaning-tabs"><button class="active" type="button" data-meaning-tab="en">English</button><button type="button" data-meaning-tab="ar">العربية</button><button type="button" data-meaning-tab="translit">English letters</button></div><div class="wopt-meaning-body" data-meaning-body><div class="wopt-meaning-loading">Loading verified meaning…</div></div><div class="wopt-meaning-source" data-meaning-source></div></section>`;
    document.body.appendChild(meaning);

    const visibleReciter = reciterRow.querySelector<HTMLSelectElement>("select")!;
    const keyNode = menu.querySelector<HTMLElement>("[data-vm-key]")!;
    const tagPop = menu.querySelector<HTMLElement>(".wopt-verse-tag-pop")!;
    const tagInput = tagPop.querySelector<HTMLInputElement>("input")!;
    const chips = tagPop.querySelector<HTMLElement>(".chips")!;
    const meaningArabic = meaning.querySelector<HTMLElement>("[data-meaning-arabic]")!;
    const meaningBody = meaning.querySelector<HTMLElement>("[data-meaning-body]")!;
    const meaningSource = meaning.querySelector<HTMLElement>("[data-meaning-source]")!;
    const meaningTitle = meaning.querySelector<HTMLElement>("[data-meaning-title]")!;

    const closeMenu = () => { menu.classList.remove("open"); selectedAyah?.classList.remove("wopt-menu-selected"); tagPop.classList.remove("open"); };
    const closeMeaning = () => meaning.classList.remove("open");

    const renderTags = () => {
      chips.innerHTML = "";
      (safeTags()[selectedKey] || []).forEach((tag) => {
        const button = document.createElement("button");
        button.type = "button"; button.textContent = `${tag} ×`;
        button.addEventListener("click", () => { const all = safeTags(); all[selectedKey] = (all[selectedKey] || []).filter((item) => item !== tag); if (!all[selectedKey].length) delete all[selectedKey]; window.localStorage.setItem(TAG_KEY, JSON.stringify(all)); renderTags(); });
        chips.appendChild(button);
      });
    };

    const addTag = () => {
      const value = tagInput.value.trim(); if (!value || !selectedKey) return;
      const all = safeTags(); const current = all[selectedKey] || []; if (!current.includes(value)) all[selectedKey] = [...current, value].slice(0, 12);
      window.localStorage.setItem(TAG_KEY, JSON.stringify(all)); tagInput.value = ""; renderTags();
    };

    const selectVerse = (ayah: HTMLElement) => {
      selectedAyah?.classList.remove("wopt-menu-selected"); selectedAyah = ayah; selectedAyah.classList.add("wopt-menu-selected"); selectedKey = ayah.dataset.verseKey || ""; keyNode.textContent = selectedKey ? `Verse ${selectedKey}` : "Verse"; menu.classList.add("open"); renderTags();
    };

    const syncReciters = () => {
      const hidden = document.querySelector<HTMLSelectElement>(".wopt-quran-player [data-player='reciter']"); if (!hidden || hidden.options.length < 2) return;
      const signature = Array.from(hidden.options).map((option) => `${option.value}:${option.text}`).join("|");
      if (visibleReciter.dataset.signature !== signature) { visibleReciter.innerHTML = ""; Array.from(hidden.options).forEach((option) => visibleReciter.add(new Option(option.text, option.value))); visibleReciter.dataset.signature = signature; }
      if (document.activeElement !== visibleReciter) visibleReciter.value = hidden.value;
    };

    const placeReciter = () => {
      const shell = document.querySelector<HTMLElement>(".wopt-ref-safe"); const progress = shell?.querySelector<HTMLElement>(".wopt-ref-audio-progress"); const modes = shell?.querySelector<HTMLElement>(".wopt-ref-play-modes");
      if (!reciterRow.isConnected && (progress || modes)) (progress || modes)!.insertAdjacentElement("afterend", reciterRow);
    };

    visibleReciter.addEventListener("change", () => {
      const hidden = document.querySelector<HTMLSelectElement>(".wopt-quran-player [data-player='reciter']"); if (hidden) { hidden.value = visibleReciter.value; hidden.dispatchEvent(new Event("change", { bubbles: true })); }
      const chosen = visibleReciter.selectedOptions[0]?.textContent?.toLowerCase() || ""; const verseReciter = document.querySelector<HTMLSelectElement>(".quran-reader-toolbar .audio-tools select");
      if (verseReciter && chosen) { const match = Array.from(verseReciter.options).find((option) => { const text = option.textContent?.toLowerCase() || ""; const first = chosen.split(/[·(]/)[0].trim(); return first.length > 4 && (text.includes(first) || first.includes(text.split(/[·(]/)[0].trim())); }); if (match) { verseReciter.value = match.value; verseReciter.dispatchEvent(new Event("change", { bubbles: true })); } }
    });

    const triggerExistingDock = (pattern: RegExp) => window.setTimeout(() => findButton(".verse-action-dock button", pattern)?.click(), 30);

    const fetchMeaning = async () => {
      if (!selectedAyah || !selectedKey) return;
      meaningTitle.textContent = `Ayah ${selectedKey}`; meaningArabic.textContent = verseArabic(selectedAyah); meaningBody.dataset.lang = "en"; meaningBody.innerHTML = `<div class="wopt-meaning-loading">Loading verified meaning…</div>`; meaningSource.textContent = ""; meaning.classList.add("open");
      cachedEnglish = ""; cachedArabicMeaning = ""; cachedTranslit = ""; cachedSource = "";
      try {
        const verseResponse = await fetch(`${API}/verses/by_key/${encodeURIComponent(selectedKey)}?language=en&words=true&translations=131,57&fields=text_uthmani&word_fields=text_uthmani,transliteration`);
        if (verseResponse.ok) {
          const data = await verseResponse.json(); const verse = data.verse || data.verses?.[0] || {};
          const translations = verse.translations || [];
          const english = translations.find((item: any) => Number(item.resource_id) === 131) || translations.find((item: any) => /english/i.test(item.language_name || ""));
          const translit = translations.find((item: any) => Number(item.resource_id) === 57);
          cachedEnglish = stripHtml(english?.text || "");
          cachedTranslit = stripHtml(translit?.text || "") || (verse.words || []).map((word: any) => word.transliteration?.text || "").filter(Boolean).join(" ");
          cachedSource = english?.resource_name || "Dr. Mustafa Khattab, The Clear Quran";
        }
      } catch { /* use fallback below */ }
      if (!cachedEnglish) cachedEnglish = selectedAyah.querySelector<HTMLElement>(".inline-translation")?.textContent?.trim() || "English meaning is temporarily unavailable.";
      if (!cachedTranslit) cachedTranslit = selectedAyah.querySelector<HTMLElement>(".inline-transliteration")?.textContent?.trim() || "Transliteration is temporarily unavailable.";
      try {
        const resourcesResponse = await fetch(`${API}/resources/tafsirs?language=ar`);
        if (resourcesResponse.ok) {
          const resources = (await resourcesResponse.json()).tafsirs as TafsirResource[] || [];
          const chosen = resources.find((item) => /sa.?di|سعد/i.test(item.name || "")) || resources.find((item) => item.language_name === "arabic") || resources.find((item) => item.id === 16);
          if (chosen?.id) {
            let text = "";
            const direct = await fetch(`${API}/tafsirs/${chosen.id}/by_ayah/${encodeURIComponent(selectedKey)}`);
            if (direct.ok) { const d = await direct.json(); text = d.tafsir?.text || d.tafsirs?.[0]?.text || ""; }
            if (!text) { const fallback = await fetch(`${API}/tafsirs/${chosen.id}?verse_key=${encodeURIComponent(selectedKey)}&per_page=1`); if (fallback.ok) { const d = await fallback.json(); text = d.tafsir?.text || d.tafsirs?.[0]?.text || ""; } }
            cachedArabicMeaning = stripHtml(text); if (cachedArabicMeaning) cachedSource = `${cachedSource}${cachedSource ? " · " : ""}${chosen.name || "Arabic tafsir"}`;
          }
        }
      } catch { /* Arabic explanation remains optional */ }
      if (!cachedArabicMeaning) cachedArabicMeaning = "التفسير العربي غير متاح مؤقتًا لهذا الموضع.";
      renderMeaningTab("en");
    };

    const renderMeaningTab = (tab: "en" | "ar" | "translit") => {
      meaning.querySelectorAll<HTMLButtonElement>("[data-meaning-tab]").forEach((button) => button.classList.toggle("active", button.dataset.meaningTab === tab));
      meaningBody.dataset.lang = tab;
      meaningBody.textContent = tab === "ar" ? cachedArabicMeaning : tab === "translit" ? cachedTranslit : cachedEnglish;
      meaningSource.textContent = tab === "en" ? `Source: ${cachedSource || "verified Qur’an translation"}` : tab === "ar" ? "Arabic explanation from an available Qur’an tafsir resource." : "Transliteration from Qur’an word/translation data.";
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement; const ayah = target.closest<HTMLElement>(".mushaf-ayah[data-verse-key]");
      if (ayah && !target.closest(".inline-translation,.inline-transliteration")) { window.setTimeout(() => selectVerse(ayah), 0); return; }
      if (menu.classList.contains("open") && !target.closest(".wopt-verse-menu") && !target.closest(".wopt-meaning-backdrop")) closeMenu();
    };

    const onMenuClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-vm]"); if (!button) return; const action = button.dataset.vm;
      if (action === "close") { closeMenu(); return; } if (!selectedAyah || !selectedKey) return;
      if (action === "play") triggerExistingDock(/play/i);
      if (action === "bookmark") triggerExistingDock(/save/i);
      if (action === "memorize") triggerExistingDock(/memorize/i);
      if (action === "translate") { closeMenu(); await fetchMeaning(); }
      if (action === "copy") { const text = `${verseArabic(selectedAyah)}\n${selectedKey}`; await navigator.clipboard?.writeText(text).catch(() => undefined); }
      if (action === "share") { const text = `${verseArabic(selectedAyah)}\n${selectedKey}`; if (navigator.share) await navigator.share({ title: `Qur’an ${selectedKey}`, text }).catch(() => undefined); else await navigator.clipboard?.writeText(text).catch(() => undefined); }
      if (action === "tag") { tagPop.classList.toggle("open"); if (tagPop.classList.contains("open")) tagInput.focus(); }
    };

    tagInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } });
    menu.addEventListener("click", onMenuClick);
    document.addEventListener("click", onDocumentClick, true);
    meaning.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target === meaning || target.closest("[data-meaning-close]")) { closeMeaning(); return; }
      const tab = target.closest<HTMLButtonElement>("[data-meaning-tab]")?.dataset.meaningTab as "en" | "ar" | "translit" | undefined; if (tab) renderMeaningTab(tab);
    });

    const timer = window.setInterval(() => { placeReciter(); syncReciters(); }, 500); placeReciter(); syncReciters();

    return () => { window.clearInterval(timer); document.removeEventListener("click", onDocumentClick, true); menu.removeEventListener("click", onMenuClick); reciterRow.remove(); menu.remove(); meaning.remove(); style.remove(); };
  }, [pathname]);

  return null;
}
