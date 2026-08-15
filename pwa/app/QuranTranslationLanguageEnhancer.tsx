"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const PREF_KEY = "wopt-quran-translation-resource";
const MODE_KEY = "wopt-quran-text-mode";

type TranslationResource = {
  id: number;
  name?: string;
  author_name?: string;
  language_name?: string;
  slug?: string;
};

type VerseTranslation = {
  verse_key?: string;
  translations?: Array<{ text?: string }>;
};

function stripHtml(value = "") {
  const div = document.createElement("div");
  div.innerHTML = value;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function currentChapterId() {
  const key = document.querySelector<HTMLElement>(".mushaf-text [data-verse-key]")?.dataset.verseKey || "";
  return Number(key.split(":")[0]) || 1;
}

function isRtlLanguage(value: string) {
  const lang = value.toLowerCase();
  return ["arabic", "urdu", "persian", "farsi", "pashto", "kurdish"].some((item) => lang.includes(item));
}

export default function QuranTranslationLanguageEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptTranslationLanguages = "true";
    style.textContent = `
      .wopt-translation-backdrop{position:fixed;z-index:3900;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.38);padding:12px}.wopt-translation-backdrop.open{display:flex}
      .wopt-translation-sheet{width:min(620px,100%);max-height:78dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:#fff;box-shadow:0 25px 80px rgba(0,0,0,.3);font-family:Arial,sans-serif;color:#222}
      .wopt-translation-head{display:flex;align-items:center;justify-content:space-between;padding:18px;border-bottom:1px solid #eceeee}.wopt-translation-head strong{font-size:20px}.wopt-translation-head button{width:40px;height:40px;border:0;border-radius:50%;background:#f2f4f3;font-size:22px}
      .wopt-translation-note{padding:11px 18px;color:#6f7976;font-size:12px;border-bottom:1px solid #f0f0f0}.wopt-translation-list{overflow:auto;padding:8px}
      .wopt-translation-choice{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 12px;border:0;border-bottom:1px solid #eee;background:#fff;text-align:left}.wopt-translation-choice:last-child{border-bottom:0}.wopt-translation-choice strong{display:block;font-size:14px}.wopt-translation-choice span{display:block;margin-top:3px;color:#777;font-size:11px}.wopt-translation-choice.selected{background:#edf9f6}.wopt-translation-choice.selected:after{content:"✓";font-weight:900;color:#0b6653}
      .wopt-translation-status{padding:26px;text-align:center;color:#6d7774}.wopt-translation-language-pill{display:inline-flex;align-items:center;gap:5px;margin-left:5px;font-size:9px;font-weight:900;color:#157f7c;vertical-align:middle}
      .quran-app .inline-translation.wopt-direct-translation{display:none!important;width:100%!important;box-sizing:border-box!important;margin:10px 0 18px!important;padding:0 4px!important;direction:ltr!important;text-align:left!important;font-family:Arial,sans-serif!important;font-size:var(--wopt-translation-size,14px)!important;line-height:1.65!important;color:#5d6663!important}
      .quran-app[data-wopt-text-mode='translation'] .inline-translation.wopt-direct-translation{display:block!important}
      .quran-app .inline-translation.wopt-direct-translation[dir='rtl']{direction:rtl!important;text-align:right!important;font-family:"Noto Naskh Arabic","Amiri",serif!important}
      .wopt-translation-loading{display:block!important;width:100%!important;margin:12px 0 18px!important;color:#78817e!important;font:12px/1.5 Arial,sans-serif!important;text-align:left!important;direction:ltr!important}
      @media(max-width:600px){.wopt-translation-backdrop{padding:0 8px 8px}.wopt-translation-sheet{max-height:82dvh;border-radius:20px 20px 14px 14px}.wopt-translation-head{padding:16px}.wopt-translation-choice{padding:13px 10px}}
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement("div");
    backdrop.className = "wopt-translation-backdrop";
    backdrop.innerHTML = `
      <section class="wopt-translation-sheet" role="dialog" aria-modal="true" aria-label="Choose Qur’an translation">
        <div class="wopt-translation-head"><strong>Choose translation language</strong><button type="button" data-close aria-label="Close">×</button></div>
        <div class="wopt-translation-note">Arabic Qur’an text stays visible. The selected translation appears directly under each ayah.</div>
        <div class="wopt-translation-list"><div class="wopt-translation-status">Loading available translations…</div></div>
      </section>`;
    document.body.appendChild(backdrop);

    const list = backdrop.querySelector<HTMLElement>(".wopt-translation-list")!;
    let resources: TranslationResource[] = [];
    let selectedId = Number(window.localStorage.getItem(PREF_KEY) || 131) || 131;
    let selectedName = "English";
    let loadingChapter = false;
    let loadedChapter = 0;
    let loadedResource = 0;

    const languagePriority = ["english", "arabic", "french", "spanish", "turkish", "urdu", "indonesian", "german", "bosnian", "russian", "persian", "bengali", "chinese", "malay", "italian", "dutch"];

    const preferredResources = (items: TranslationResource[]) => {
      const grouped = new Map<string, TranslationResource[]>();
      items.forEach((item) => {
        const language = (item.language_name || "Other").trim();
        const key = language.toLowerCase();
        grouped.set(key, [...(grouped.get(key) || []), item]);
      });
      const orderedKeys = [...grouped.keys()].sort((a, b) => {
        const ai = languagePriority.indexOf(a); const bi = languagePriority.indexOf(b);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.localeCompare(b);
      });
      return orderedKeys.flatMap((key) => (grouped.get(key) || []).slice(0, 3));
    };

    const renderChoices = () => {
      const choices = preferredResources(resources);
      if (!choices.length) {
        list.innerHTML = `<button class="wopt-translation-choice selected" type="button" data-resource="131" data-language="English"><div><strong>English</strong><span>The Clear Quran</span></div></button>`;
        return;
      }
      list.innerHTML = choices.map((item) => {
        const language = item.language_name || "Translation";
        const title = item.name || item.author_name || language;
        return `<button class="wopt-translation-choice ${item.id === selectedId ? "selected" : ""}" type="button" data-resource="${item.id}" data-language="${language.replace(/"/g, "&quot;")}"><div><strong>${language}</strong><span>${title}</span></div></button>`;
      }).join("");
    };

    const root = () => document.querySelector<HTMLElement>(".quran-app");
    const hiddenToggle = (label: "Translation" | "Transliteration") => Array.from(document.querySelectorAll<HTMLButtonElement>(".quran-reader-toolbar button")).find((button) => new RegExp(`^${label}$`, "i").test((button.textContent || "").trim()));

    const removeTranslations = () => {
      document.querySelectorAll(".inline-translation.wopt-direct-translation,.wopt-translation-loading").forEach((node) => node.remove());
      loadedChapter = 0;
      loadedResource = 0;
    };

    const setVisibleMode = (mode: "arabic" | "translation" | "transliteration") => {
      root()?.setAttribute("data-wopt-text-mode", mode);
      window.localStorage.setItem(MODE_KEY, mode);
      const shell = document.querySelector<HTMLElement>(".wopt-ref-safe");
      shell?.querySelector("[data-ref='arabic']")?.classList.toggle("active", mode === "arabic");
      shell?.querySelector("[data-ref='translation']")?.classList.toggle("active", mode === "translation");
      shell?.querySelector("[data-ref='transliteration']")?.classList.toggle("active", mode === "transliteration");
    };

    const updateTranslationButtonLabel = () => {
      const button = document.querySelector<HTMLButtonElement>(".wopt-ref-safe [data-ref='translation']");
      if (!button) return;
      button.innerHTML = `Translation <span class="wopt-translation-language-pill">${selectedName}</span>`;
    };

    const disableLegacyTranslation = () => {
      const old = hiddenToggle("Translation");
      if (old?.classList.contains("active")) old.click();
    };

    const fetchChapterTranslations = async (chapter: number) => {
      const collected: VerseTranslation[] = [];
      for (let page = 1; page <= 8; page += 1) {
        const response = await fetch(`${API}/verses/by_chapter/${chapter}?language=en&words=false&translations=${selectedId}&fields=text_uthmani&per_page=50&page=${page}`);
        if (!response.ok) throw new Error("translation");
        const data = await response.json() as { verses?: VerseTranslation[] };
        const verses = data.verses || [];
        collected.push(...verses);
        if (verses.length < 50) break;
      }
      return collected;
    };

    const renderChapterTranslations = (verses: VerseTranslation[]) => {
      removeTranslations();
      verses.forEach((verse) => {
        const key = verse.verse_key;
        const text = stripHtml(verse.translations?.[0]?.text || "");
        if (!key || !text) return;
        const ayah = document.querySelector<HTMLElement>(`.mushaf-text [data-verse-key='${key}']`);
        if (!ayah) return;
        const node = document.createElement("div");
        node.className = "inline-translation wopt-direct-translation";
        node.dataset.translationVerse = key;
        node.textContent = text;
        if (isRtlLanguage(selectedName)) node.dir = "rtl";
        ayah.insertAdjacentElement("afterend", node);
      });
    };

    const loadTranslationForCurrentChapter = async () => {
      const chapter = currentChapterId();
      if (loadingChapter) return;
      if (loadedChapter === chapter && loadedResource === selectedId && document.querySelector(".wopt-direct-translation")) {
        setVisibleMode("translation");
        return;
      }
      loadingChapter = true;
      disableLegacyTranslation();
      removeTranslations();
      setVisibleMode("translation");
      const first = document.querySelector<HTMLElement>(".mushaf-text .mushaf-ayah");
      const loading = document.createElement("div");
      loading.className = "wopt-translation-loading";
      loading.textContent = `Loading ${selectedName} translation…`;
      first?.insertAdjacentElement("beforebegin", loading);
      try {
        const verses = await fetchChapterTranslations(chapter);
        loading.remove();
        renderChapterTranslations(verses);
        loadedChapter = chapter;
        loadedResource = selectedId;
        setVisibleMode("translation");
      } catch {
        loading.textContent = "Translation could not load. Tap Translation and try another language.";
      } finally {
        loadingChapter = false;
        updateTranslationButtonLabel();
      }
    };

    const openPicker = () => {
      disableLegacyTranslation();
      backdrop.classList.add("open");
      renderChoices();
    };
    const closePicker = () => backdrop.classList.remove("open");

    const loadResources = async () => {
      try {
        const response = await fetch(`${API}/resources/translations?language=en`);
        if (!response.ok) throw new Error("resources");
        const data = await response.json() as { translations?: TranslationResource[] };
        resources = data.translations || [];
        const selected = resources.find((item) => item.id === selectedId);
        selectedName = selected?.language_name || selected?.name || "English";
      } catch {
        resources = [{ id: 131, language_name: "English", name: "The Clear Quran" }];
        selectedName = "English";
        selectedId = 131;
      }
      renderChoices();
      updateTranslationButtonLabel();
    };

    const capture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".wopt-ref-safe [data-ref='translation']")) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openPicker();
        return;
      }
      if (target.closest(".wopt-ref-safe [data-ref='arabic']")) {
        removeTranslations();
        setVisibleMode("arabic");
        return;
      }
      if (target.closest(".wopt-ref-safe [data-ref='transliteration']")) {
        removeTranslations();
        setVisibleMode("transliteration");
      }
    };

    document.addEventListener("click", capture, true);
    backdrop.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target === backdrop || target.closest("[data-close]")) {
        closePicker();
        return;
      }
      const choice = target.closest<HTMLButtonElement>("[data-resource]");
      if (!choice) return;
      selectedId = Number(choice.dataset.resource || 131) || 131;
      selectedName = choice.dataset.language || "Translation";
      window.localStorage.setItem(PREF_KEY, String(selectedId));
      closePicker();
      void loadTranslationForCurrentChapter();
    });

    const chapterWatch = window.setInterval(() => {
      if (root()?.getAttribute("data-wopt-text-mode") !== "translation") return;
      const chapter = currentChapterId();
      if (chapter !== loadedChapter && !loadingChapter) void loadTranslationForCurrentChapter();
    }, 900);

    void loadResources().then(() => {
      const savedMode = window.localStorage.getItem(MODE_KEY);
      if (savedMode === "translation") void loadTranslationForCurrentChapter();
    });

    return () => {
      window.clearInterval(chapterWatch);
      document.removeEventListener("click", capture, true);
      removeTranslations();
      backdrop.remove();
      style.remove();
      root()?.removeAttribute("data-wopt-text-mode");
    };
  }, [pathname]);

  return null;
}
