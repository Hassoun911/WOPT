"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranViewModeEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptQuranViewModes = "true";
    style.textContent = `
      .quran-app.wopt-reference-safe.wopt-ref-reading-mode .mushaf-text{
        display:block!important;
      }
      .quran-app.wopt-reference-safe.wopt-ref-reading-mode .mushaf-ayah{
        display:inline!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
        box-shadow:none!important;
      }
      .quran-app.wopt-reference-safe.wopt-ref-reading-mode .inline-translation,
      .quran-app.wopt-reference-safe.wopt-ref-reading-mode .inline-transliteration{
        display:block!important;
        width:100%!important;
        margin:12px 0 18px!important;
        direction:ltr!important;
        text-align:left!important;
        font-family:Arial,sans-serif!important;
        font-size:14px!important;
        line-height:1.65!important;
        color:#666!important;
      }

      .quran-app.wopt-reference-safe.wopt-ref-verse-mode .mushaf-text{
        display:grid!important;
        gap:18px!important;
        padding-top:8px!important;
        text-align:initial!important;
      }
      .quran-app.wopt-reference-safe.wopt-ref-verse-mode .mushaf-ayah{
        display:block!important;
        width:100%!important;
        box-sizing:border-box!important;
        padding:22px 20px 18px!important;
        margin:0!important;
        border:1px solid #e7e7e7!important;
        border-radius:16px!important;
        background:#fff!important;
        box-shadow:0 2px 10px rgba(0,0,0,.035)!important;
        text-align:right!important;
        direction:rtl!important;
      }
      .quran-app.wopt-reference-safe.wopt-ref-verse-mode .mushaf-ayah.playing,
      .quran-app.wopt-reference-safe.wopt-ref-verse-mode .mushaf-ayah.wopt-sync-playing{
        border-color:#73c7c4!important;
        background:#f2fbfa!important;
      }
      .quran-app.wopt-reference-safe.wopt-ref-verse-mode .inline-translation,
      .quran-app.wopt-reference-safe.wopt-ref-verse-mode .inline-transliteration{
        display:block!important;
        width:100%!important;
        box-sizing:border-box!important;
        margin:16px 0 0!important;
        padding-top:14px!important;
        border-top:1px solid #ededed!important;
        direction:ltr!important;
        text-align:left!important;
        font-family:Arial,sans-serif!important;
        font-size:14px!important;
        line-height:1.65!important;
        color:#616161!important;
      }
      .quran-app.wopt-reference-safe.wopt-ref-verse-mode .ayah-marker{
        margin-inline-start:.22em!important;
      }

      @media(max-width:700px){
        .quran-app.wopt-reference-safe.wopt-ref-verse-mode .mushaf-text{gap:14px!important}
        .quran-app.wopt-reference-safe.wopt-ref-verse-mode .mushaf-ayah{padding:18px 16px 16px!important;border-radius:14px!important}
        .quran-app.wopt-reference-safe.wopt-ref-verse-mode .inline-translation,
        .quran-app.wopt-reference-safe.wopt-ref-verse-mode .inline-transliteration{font-size:13px!important}
      }
    `;
    document.head.appendChild(style);

    const app = () => document.querySelector<HTMLElement>(".quran-app.wopt-reference-safe");
    const shell = () => document.querySelector<HTMLElement>(".wopt-ref-safe");

    const setMode = (mode: "reading" | "verse") => {
      const root = app();
      const ui = shell();
      if (!root || !ui) return;
      root.classList.toggle("wopt-ref-reading-mode", mode === "reading");
      root.classList.toggle("wopt-ref-verse-mode", mode === "verse");
      ui.querySelector("[data-ref='reading']")?.classList.toggle("active", mode === "reading");
      ui.querySelector("[data-ref='verse']")?.classList.toggle("active", mode === "verse");
      window.localStorage.setItem("wopt-quran-view-mode", mode);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-ref='verse']")) {
        event.preventDefault();
        event.stopPropagation();
        setMode("verse");
      } else if (target.closest("[data-ref='reading']")) {
        event.preventDefault();
        event.stopPropagation();
        setMode("reading");
      }
    };

    document.addEventListener("click", onClick, true);
    const timer = window.setInterval(() => {
      const root = app();
      if (!root) return;
      if (!root.classList.contains("wopt-ref-reading-mode") && !root.classList.contains("wopt-ref-verse-mode")) {
        const saved = window.localStorage.getItem("wopt-quran-view-mode") === "verse" ? "verse" : "reading";
        setMode(saved);
      }
    }, 300);

    window.setTimeout(() => setMode(window.localStorage.getItem("wopt-quran-view-mode") === "verse" ? "verse" : "reading"), 100);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onClick, true);
      app()?.classList.remove("wopt-ref-reading-mode", "wopt-ref-verse-mode");
      style.remove();
    };
  }, [pathname]);

  return null;
}
