"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const FONT_KEY = "wopt-quran-reference-font";
const SIZE_KEY = "wopt-quran-reference-font-size";

const FONTS = [
  { value: "Noto Naskh Arabic", label: "Noto Naskh Arabic" },
  { value: "Amiri", label: "Amiri" },
  { value: "Scheherazade New", label: "Scheherazade New" },
  { value: "Lateef", label: "Lateef" },
  { value: "Traditional Arabic", label: "Traditional Arabic" },
];

function isNumberOnly(value: string) {
  const normalized = value.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  return /^\d+$/.test(normalized);
}

export default function QuranReferenceControlsEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptReferenceControls = "true";
    style.textContent = `
      .quran-app.wopt-reference-safe .quran-word.wopt-ref-duplicate-number{display:none!important}
      .quran-app.wopt-reference-safe .mushaf-text,
      .quran-app.wopt-reference-safe .wopt-ref-safe-bismillah .ar,
      .quran-app.wopt-reference-safe .wopt-ref-safe-ar{font-family:var(--wopt-reference-quran-font,"Noto Naskh Arabic","Amiri",serif)!important}
      .quran-app.wopt-reference-safe .mushaf-text{font-size:var(--wopt-reference-quran-size,28px)!important}
      .wopt-ref-safe-actions.wopt-controls-ready{grid-template-columns:58px 58px 66px 1fr 1fr!important}
      .wopt-ref-safe-actions .wopt-stop{color:#666!important}
      .wopt-ref-safe-actions .wopt-audio-active{background:#e9f7f4!important;border-color:#47aaa7!important;color:#167d7b!important}
      .wopt-ref-audio-progress{display:grid;grid-template-columns:36px 1fr 42px;gap:8px;align-items:center;margin-top:13px;color:#777;font-size:10px}
      .wopt-ref-audio-progress input{width:100%;accent-color:#3baaa8}.wopt-ref-audio-progress span:last-child{text-align:right}
      .wopt-ref-settings-backdrop{position:fixed;z-index:1000;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.28);padding:20px}.wopt-ref-settings-backdrop.open{display:flex}
      .wopt-ref-settings{width:min(520px,100%);padding:20px;border-radius:20px 20px 14px 14px;background:#fff;box-shadow:0 22px 70px rgba(0,0,0,.25);font-family:Arial,sans-serif;color:#222}
      .wopt-ref-settings-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.wopt-ref-settings-head strong{font-size:18px}.wopt-ref-settings-head button{width:36px;height:36px;border:0;border-radius:50%;background:#f3f3f3;font-size:20px}
      .wopt-ref-setting{display:grid;gap:8px;margin:14px 0}.wopt-ref-setting label{font-size:12px;font-weight:800;color:#555}.wopt-ref-setting select{height:44px;border:1px solid #ddd;border-radius:12px;background:#fff;padding:0 12px;font-size:14px}.wopt-ref-setting input[type=range]{width:100%;accent-color:#3baaa8}
      .wopt-ref-font-preview{margin-top:14px;padding:16px;border-radius:14px;background:#f7f7f7;text-align:center;direction:rtl;font-family:var(--wopt-reference-quran-font,"Noto Naskh Arabic",serif);font-size:30px;line-height:1.7}
      .wopt-ref-setting-row{display:flex;justify-content:space-between;align-items:center;color:#777;font-size:11px}
      @media(max-width:700px){.wopt-ref-safe-actions.wopt-controls-ready{grid-template-columns:52px 52px 58px 1fr 1fr!important;gap:6px!important}.wopt-ref-safe-actions.wopt-controls-ready button{font-size:10px!important}.wopt-ref-settings-backdrop{padding:0 10px 10px}.wopt-ref-settings{padding:18px}}
    `;
    document.head.appendChild(style);

    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Lateef:wght@400;600&family=Noto+Naskh+Arabic:wght@400;600&family=Scheherazade+New:wght@400;600&display=swap";
    fontLink.dataset.woptQuranFonts = "true";
    document.head.appendChild(fontLink);

    let root: HTMLElement | null = null;
    let shell: HTMLElement | null = null;
    let settingsBackdrop: HTMLElement | null = null;
    let progressInput: HTMLInputElement | null = null;
    let elapsedNode: HTMLElement | null = null;
    let remainingNode: HTMLElement | null = null;
    let initialized = false;

    const applyFont = (font: string, size: number) => {
      root = document.querySelector<HTMLElement>(".quran-app");
      if (!root) return;
      root.style.setProperty("--wopt-reference-quran-font", `"${font}", "Noto Naskh Arabic", "Amiri", serif`);
      root.style.setProperty("--wopt-reference-quran-size", `${size}px`);
    };

    const savedFont = window.localStorage.getItem(FONT_KEY) || "Noto Naskh Arabic";
    const savedSize = Math.max(22, Math.min(42, Number(window.localStorage.getItem(SIZE_KEY) || 28)));
    applyFont(savedFont, savedSize);

    const cleanDuplicateNumbers = () => {
      document.querySelectorAll<HTMLElement>(".mushaf-text .quran-word").forEach((word) => {
        const text = word.textContent || "";
        word.classList.toggle("wopt-ref-duplicate-number", isNumberOnly(text));
      });
    };

    const buildSettings = () => {
      if (settingsBackdrop) return;
      settingsBackdrop = document.createElement("div");
      settingsBackdrop.className = "wopt-ref-settings-backdrop";
      settingsBackdrop.innerHTML = `
        <section class="wopt-ref-settings" role="dialog" aria-modal="true" aria-label="Qur’an reader settings">
          <div class="wopt-ref-settings-head"><strong>Reader settings</strong><button type="button" data-ref-settings="close">×</button></div>
          <div class="wopt-ref-setting"><label for="wopt-quran-font">Arabic font</label><select id="wopt-quran-font">${FONTS.map((font) => `<option value="${font.value}">${font.label}</option>`).join("")}</select></div>
          <div class="wopt-ref-setting"><div class="wopt-ref-setting-row"><label for="wopt-quran-size">Font size</label><span data-ref-size-label>${savedSize}px</span></div><input id="wopt-quran-size" type="range" min="22" max="42" step="1" value="${savedSize}"></div>
          <div class="wopt-ref-font-preview">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        </section>`;
      document.body.appendChild(settingsBackdrop);
      const select = settingsBackdrop.querySelector<HTMLSelectElement>("#wopt-quran-font");
      const size = settingsBackdrop.querySelector<HTMLInputElement>("#wopt-quran-size");
      const sizeLabel = settingsBackdrop.querySelector<HTMLElement>("[data-ref-size-label]");
      if (select) select.value = savedFont;
      select?.addEventListener("change", () => {
        const value = select.value;
        window.localStorage.setItem(FONT_KEY, value);
        applyFont(value, Number(size?.value || savedSize));
      });
      size?.addEventListener("input", () => {
        const value = Number(size.value);
        if (sizeLabel) sizeLabel.textContent = `${value}px`;
        window.localStorage.setItem(SIZE_KEY, String(value));
        applyFont(select?.value || savedFont, value);
      });
      settingsBackdrop.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target === settingsBackdrop || target.closest("[data-ref-settings='close']")) settingsBackdrop?.classList.remove("open");
      });
    };

    const initializeVisibleControls = () => {
      shell = document.querySelector<HTMLElement>(".wopt-ref-safe");
      root = document.querySelector<HTMLElement>(".quran-app");
      if (!shell || !root) return false;
      const actions = shell.querySelector<HTMLElement>(".wopt-ref-safe-actions");
      if (!actions) return false;
      actions.classList.add("wopt-controls-ready");
      if (!actions.querySelector("[data-ref-extra='stop']")) {
        const stop = document.createElement("button");
        stop.type = "button";
        stop.className = "wopt-stop";
        stop.dataset.refExtra = "stop";
        stop.textContent = "■";
        stop.setAttribute("aria-label", "Stop audio");
        const info = actions.querySelector("[data-ref='info']");
        actions.insertBefore(stop, info || actions.children[1] || null);
      }
      if (!shell.querySelector(".wopt-ref-audio-progress")) {
        const progress = document.createElement("div");
        progress.className = "wopt-ref-audio-progress";
        progress.innerHTML = `<span data-ref-elapsed>0:00</span><input type="range" min="0" max="1000" value="0" aria-label="Audio progress"><span data-ref-remaining>-0:00</span>`;
        actions.insertAdjacentElement("afterend", progress);
        progressInput = progress.querySelector("input");
        elapsedNode = progress.querySelector("[data-ref-elapsed]");
        remainingNode = progress.querySelector("[data-ref-remaining]");
        progressInput?.addEventListener("input", () => {
          const hidden = document.querySelector<HTMLInputElement>(".wopt-quran-player [data-player='progress']");
          if (!hidden || !progressInput) return;
          hidden.value = progressInput.value;
          hidden.dispatchEvent(new Event("input", { bubbles: true }));
        });
        progressInput?.addEventListener("change", () => {
          const hidden = document.querySelector<HTMLInputElement>(".wopt-quran-player [data-player='progress']");
          if (!hidden || !progressInput) return;
          hidden.value = progressInput.value;
          hidden.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }
      buildSettings();
      initialized = true;
      return true;
    };

    const hiddenTranslationButton = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".quran-reader-toolbar button")).find((button) => /^Translation$/i.test((button.textContent || "").trim()));

    const syncControls = () => {
      if (!initialized && !initializeVisibleControls()) return;
      cleanDuplicateNumbers();

      const hiddenPlay = document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='play']");
      const visiblePlay = shell?.querySelector<HTMLButtonElement>("[data-ref='play']");
      const hiddenStop = document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='stop']");
      const visibleStop = shell?.querySelector<HTMLButtonElement>("[data-ref-extra='stop']");
      const playText = hiddenPlay?.textContent || "▶ Play";
      const isPaused = /resume/i.test(playText);
      const isPlaying = /pause/i.test(playText);
      if (visiblePlay) {
        visiblePlay.textContent = isPlaying ? "❚❚" : "▶";
        visiblePlay.setAttribute("aria-label", isPlaying ? "Pause audio" : isPaused ? "Resume audio" : "Play audio");
        visiblePlay.classList.toggle("wopt-audio-active", isPlaying || isPaused);
      }
      visibleStop?.classList.toggle("wopt-audio-active", Boolean(hiddenStop && (isPlaying || isPaused)));

      const hiddenProgress = document.querySelector<HTMLInputElement>(".wopt-quran-player [data-player='progress']");
      const hiddenElapsed = document.querySelector<HTMLElement>(".wopt-quran-player [data-player='elapsed']");
      const hiddenRemaining = document.querySelector<HTMLElement>(".wopt-quran-player [data-player='remaining']");
      if (progressInput && hiddenProgress && document.activeElement !== progressInput) progressInput.value = hiddenProgress.value;
      if (elapsedNode) elapsedNode.textContent = hiddenElapsed?.textContent || "0:00";
      if (remainingNode) remainingNode.textContent = hiddenRemaining?.textContent || "-0:00";

      const translationOn = hiddenTranslationButton()?.classList.contains("active") || false;
      const arabicButton = shell?.querySelector<HTMLButtonElement>("[data-ref='arabic']");
      const translationButton = shell?.querySelector<HTMLButtonElement>("[data-ref='translation']");
      arabicButton?.classList.toggle("active", !translationOn);
      translationButton?.classList.toggle("active", translationOn);
    };

    const onCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const settings = target.closest<HTMLElement>("[data-ref='settings']");
      if (settings) {
        event.preventDefault();
        event.stopPropagation();
        buildSettings();
        settingsBackdrop?.classList.add("open");
        return;
      }
      const play = target.closest<HTMLElement>("[data-ref='play']");
      if (play) {
        event.preventDefault();
        event.stopPropagation();
        document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='play']")?.click();
        window.setTimeout(syncControls, 40);
        return;
      }
      const stop = target.closest<HTMLElement>("[data-ref-extra='stop']");
      if (stop) {
        event.preventDefault();
        event.stopPropagation();
        document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='stop']")?.click();
        window.setTimeout(syncControls, 40);
        return;
      }
      const translation = target.closest<HTMLElement>("[data-ref='translation']");
      if (translation) {
        event.preventDefault();
        event.stopPropagation();
        const source = hiddenTranslationButton();
        if (source && !source.classList.contains("active")) source.click();
        window.setTimeout(syncControls, 60);
        return;
      }
      const arabic = target.closest<HTMLElement>("[data-ref='arabic']");
      if (arabic) {
        event.preventDefault();
        event.stopPropagation();
        const source = hiddenTranslationButton();
        if (source?.classList.contains("active")) source.click();
        window.setTimeout(syncControls, 60);
      }
    };

    document.addEventListener("click", onCapture, true);
    const timer = window.setInterval(syncControls, 250);
    syncControls();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onCapture, true);
      settingsBackdrop?.remove();
      style.remove();
      fontLink.remove();
      root?.style.removeProperty("--wopt-reference-quran-font");
      root?.style.removeProperty("--wopt-reference-quran-size");
    };
  }, [pathname]);

  return null;
}
