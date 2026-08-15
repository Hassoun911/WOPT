"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const CDN = "https://verses.quran.foundation/fonts/quran";

type ApiWord = { text_uthmani?: string; text_qpc_hafs?: string; char_type_name?: string };
type ApiVerse = { verse_key?: string; words?: ApiWord[] };

function hasPrivateGlyphs(text: string) {
  return /[\uE000-\uF8FF\uFFFD]/.test(text);
}

export default function QuranGlyphSafetyEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptGlyphSafety = "true";
    style.textContent = `
      @font-face{font-family:'WOPT-SafeHafs';src:url('${CDN}/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2') format('woff2');font-display:swap}
      .wopt-glyph-repaired,.wopt-glyph-repaired .quran-word{font-family:'WOPT-SafeHafs','Noto Naskh Arabic','Amiri',serif!important}
    `;
    document.head.appendChild(style);

    const repaired = new Set<number>();
    const loading = new Set<number>();

    const restorePage = async (page: number, force = false) => {
      if (!page || loading.has(page) || (!force && repaired.has(page))) return;
      loading.add(page);
      try {
        const response = await fetch(`${API}/verses/by_page/${page}?language=en&words=true&fields=text_uthmani,text_qpc_hafs,page_number&word_fields=text_uthmani,text_qpc_hafs,char_type_name&per_page=50`);
        if (!response.ok) return;
        const data = await response.json() as { verses?: ApiVerse[] };
        const byKey = new Map((data.verses || []).map((verse) => [verse.verse_key || "", verse]));

        document.querySelectorAll<HTMLElement>(`.mushaf-ayah[data-page='${page}']`).forEach((ayah) => {
          const verse = byKey.get(ayah.dataset.verseKey || "");
          if (!verse) return;
          const apiWords = (verse.words || []).filter((word) => word.char_type_name !== "end");
          const domWords = Array.from(ayah.querySelectorAll<HTMLElement>(".quran-word"));
          if (!domWords.length || !apiWords.length) return;
          domWords.forEach((node, index) => {
            const word = apiWords[index];
            if (!word) return;
            node.textContent = word.text_qpc_hafs || word.text_uthmani || node.textContent || "";
            node.style.fontFamily = "'WOPT-SafeHafs','Noto Naskh Arabic','Amiri',serif";
          });
          ayah.style.fontFamily = "'WOPT-SafeHafs','Noto Naskh Arabic','Amiri',serif";
          ayah.classList.add("wopt-glyph-repaired");
        });
        repaired.add(page);
      } catch {
        // Never replace existing Qur'an text with guessed content on network failure.
      } finally {
        loading.delete(page);
      }
    };

    const check = () => {
      const app = document.querySelector<HTMLElement>(".quran-app");
      if (!app) return;
      const script = app.dataset.woptScript || "";
      const usesPageGlyphFont = script === "qcf-v1" || script === "qcf-v2" || script === "tajweed";
      if (!usesPageGlyphFont) return;

      const pages = new Map<number, HTMLElement[]>();
      document.querySelectorAll<HTMLElement>(".mushaf-ayah[data-page]").forEach((ayah) => {
        const page = Number(ayah.dataset.page || 0);
        if (!page) return;
        const list = pages.get(page) || [];
        list.push(ayah);
        pages.set(page, list);
      });

      // Continuous Book mode can have many page-specific fonts alive at once.
      // For Qur'an integrity, always use verified Unicode Hafs in that mode.
      const continuous = document.querySelectorAll(".wopt-printed-reader [data-printed-page]").length > 1 || Boolean(document.querySelector(".wopt-scroll-page-wrap"));
      if (continuous) {
        pages.forEach((_ayahs, page) => { if (!repaired.has(page)) void restorePage(page, true); });
        return;
      }

      pages.forEach((ayahs, page) => {
        if (repaired.has(page)) return;
        const privateGlyphs = ayahs.some((ayah) => hasPrivateGlyphs(ayah.textContent || ""));
        if (!privateGlyphs) return;

        const version = script === "qcf-v1" ? "v1" : script === "qcf-v2" ? "v2" : "v4";
        const family = `wopt-p${page}-${version}`;
        let fontReady = false;
        try { fontReady = document.fonts.check(`24px '${family}'`); } catch { fontReady = false; }
        if (!fontReady) void restorePage(page, true);
      });
    };

    const observer = new MutationObserver(check);
    const root = document.querySelector(".quran-app");
    if (root) observer.observe(root, { subtree: true, childList: true, characterData: true });
    const timer = window.setInterval(check, 350);
    check();

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      style.remove();
    };
  }, [pathname]);

  return null;
}
