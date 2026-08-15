"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TAG_KEY = "wopt-quran-verse-tags";

type TagMap = Record<string, string[]>;

function safeTags(): TagMap {
  try { return JSON.parse(window.localStorage.getItem(TAG_KEY) || "{}") as TagMap; } catch { return {}; }
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
      .wopt-ref-reciter-row{max-width:720px;margin:0 auto 14px;padding:0 20px;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;font-family:Arial,sans-serif}
      .wopt-ref-reciter-row label{font-size:11px;font-weight:800;color:#666}.wopt-ref-reciter-row select{min-width:0;height:42px;border:1px solid #e0e3e2;border-radius:12px;background:#fff;padding:0 12px;color:#222;font-size:12px;font-weight:700}
      .wopt-verse-menu{position:fixed;z-index:1200;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%) translateY(14px);width:min(690px,calc(100vw - 24px));padding:12px;border:1px solid rgba(0,0,0,.08);border-radius:18px;background:rgba(22,74,62,.98);box-shadow:0 20px 55px rgba(0,0,0,.28);color:#fff;font-family:Arial,sans-serif;opacity:0;pointer-events:none;transition:.16s ease;backdrop-filter:blur(14px)}
      .wopt-verse-menu.open{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
      .wopt-verse-menu-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 4px 10px}.wopt-verse-menu-head strong{font-size:13px}.wopt-verse-menu-head span{font-size:10px;color:#cfe4dd}.wopt-verse-menu-head button{border:0;background:transparent;color:#fff;font-size:20px}
      .wopt-verse-menu-actions{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.wopt-verse-menu-actions button{min-width:0;min-height:54px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:rgba(255,255,255,.06);color:#fff;padding:6px 4px;font-size:9px;font-weight:750;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.wopt-verse-menu-actions button b{font-size:16px;line-height:1}.wopt-verse-menu-actions button.active{background:#fff;color:#145c4c}
      .wopt-verse-tag-pop{display:none;margin-top:9px;padding:10px;border-radius:12px;background:#fff;color:#222}.wopt-verse-tag-pop.open{display:block}.wopt-verse-tag-pop input{width:100%;height:38px;border:1px solid #ddd;border-radius:9px;padding:0 10px}.wopt-verse-tag-pop .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.wopt-verse-tag-pop .chips button{border:1px solid #d7e2df;border-radius:999px;background:#f4f8f7;color:#24695b;padding:6px 9px;font-size:10px}
      .mushaf-ayah.wopt-menu-selected{background:rgba(59,170,168,.12)!important;box-shadow:0 0 0 4px rgba(59,170,168,.10)!important;border-radius:6px!important}
      @media(max-width:700px){.wopt-ref-reciter-row{padding:0 18px;margin-bottom:12px}.wopt-ref-reciter-row select{font-size:11px}.wopt-verse-menu{bottom:10px;padding:10px}.wopt-verse-menu-actions{grid-template-columns:repeat(4,1fr)}.wopt-verse-menu-actions button{min-height:50px}}
    `;
    document.head.appendChild(style);

    let selectedAyah: HTMLElement | null = null;
    let selectedKey = "";

    const reciterRow = document.createElement("div");
    reciterRow.className = "wopt-ref-reciter-row";
    reciterRow.innerHTML = `<label for="wopt-visible-reciter">Reciter</label><select id="wopt-visible-reciter" aria-label="Choose Qur’an reciter"><option>Loading reciters…</option></select>`;

    const menu = document.createElement("aside");
    menu.className = "wopt-verse-menu";
    menu.innerHTML = `
      <div class="wopt-verse-menu-head"><div><strong data-vm-key>Verse</strong><span>Selected ayah actions</span></div><button type="button" data-vm="close" aria-label="Close">×</button></div>
      <div class="wopt-verse-menu-actions">
        <button type="button" data-vm="play"><b>▶</b>Play</button>
        <button type="button" data-vm="translate"><b>文</b>Translate</button>
        <button type="button" data-vm="copy"><b>⧉</b>Copy</button>
        <button type="button" data-vm="share"><b>↗</b>Share</button>
        <button type="button" data-vm="tag"><b>◆</b>Tag</button>
        <button type="button" data-vm="bookmark"><b>☆</b>Bookmark</button>
        <button type="button" data-vm="memorize"><b>✦</b>Memorize</button>
      </div>
      <div class="wopt-verse-tag-pop"><input type="text" maxlength="32" placeholder="Type a tag and press Enter"><div class="chips"></div></div>`;
    document.body.appendChild(menu);

    const visibleReciter = reciterRow.querySelector<HTMLSelectElement>("select")!;
    const keyNode = menu.querySelector<HTMLElement>("[data-vm-key]")!;
    const tagPop = menu.querySelector<HTMLElement>(".wopt-verse-tag-pop")!;
    const tagInput = tagPop.querySelector<HTMLInputElement>("input")!;
    const chips = tagPop.querySelector<HTMLElement>(".chips")!;

    const closeMenu = () => {
      menu.classList.remove("open");
      selectedAyah?.classList.remove("wopt-menu-selected");
      selectedAyah = null;
      selectedKey = "";
      tagPop.classList.remove("open");
    };

    const renderTags = () => {
      chips.innerHTML = "";
      const tags = safeTags()[selectedKey] || [];
      tags.forEach((tag) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${tag} ×`;
        button.addEventListener("click", () => {
          const all = safeTags();
          all[selectedKey] = (all[selectedKey] || []).filter((item) => item !== tag);
          if (!all[selectedKey].length) delete all[selectedKey];
          window.localStorage.setItem(TAG_KEY, JSON.stringify(all));
          renderTags();
        });
        chips.appendChild(button);
      });
    };

    const addTag = () => {
      const value = tagInput.value.trim();
      if (!value || !selectedKey) return;
      const all = safeTags();
      const current = all[selectedKey] || [];
      if (!current.includes(value)) all[selectedKey] = [...current, value].slice(0, 12);
      window.localStorage.setItem(TAG_KEY, JSON.stringify(all));
      tagInput.value = "";
      renderTags();
    };

    const selectVerse = (ayah: HTMLElement) => {
      selectedAyah?.classList.remove("wopt-menu-selected");
      selectedAyah = ayah;
      selectedAyah.classList.add("wopt-menu-selected");
      selectedKey = ayah.dataset.verseKey || "";
      keyNode.textContent = selectedKey ? `Verse ${selectedKey}` : "Verse";
      menu.classList.add("open");
      renderTags();
    };

    const syncReciters = () => {
      const hidden = document.querySelector<HTMLSelectElement>(".wopt-quran-player [data-player='reciter']");
      if (!hidden || hidden.options.length < 2) return;
      const signature = Array.from(hidden.options).map((option) => `${option.value}:${option.text}`).join("|");
      if (visibleReciter.dataset.signature !== signature) {
        visibleReciter.innerHTML = "";
        Array.from(hidden.options).forEach((option) => visibleReciter.add(new Option(option.text, option.value)));
        visibleReciter.dataset.signature = signature;
      }
      if (document.activeElement !== visibleReciter) visibleReciter.value = hidden.value;
    };

    const placeReciter = () => {
      const shell = document.querySelector<HTMLElement>(".wopt-ref-safe");
      const progress = shell?.querySelector<HTMLElement>(".wopt-ref-audio-progress");
      const card = shell?.querySelector<HTMLElement>(".wopt-ref-safe-card");
      if (!reciterRow.isConnected && (progress || card)) (progress || card)!.insertAdjacentElement("afterend", reciterRow);
    };

    visibleReciter.addEventListener("change", () => {
      const hidden = document.querySelector<HTMLSelectElement>(".wopt-quran-player [data-player='reciter']");
      if (hidden) {
        hidden.value = visibleReciter.value;
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const chosenText = visibleReciter.selectedOptions[0]?.textContent?.toLowerCase() || "";
      const verseReciter = document.querySelector<HTMLSelectElement>(".quran-reader-toolbar .audio-tools select");
      if (verseReciter && chosenText) {
        const match = Array.from(verseReciter.options).find((option) => {
          const text = option.textContent?.toLowerCase() || "";
          const first = chosenText.split(/[·(]/)[0].trim();
          return first.length > 4 && (text.includes(first) || first.includes(text.split(/[·(]/)[0].trim()));
        });
        if (match) {
          verseReciter.value = match.value;
          verseReciter.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const ayah = target.closest<HTMLElement>(".mushaf-ayah[data-verse-key]");
      if (ayah && !target.closest(".inline-translation,.inline-transliteration")) {
        window.setTimeout(() => selectVerse(ayah), 0);
        return;
      }
      if (menu.classList.contains("open") && !target.closest(".wopt-verse-menu")) closeMenu();
    };

    const triggerExistingDock = (pattern: RegExp) => {
      window.setTimeout(() => findButton(".verse-action-dock button", pattern)?.click(), 30);
    };

    const onMenuClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-vm]");
      if (!button) return;
      const action = button.dataset.vm;
      if (action === "close") { closeMenu(); return; }
      if (!selectedAyah || !selectedKey) return;

      if (action === "play") triggerExistingDock(/play/i);
      if (action === "bookmark") triggerExistingDock(/save/i);
      if (action === "memorize") triggerExistingDock(/memorize/i);
      if (action === "translate") {
        const translationButton = findButton(".quran-reader-toolbar button", /^translation$/i);
        if (translationButton && !translationButton.classList.contains("active")) translationButton.click();
        window.setTimeout(() => selectedAyah?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      }
      if (action === "copy") {
        const translation = selectedAyah.querySelector<HTMLElement>(".inline-translation")?.textContent?.trim() || "";
        const text = `${verseArabic(selectedAyah)}${translation ? `\n${translation}` : ""}\n${selectedKey}`;
        await navigator.clipboard?.writeText(text).catch(() => undefined);
      }
      if (action === "share") {
        const translation = selectedAyah.querySelector<HTMLElement>(".inline-translation")?.textContent?.trim() || "";
        const text = `${verseArabic(selectedAyah)}${translation ? `\n${translation}` : ""}\n${selectedKey}`;
        if (navigator.share) await navigator.share({ title: `Qur’an ${selectedKey}`, text }).catch(() => undefined);
        else await navigator.clipboard?.writeText(text).catch(() => undefined);
      }
      if (action === "tag") {
        tagPop.classList.toggle("open");
        if (tagPop.classList.contains("open")) tagInput.focus();
      }
    };

    tagInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } });
    menu.addEventListener("click", onMenuClick);
    document.addEventListener("click", onDocumentClick, true);

    const timer = window.setInterval(() => { placeReciter(); syncReciters(); }, 500);
    placeReciter();
    syncReciters();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onDocumentClick, true);
      menu.removeEventListener("click", onMenuClick);
      reciterRow.remove();
      menu.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
