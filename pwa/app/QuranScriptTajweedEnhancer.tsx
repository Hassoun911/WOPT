"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const CDN = "https://verses.quran.foundation/fonts/quran";
const KEY = "wopt-quran-script-tajweed-v1";

type ScriptMode = "uthmani" | "indopak" | "tajweed";
type FontMode = "qcf-v2" | "qcf-v1" | "qpc-hafs";
type Prefs = { script: ScriptMode; font: FontMode; tajweed: boolean; copyGlyphs: boolean };
type ApiWord = {
  position?: number;
  text_uthmani?: string;
  text_indopak?: string;
  text_qpc_hafs?: string;
  code_v1?: string;
  code_v2?: string;
};
type ApiVerse = { verse_key?: string; text_uthmani_tajweed?: string; words?: ApiWord[] };

const DEFAULTS: Prefs = { script: "uthmani", font: "qcf-v2", tajweed: false, copyGlyphs: false };

function loadPrefs(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(KEY) || "{}") } as Prefs; }
  catch { return DEFAULTS; }
}

function escapeHtml(value: string) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}

function sanitizeTajweedMarkup(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  template.content.querySelectorAll<HTMLElement>("*").forEach((node) => {
    if (node.matches("span.end,.end")) {
      node.remove();
      return;
    }
    if (node.tagName.toLowerCase() !== "tajweed") {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }
    const safeClass = (node.getAttribute("class") || "")
      .split(/\s+/)
      .filter((item) => /^[a-z0-9_-]+$/i.test(item))
      .join(" ");
    Array.from(node.attributes).forEach((attribute) => node.removeAttribute(attribute.name));
    if (safeClass) node.setAttribute("class", safeClass);
  });
  return template.innerHTML;
}

function splitTajweedWords(value: string) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeTajweedMarkup(value);
  const words: string[] = [];
  let current = "";

  const flush = () => {
    const value = current.trim();
    if (value) words.push(value);
    current = "";
  };

  template.content.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      (node.textContent || "").split(/(\s+)/).forEach((piece) => {
        if (!piece) return;
        if (/^\s+$/.test(piece)) flush();
        else current += escapeHtml(piece);
      });
      return;
    }
    if (node instanceof HTMLElement && node.tagName.toLowerCase() === "tajweed") {
      current += node.outerHTML;
    }
  });
  flush();
  return words;
}

export default function QuranScriptTajweedEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    let prefs = loadPrefs();
    let section: HTMLElement | null = null;
    let currentPage = 0;
    let refreshToken = 0;
    const loadedFonts = new Set<string>();
    const pageCache = new Map<string, ApiVerse[]>();

    const style = document.createElement("style");
    style.dataset.woptScriptTajweed = "true";
    style.textContent = `
      @font-face{font-family:'WOPT-UthmanicHafs';src:url('${CDN}/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2') format('woff2');font-display:swap}
      @font-face{font-family:'WOPT-IndoPak';src:url('${CDN}/hafs/nastaleeq/indopak/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2') format('woff2');font-display:swap}
      .wopt-script-settings{grid-column:1/-1;margin-top:8px;padding-top:16px;border-top:1px solid #e8ecea;font-family:Arial,sans-serif}
      .wopt-script-settings h3{margin:0 0 5px;font-size:15px;color:#24483e}.wopt-script-settings>p{margin:0 0 13px;color:#7a817f;font-size:11px;line-height:1.45}
      .wopt-script-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:4px;border-radius:14px;background:#f2f4f3;margin-bottom:13px}
      .wopt-script-tabs button{height:39px;border:0;border-radius:10px;background:transparent;color:#666;font-size:11px;font-weight:800}.wopt-script-tabs button.active{background:#fff;color:#137d79;box-shadow:0 2px 8px rgba(0,0,0,.08)}
      .wopt-quran-font-list{display:grid;gap:7px;margin:8px 0 13px}.wopt-quran-font-choice{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:9px 12px;border:1px solid #dde3e1;border-radius:12px;background:#fff;color:#262b2a;text-align:left}.wopt-quran-font-choice strong{display:block;font-size:12px}.wopt-quran-font-choice small{display:block;margin-top:2px;color:#878d8b;font-size:9px}.wopt-quran-font-choice i{width:20px;height:20px;border:2px solid #9ba4a1;border-radius:50%;display:grid;place-items:center}.wopt-quran-font-choice.active i{border-color:#31aaa7}.wopt-quran-font-choice.active i:after{content:'';width:10px;height:10px;border-radius:50%;background:#31aaa7}
      .wopt-tajweed-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #dde3e1;border-radius:12px;background:#fff;margin-top:7px}.wopt-tajweed-toggle strong{display:block;font-size:12px}.wopt-tajweed-toggle small{display:block;margin-top:3px;color:#808684;font-size:9px}.wopt-toggle-switch{position:relative;width:46px;height:26px;border:0;border-radius:999px;background:#cad4d1;padding:0;flex:0 0 auto}.wopt-toggle-switch:after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:.18s}.wopt-toggle-switch.on{background:#31aaa7}.wopt-toggle-switch.on:after{transform:translateX(20px)}
      .wopt-script-preview{margin-top:12px;padding:14px;border-radius:13px;background:#f8faf9;text-align:center;direction:rtl;font-size:29px;line-height:1.65;border:1px solid #edf0ef;color:#111}.wopt-script-preview[data-font='qpc-hafs']{font-family:'WOPT-UthmanicHafs',serif}.wopt-script-preview[data-script='indopak']{font-family:'WOPT-IndoPak',serif}
      .wopt-tajweed-legend{display:none;flex-wrap:wrap;gap:6px;margin-top:8px;color:#6e7774;font-size:9px}.wopt-tajweed-legend.show{display:flex}.wopt-tajweed-legend span{padding:4px 7px;border-radius:999px;background:#f4f7f6}
      .quran-app[data-wopt-script='qpc-hafs'] .mushaf-text,.quran-app[data-wopt-script='qpc-hafs'] .wopt-printed-content{font-family:'WOPT-UthmanicHafs',serif!important}
      .quran-app[data-wopt-script='indopak'] .mushaf-text,.quran-app[data-wopt-script='indopak'] .wopt-printed-content{font-family:'WOPT-IndoPak',serif!important}
      .quran-app[data-wopt-script='tajweed'] .mushaf-text,.quran-app[data-wopt-script='tajweed'] .wopt-printed-content{font-family:'WOPT-UthmanicHafs','Noto Naskh Arabic','Amiri',serif!important}
      .quran-app.wopt-printed-page-mode .wopt-scroll-page-wrap .quran-word,.quran-app.wopt-printed-page-mode .wopt-scroll-page-wrap .mushaf-ayah{font-family:'WOPT-UthmanicHafs','Noto Naskh Arabic','Amiri',serif!important}
      tajweed{color:inherit}
      tajweed.ham_wasl,tajweed.silent{color:#8a9692}
      tajweed.laam_shamsiyah{color:#6d7774}
      tajweed.madda_normal{color:#536dfe}
      tajweed.madda_permissible{color:#3949db}
      tajweed.madda_necessary{color:#1926a8}
      tajweed.ghunnah,tajweed.idgham_ghunnah{color:#e57a19}
      tajweed.ikhfa,tajweed.iqlab,tajweed.idgham_wo_ghunnah{color:#168e71}
      tajweed.qalqalah{color:#d2473e}
      @media(max-width:700px){.wopt-script-settings{grid-column:1}.wopt-quran-font-choice{min-height:45px}.wopt-script-preview{font-size:27px}}
    `;
    document.head.appendChild(style);

    const app = () => document.querySelector<HTMLElement>(".quran-app");
    const isContinuousBook = () => document.querySelectorAll<HTMLElement>("[data-printed-page]").length > 1 || Boolean(document.querySelector(".wopt-scroll-page-wrap"));
    const tajweedEnabled = () => prefs.tajweed || prefs.script === "tajweed";

    const applyModeAttributes = () => {
      const root = app();
      if (!root) return;
      const effective = tajweedEnabled() ? "tajweed" : prefs.script === "indopak" ? "indopak" : prefs.font === "qpc-hafs" ? "qpc-hafs" : prefs.font;
      root.dataset.woptScript = effective;
      root.dataset.woptTajweed = tajweedEnabled() ? "true" : "false";
    };

    const syncForm = () => {
      if (!section) return;
      section.querySelectorAll<HTMLButtonElement>("[data-script]").forEach((button) => button.classList.toggle("active", button.dataset.script === prefs.script));
      section.querySelectorAll<HTMLButtonElement>("[data-font]").forEach((button) => button.classList.toggle("active", button.dataset.font === prefs.font));
      section.querySelector<HTMLButtonElement>("[data-tajweed]")?.classList.toggle("on", tajweedEnabled());
      section.querySelector<HTMLButtonElement>("[data-copy-glyphs]")?.classList.toggle("on", prefs.copyGlyphs);
      const preview = section.querySelector<HTMLElement>("[data-script-preview]");
      if (preview) { preview.dataset.font = prefs.font; preview.dataset.script = prefs.script; }
      section.querySelector<HTMLElement>(".wopt-tajweed-legend")?.classList.toggle("show", tajweedEnabled());
    };

    const save = () => {
      window.localStorage.setItem(KEY, JSON.stringify(prefs));
      currentPage = 0;
      applyModeAttributes();
      syncForm();
      void refreshVisibleText(true);
    };

    const buildSection = () => {
      const settings = document.querySelector<HTMLElement>(".wopt-ref-settings .wopt-settings-grid");
      if (!settings || settings.querySelector(".wopt-script-settings")) return;
      section = document.createElement("section");
      section.className = "wopt-script-settings";
      section.innerHTML = `
        <h3>Qur’an script & Tajweed</h3>
        <p>Choose the printed Qur’an script/font. Tajweed keeps verified Unicode Qur’an text and only adds supported colour rules.</p>
        <div class="wopt-script-tabs" role="group" aria-label="Qur’an script">
          <button type="button" data-script="uthmani">Uthmani</button><button type="button" data-script="indopak">IndoPak</button><button type="button" data-script="tajweed">Tajweed</button>
        </div>
        <div class="wopt-quran-font-list" aria-label="Arabic Qur’an font">
          <button type="button" class="wopt-quran-font-choice" data-font="qcf-v2"><span><strong>King Fahad Complex V2</strong><small>Modern Madani mushaf</small></span><i></i></button>
          <button type="button" class="wopt-quran-font-choice" data-font="qcf-v1"><span><strong>King Fahad Complex V1</strong><small>Traditional Madani mushaf</small></span><i></i></button>
          <button type="button" class="wopt-quran-font-choice" data-font="qpc-hafs"><span><strong>QPC Uthmani Hafs</strong><small>Safe Unicode Uthmani Hafs</small></span><i></i></button>
        </div>
        <div class="wopt-tajweed-toggle"><div><strong>Show Tajweed rules while reading</strong><small>Colour-coded rules without replacing the Qur’an text with glyph codes.</small></div><button type="button" class="wopt-toggle-switch" data-tajweed aria-label="Toggle Tajweed"></button></div>
        <div class="wopt-tajweed-toggle"><div><strong>Copy verse as glyphs</strong><small>Preserve printed glyph form only when safely available.</small></div><button type="button" class="wopt-toggle-switch" data-copy-glyphs aria-label="Toggle glyph copying"></button></div>
        <div class="wopt-script-preview" data-script-preview>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <div class="wopt-tajweed-legend"><span>Ghunnah</span><span>Ikhfa</span><span>Idgham</span><span>Qalqalah</span><span>Madd</span></div>`;
      settings.insertBefore(section, settings.querySelector(".wopt-ref-reset"));
      section.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const script = target.closest<HTMLButtonElement>("[data-script]")?.dataset.script as ScriptMode | undefined;
        if (script) { prefs.script = script; if (script === "tajweed") prefs.tajweed = true; save(); return; }
        const font = target.closest<HTMLButtonElement>("[data-font]")?.dataset.font as FontMode | undefined;
        if (font) { prefs.font = font; prefs.script = "uthmani"; save(); return; }
        if (target.closest("[data-tajweed]")) { prefs.tajweed = !prefs.tajweed; if (!prefs.tajweed && prefs.script === "tajweed") prefs.script = "uthmani"; save(); return; }
        if (target.closest("[data-copy-glyphs]")) { prefs.copyGlyphs = !prefs.copyGlyphs; save(); }
      });
      syncForm();
    };

    const pageFont = async (page: number, version: "v1" | "v2") => {
      const name = `wopt-p${page}-${version}`;
      if (loadedFonts.has(name)) return name;
      const url = `${CDN}/hafs/${version}/woff2/p${page}.woff2`;
      try {
        const face = new FontFace(name, `url('${url}')`);
        await face.load();
        document.fonts.add(face);
        loadedFonts.add(name);
        return name;
      } catch { return "WOPT-UthmanicHafs"; }
    };

    const fetchPage = async (page: number) => {
      const tajweed = tajweedEnabled();
      const mushaf = prefs.script === "indopak" ? 3 : prefs.font === "qcf-v1" ? 2 : prefs.font === "qpc-hafs" ? 5 : 1;
      const cacheKey = `${page}:${mushaf}:${tajweed ? "tajweed" : "plain"}`;
      if (pageCache.has(cacheKey)) return pageCache.get(cacheKey)!;
      const response = await fetch(`${API}/verses/by_page/${page}?language=en&words=true&mushaf=${mushaf}&fields=text_uthmani,text_uthmani_tajweed,text_indopak,text_qpc_hafs,code_v1,code_v2,page_number&word_fields=text_uthmani,text_indopak,text_qpc_hafs,code_v1,code_v2&per_page=50`);
      if (!response.ok) throw new Error("script");
      const data = await response.json() as { verses?: ApiVerse[] };
      const verses = data.verses || [];
      pageCache.set(cacheKey, verses);
      return verses;
    };

    const findVisiblePage = () => {
      const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-printed-page]"));
      if (pages.length) {
        const mid = window.innerHeight * .48;
        return Number(pages.map((node) => ({ page: Number(node.dataset.printedPage || 0), d: Math.abs(node.getBoundingClientRect().top - mid) })).filter((x) => x.page).sort((a,b) => a.d-b.d)[0]?.page || 0);
      }
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".mushaf-ayah[data-page]"));
      const mid = window.innerHeight * .5;
      return Number(nodes.map((node) => ({ page: Number(node.dataset.page || 0), d: Math.abs(node.getBoundingClientRect().top - mid) })).filter((x) => x.page).sort((a,b) => a.d-b.d)[0]?.page || 0);
    };

    const restoreContinuousUnicode = () => {
      document.querySelectorAll<HTMLElement>(".mushaf-ayah[data-page] .quran-word").forEach((node) => {
        const original = node.dataset.woptOriginalText;
        if (original) node.textContent = original;
        node.style.fontFamily = prefs.script === "indopak" ? "'WOPT-IndoPak',serif" : "'WOPT-UthmanicHafs','Noto Naskh Arabic','Amiri',serif";
        delete node.dataset.woptCopyGlyph;
      });
    };

    const applyVerseWords = async (page: number, verses: ApiVerse[]) => {
      const tajweed = tajweedEnabled();
      if (isContinuousBook() && !tajweed) {
        restoreContinuousUnicode();
        return;
      }

      let fontFamily = "WOPT-UthmanicHafs";
      if (prefs.script === "indopak") fontFamily = "WOPT-IndoPak";
      else if (prefs.font === "qpc-hafs" || tajweed) fontFamily = "WOPT-UthmanicHafs";
      else fontFamily = await pageFont(page, prefs.font === "qcf-v1" ? "v1" : "v2");

      const byKey = new Map(verses.map((verse) => [verse.verse_key || "", verse]));
      document.querySelectorAll<HTMLElement>(`.mushaf-ayah[data-page='${page}'][data-verse-key]`).forEach((ayah) => {
        const verse = byKey.get(ayah.dataset.verseKey || "");
        if (!verse?.words?.length) return;
        const apiWords = new Map(verse.words.map((word, index) => [Number(word.position || index + 1), word]));
        const tajweedWords = tajweed && verse.text_uthmani_tajweed ? splitTajweedWords(verse.text_uthmani_tajweed) : [];
        const nodes = Array.from(ayah.querySelectorAll<HTMLElement>(".quran-word[data-word-position]"));

        nodes.forEach((node, index) => {
          const pos = Number(node.dataset.wordPosition || index + 1);
          const word = apiWords.get(pos);
          if (!word) return;
          if (!node.dataset.woptOriginalText) node.dataset.woptOriginalText = node.textContent || "";

          node.style.fontFamily = `'${fontFamily}',serif`;
          delete node.dataset.woptCopyGlyph;

          if (tajweed) {
            const markup = tajweedWords[index] || "";
            if (markup) node.innerHTML = markup;
            else node.textContent = word.text_uthmani || node.dataset.woptOriginalText || "";
            return;
          }

          let value = word.text_uthmani || node.dataset.woptOriginalText || "";
          let glyph = false;
          if (prefs.script === "indopak") value = word.text_indopak || word.text_uthmani || value;
          else if (prefs.font === "qpc-hafs") value = word.text_qpc_hafs || word.text_uthmani || value;
          else if (prefs.font === "qcf-v1") { value = word.code_v1 || word.text_qpc_hafs || word.text_uthmani || value; glyph = Boolean(word.code_v1); }
          else { value = word.code_v2 || word.text_qpc_hafs || word.text_uthmani || value; glyph = Boolean(word.code_v2); }

          node.textContent = value;
          if (prefs.copyGlyphs && glyph) node.dataset.woptCopyGlyph = value;
        });
      });
    };

    const refreshVisibleText = async (force = false) => {
      const tajweed = tajweedEnabled();
      if (isContinuousBook() && !tajweed) {
        restoreContinuousUnicode();
        currentPage = findVisiblePage();
        return;
      }
      const page = findVisiblePage();
      if (!page || (!force && page === currentPage)) return;
      currentPage = page;
      const token = ++refreshToken;
      try {
        const verses = await fetchPage(page);
        if (token !== refreshToken) return;
        await applyVerseWords(page, verses);
      } catch { /* keep verified Unicode text */ }
    };

    const observer = new MutationObserver(() => {
      buildSection();
      window.setTimeout(() => void refreshVisibleText(true), 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const onScroll = () => void refreshVisibleText(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    const timer = window.setInterval(() => { buildSection(); void refreshVisibleText(false); }, 700);

    applyModeAttributes();
    buildSection();
    void refreshVisibleText(true);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.clearInterval(timer);
      section?.remove();
      style.remove();
      const root = app();
      if (root) { delete root.dataset.woptScript; delete root.dataset.woptTajweed; }
    };
  }, [pathname]);

  return null;
}
