"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SETTINGS_KEY = "wopt-quran-reference-reader-v2";

type ReaderPrefs = {
  font: string;
  size: number;
  lineHeight: number;
  align: "center" | "justify" | "right";
  width: "compact" | "standard" | "wide";
  theme: "white" | "cream" | "sepia" | "night";
  textColor: string;
  translationSize: number;
  transliterationSize: number;
};

const DEFAULT_PREFS: ReaderPrefs = {
  font: "Noto Naskh Arabic",
  size: 28,
  lineHeight: 1.95,
  align: "center",
  width: "standard",
  theme: "white",
  textColor: "#111111",
  translationSize: 14,
  transliterationSize: 14,
};

const FONTS = [
  "Noto Naskh Arabic",
  "Amiri",
  "Scheherazade New",
  "Lateef",
  "Traditional Arabic",
];

function loadPrefs(): ReaderPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}") } as ReaderPrefs;
  } catch {
    return DEFAULT_PREFS;
  }
}

function isNumberOnly(value: string) {
  const normalized = value.trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
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
      .quran-app.wopt-reference-safe .mushaf-shell{max-width:var(--wopt-reader-width,760px)!important;background:var(--wopt-reader-bg,#fff)!important}
      .quran-app.wopt-reference-safe .mushaf-text{font-family:var(--wopt-reader-font,"Noto Naskh Arabic","Amiri",serif)!important;font-size:var(--wopt-reader-size,28px)!important;line-height:var(--wopt-reader-line,1.95)!important;text-align:var(--wopt-reader-align,center)!important;color:var(--wopt-reader-color,#111)!important;background:var(--wopt-reader-bg,#fff)!important}
      .quran-app.wopt-reference-safe .wopt-ref-safe-bismillah .ar,.quran-app.wopt-reference-safe .wopt-ref-safe-ar{font-family:var(--wopt-reader-font,"Noto Naskh Arabic","Amiri",serif)!important;color:var(--wopt-reader-color,#111)!important}
      .quran-app.wopt-reference-safe .inline-translation{font-size:var(--wopt-translation-size,14px)!important}
      .quran-app.wopt-reference-safe .inline-transliteration{font-size:var(--wopt-translit-size,14px)!important}
      .quran-app.wopt-reference-safe.wopt-theme-night,.quran-app.wopt-reference-safe.wopt-theme-night .wopt-ref-safe,.quran-app.wopt-reference-safe.wopt-theme-night .wopt-ref-safe-tabs button{background:#101b18!important;color:#f4f7f6!important}
      .quran-app.wopt-reference-safe.wopt-theme-night .wopt-ref-safe-card{background:#182622!important;color:#f4f7f6!important}.quran-app.wopt-reference-safe.wopt-theme-night .wopt-ref-safe-title span,.quran-app.wopt-reference-safe.wopt-theme-night .wopt-ref-safe-desc,.quran-app.wopt-reference-safe.wopt-theme-night .wopt-ref-safe-bismillah .en{color:#b7c3bf!important}
      .wopt-ref-safe-actions.wopt-controls-ready{grid-template-columns:58px 58px 1fr!important}
      .wopt-ref-safe-actions .wopt-stop{color:#666!important}.wopt-ref-safe-actions .wopt-audio-active{background:#e9f7f4!important;border-color:#47aaa7!important;color:#167d7b!important}
      .wopt-ref-text-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:11px}.wopt-ref-text-modes button{min-height:40px;border:1px solid #e2e5e4;border-radius:20px;background:#fff;color:#39a3a1;font:750 11px/1.2 Arial,sans-serif;padding:0 8px;box-shadow:0 2px 7px rgba(0,0,0,.04)}.wopt-ref-text-modes button.active{background:#222;color:#fff;border-color:#222}
      .wopt-ref-audio-progress{display:grid;grid-template-columns:36px 1fr 42px;gap:8px;align-items:center;margin-top:13px;color:#777;font-size:10px}.wopt-ref-audio-progress input{width:100%;accent-color:#3baaa8}.wopt-ref-audio-progress span:last-child{text-align:right}
      .wopt-ref-play-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}.wopt-ref-play-modes button{min-height:38px;border:1px solid #e1e5e4;border-radius:12px;background:#fff;color:#555;font:700 11px/1.2 Arial,sans-serif;padding:0 10px}.wopt-ref-play-modes button.active{background:#e8f7f4;border-color:#3baaa8;color:#137b78}.wopt-ref-play-mode-note{margin:7px 2px 0;color:#777;font:10px/1.45 Arial,sans-serif}
      .wopt-ref-settings-backdrop{position:fixed;z-index:1400;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.3);padding:18px}.wopt-ref-settings-backdrop.open{display:flex}
      .wopt-ref-settings{width:min(570px,100%);max-height:min(82dvh,760px);overflow:auto;padding:20px;border-radius:22px 22px 14px 14px;background:#fff;box-shadow:0 22px 70px rgba(0,0,0,.28);font-family:Arial,sans-serif;color:#222}.wopt-ref-settings-head{position:sticky;top:-20px;z-index:2;display:flex;justify-content:space-between;align-items:center;margin:-20px -20px 12px;padding:20px;background:#fff;border-bottom:1px solid #eee}.wopt-ref-settings-head strong{font-size:19px}.wopt-ref-settings-head button{width:38px;height:38px;border:0;border-radius:50%;background:#f2f2f2;font-size:21px}
      .wopt-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.wopt-ref-setting{display:grid;gap:7px;margin:8px 0}.wopt-ref-setting.full{grid-column:1/-1}.wopt-ref-setting label,.wopt-ref-setting .setting-label{font-size:12px;font-weight:800;color:#555}.wopt-ref-setting select,.wopt-ref-setting input[type=color]{height:44px;border:1px solid #ddd;border-radius:12px;background:#fff;padding:0 11px;font-size:13px}.wopt-ref-setting input[type=color]{width:100%;padding:5px}.wopt-ref-setting input[type=range]{width:100%;accent-color:#3baaa8}.wopt-ref-setting-row{display:flex;justify-content:space-between;align-items:center;color:#777;font-size:11px}.wopt-ref-choice{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.wopt-ref-choice button{height:38px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#555;font-size:11px;font-weight:700}.wopt-ref-choice button.active{border-color:#35aaa8;background:#eaf7f5;color:#177b79}
      .wopt-ref-font-preview{grid-column:1/-1;margin-top:6px;padding:17px;border-radius:14px;background:var(--wopt-reader-bg,#f7f7f7);color:var(--wopt-reader-color,#111);text-align:center;direction:rtl;font-family:var(--wopt-reader-font,"Noto Naskh Arabic",serif);font-size:30px;line-height:1.65;border:1px solid #eee}.wopt-ref-reset{grid-column:1/-1;height:42px;border:1px solid #ddd;border-radius:12px;background:#fafafa;color:#555;font-weight:800}
      @media(max-width:700px){.wopt-ref-safe-actions.wopt-controls-ready{grid-template-columns:52px 52px 1fr!important;gap:6px!important}.wopt-ref-text-modes{gap:6px}.wopt-ref-text-modes button{font-size:10px}.wopt-ref-settings-backdrop{padding:0 8px 8px}.wopt-ref-settings{padding:18px}.wopt-ref-settings-head{top:-18px;margin:-18px -18px 10px;padding:18px}.wopt-settings-grid{grid-template-columns:1fr}.wopt-ref-setting.full,.wopt-ref-font-preview,.wopt-ref-reset{grid-column:1}.wopt-ref-play-modes button{font-size:10px}}
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
    let modeNote: HTMLElement | null = null;
    let initialized = false;
    let prefs = loadPrefs();

    const widthValue = (value: ReaderPrefs["width"]) => value === "compact" ? "620px" : value === "wide" ? "940px" : "760px";
    const bgValue = (value: ReaderPrefs["theme"]) => value === "cream" ? "#fffaf0" : value === "sepia" ? "#f6ecd7" : value === "night" ? "#101b18" : "#ffffff";

    const applyPrefs = () => {
      root = document.querySelector<HTMLElement>(".quran-app");
      if (!root) return;
      root.style.setProperty("--wopt-reader-font", `"${prefs.font}", "Noto Naskh Arabic", "Amiri", serif`);
      root.style.setProperty("--wopt-reader-size", `${prefs.size}px`);
      root.style.setProperty("--wopt-reader-line", String(prefs.lineHeight));
      root.style.setProperty("--wopt-reader-align", prefs.align);
      root.style.setProperty("--wopt-reader-width", widthValue(prefs.width));
      root.style.setProperty("--wopt-reader-bg", bgValue(prefs.theme));
      root.style.setProperty("--wopt-reader-color", prefs.theme === "night" ? "#f5f7f6" : prefs.textColor);
      root.style.setProperty("--wopt-translation-size", `${prefs.translationSize}px`);
      root.style.setProperty("--wopt-translit-size", `${prefs.transliterationSize}px`);
      root.classList.toggle("wopt-theme-night", prefs.theme === "night");
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
    };
    applyPrefs();

    const cleanDuplicateNumbers = () => {
      document.querySelectorAll<HTMLElement>(".mushaf-text .quran-word").forEach((word) => {
        word.classList.toggle("wopt-ref-duplicate-number", isNumberOnly(word.textContent || ""));
      });
    };

    const buildSettings = () => {
      if (settingsBackdrop) return;
      settingsBackdrop = document.createElement("div");
      settingsBackdrop.className = "wopt-ref-settings-backdrop";
      settingsBackdrop.innerHTML = `
        <section class="wopt-ref-settings" role="dialog" aria-modal="true" aria-label="Qur’an reader settings">
          <div class="wopt-ref-settings-head"><strong>Reader settings</strong><button type="button" data-setting-close>×</button></div>
          <div class="wopt-settings-grid">
            <div class="wopt-ref-setting full"><label>Arabic font</label><select data-setting="font">${FONTS.map((font) => `<option value="${font}">${font}</option>`).join("")}</select></div>
            <div class="wopt-ref-setting full"><div class="wopt-ref-setting-row"><label>Arabic size</label><span data-value="size"></span></div><input data-setting="size" type="range" min="20" max="46" step="1"></div>
            <div class="wopt-ref-setting full"><div class="wopt-ref-setting-row"><label>Line spacing</label><span data-value="lineHeight"></span></div><input data-setting="lineHeight" type="range" min="1.35" max="2.6" step="0.05"></div>
            <div class="wopt-ref-setting"><span class="setting-label">Alignment</span><div class="wopt-ref-choice" data-choice="align"><button data-value-choice="center">Center</button><button data-value-choice="justify">Justify</button><button data-value-choice="right">Right</button></div></div>
            <div class="wopt-ref-setting"><span class="setting-label">Page width</span><div class="wopt-ref-choice" data-choice="width"><button data-value-choice="compact">Compact</button><button data-value-choice="standard">Normal</button><button data-value-choice="wide">Wide</button></div></div>
            <div class="wopt-ref-setting"><label>Page tone</label><select data-setting="theme"><option value="white">White</option><option value="cream">Cream</option><option value="sepia">Sepia</option><option value="night">Night</option></select></div>
            <div class="wopt-ref-setting"><label>Arabic text color</label><input data-setting="textColor" type="color"></div>
            <div class="wopt-ref-setting full"><div class="wopt-ref-setting-row"><label>Translation size</label><span data-value="translationSize"></span></div><input data-setting="translationSize" type="range" min="11" max="22" step="1"></div>
            <div class="wopt-ref-setting full"><div class="wopt-ref-setting-row"><label>Arabic in English letters size</label><span data-value="transliterationSize"></span></div><input data-setting="transliterationSize" type="range" min="11" max="22" step="1"></div>
            <div class="wopt-ref-font-preview">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
            <button class="wopt-ref-reset" type="button" data-setting-reset>Reset reader defaults</button>
          </div>
        </section>`;
      document.body.appendChild(settingsBackdrop);

      const refreshForm = () => {
        settingsBackdrop?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]").forEach((control) => {
          const key = control.dataset.setting as keyof ReaderPrefs;
          control.value = String(prefs[key]);
        });
        settingsBackdrop?.querySelectorAll<HTMLElement>("[data-value]").forEach((node) => {
          const key = node.dataset.value as keyof ReaderPrefs;
          const value = prefs[key];
          node.textContent = key === "size" || key === "translationSize" || key === "transliterationSize" ? `${value}px` : String(value);
        });
        settingsBackdrop?.querySelectorAll<HTMLButtonElement>("[data-value-choice]").forEach((button) => {
          const group = button.closest<HTMLElement>("[data-choice]")?.dataset.choice as "align" | "width" | undefined;
          if (group) button.classList.toggle("active", prefs[group] === button.dataset.valueChoice);
        });
      };

      settingsBackdrop.addEventListener("input", (event) => {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        const key = target.dataset.setting as keyof ReaderPrefs | undefined;
        if (!key) return;
        if (key === "size" || key === "translationSize" || key === "transliterationSize" || key === "lineHeight") {
          (prefs as any)[key] = Number(target.value);
        } else {
          (prefs as any)[key] = target.value;
        }
        applyPrefs();
        refreshForm();
      });
      settingsBackdrop.addEventListener("change", (event) => {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        const key = target.dataset.setting as keyof ReaderPrefs | undefined;
        if (!key) return;
        (prefs as any)[key] = key === "size" || key === "translationSize" || key === "transliterationSize" || key === "lineHeight" ? Number(target.value) : target.value;
        applyPrefs();
        refreshForm();
      });
      settingsBackdrop.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target === settingsBackdrop || target.closest("[data-setting-close]")) { settingsBackdrop?.classList.remove("open"); return; }
        const choice = target.closest<HTMLButtonElement>("[data-value-choice]");
        if (choice) {
          const group = choice.closest<HTMLElement>("[data-choice]")?.dataset.choice as "align" | "width" | undefined;
          if (group) { (prefs as any)[group] = choice.dataset.valueChoice; applyPrefs(); refreshForm(); }
        }
        if (target.closest("[data-setting-reset]")) { prefs = { ...DEFAULT_PREFS }; applyPrefs(); refreshForm(); }
      });
      refreshForm();
    };

    const hiddenToggle = (label: "Translation" | "Transliteration") => Array.from(document.querySelectorAll<HTMLButtonElement>(".quran-reader-toolbar button")).find((button) => new RegExp(`^${label}$`, "i").test((button.textContent || "").trim()));
    const hiddenModeButton = (mode: "surah" | "quran") => document.querySelector<HTMLButtonElement>(`.wopt-quran-player [data-mode='${mode}']`);

    const initializeVisibleControls = () => {
      shell = document.querySelector<HTMLElement>(".wopt-ref-safe");
      root = document.querySelector<HTMLElement>(".quran-app");
      if (!shell || !root) return false;
      const actions = shell.querySelector<HTMLElement>(".wopt-ref-safe-actions");
      if (!actions) return false;
      actions.classList.add("wopt-controls-ready");

      const arabic = actions.querySelector<HTMLButtonElement>("[data-ref='arabic']");
      const translation = actions.querySelector<HTMLButtonElement>("[data-ref='translation']");
      let textModes = shell.querySelector<HTMLElement>(".wopt-ref-text-modes");
      if (!textModes) {
        textModes = document.createElement("div");
        textModes.className = "wopt-ref-text-modes";
        actions.insertAdjacentElement("afterend", textModes);
      }
      if (arabic && arabic.parentElement !== textModes) textModes.appendChild(arabic);
      if (translation && translation.parentElement !== textModes) textModes.appendChild(translation);
      if (!textModes.querySelector("[data-ref='transliteration']")) {
        const translit = document.createElement("button");
        translit.type = "button";
        translit.dataset.ref = "transliteration";
        translit.textContent = "Arabic → English letters";
        textModes.appendChild(translit);
      }

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
        textModes.insertAdjacentElement("afterend", progress);
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

      if (!shell.querySelector(".wopt-ref-play-modes")) {
        const modes = document.createElement("div");
        modes.className = "wopt-ref-play-modes";
        modes.innerHTML = `<button type="button" data-ref-mode="surah">Selected Surah</button><button type="button" data-ref-mode="quran">Full Qur’an</button>`;
        shell.querySelector(".wopt-ref-audio-progress")?.insertAdjacentElement("afterend", modes);
        modeNote = document.createElement("p");
        modeNote.className = "wopt-ref-play-mode-note";
        modes.insertAdjacentElement("afterend", modeNote);
      } else modeNote = shell.querySelector(".wopt-ref-play-mode-note");

      buildSettings();
      initialized = true;
      return true;
    };

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
      if (progressInput && hiddenProgress && document.activeElement !== progressInput) progressInput.value = hiddenProgress.value;
      if (elapsedNode) elapsedNode.textContent = document.querySelector<HTMLElement>(".wopt-quran-player [data-player='elapsed']")?.textContent || "0:00";
      if (remainingNode) remainingNode.textContent = document.querySelector<HTMLElement>(".wopt-quran-player [data-player='remaining']")?.textContent || "-0:00";

      const translationOn = hiddenToggle("Translation")?.classList.contains("active") || false;
      const translitOn = hiddenToggle("Transliteration")?.classList.contains("active") || false;
      shell?.querySelector("[data-ref='arabic']")?.classList.toggle("active", !translationOn && !translitOn);
      shell?.querySelector("[data-ref='translation']")?.classList.toggle("active", translationOn);
      shell?.querySelector("[data-ref='transliteration']")?.classList.toggle("active", translitOn);

      const fullQuranOn = hiddenModeButton("quran")?.classList.contains("active") || false;
      shell?.querySelector("[data-ref-mode='surah']")?.classList.toggle("active", !fullQuranOn);
      shell?.querySelector("[data-ref-mode='quran']")?.classList.toggle("active", fullQuranOn);
      if (modeNote) modeNote.textContent = fullQuranOn ? "Full Qur’an starts with the selected Surah and continues automatically through the remaining Surahs." : "Selected Surah plays only the Surah you are reading and stops at the end.";
    };

    const setTextMode = (mode: "arabic" | "translation" | "transliteration") => {
      const translation = hiddenToggle("Translation");
      const translit = hiddenToggle("Transliteration");
      if (mode === "arabic") {
        if (translation?.classList.contains("active")) translation.click();
        if (translit?.classList.contains("active")) translit.click();
      } else if (mode === "translation") {
        if (translit?.classList.contains("active")) translit.click();
        if (translation && !translation.classList.contains("active")) translation.click();
      } else {
        if (translation?.classList.contains("active")) translation.click();
        if (translit && !translit.classList.contains("active")) translit.click();
      }
      window.setTimeout(syncControls, 80);
    };

    const onCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-ref='settings']")) {
        event.preventDefault(); event.stopPropagation(); buildSettings(); settingsBackdrop?.classList.add("open"); return;
      }
      const mode = target.closest<HTMLElement>("[data-ref-mode]");
      if (mode) {
        event.preventDefault(); event.stopPropagation(); hiddenModeButton(mode.dataset.refMode === "quran" ? "quran" : "surah")?.click(); window.setTimeout(syncControls, 50); return;
      }
      if (target.closest("[data-ref='play']")) {
        event.preventDefault(); event.stopPropagation(); document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='play']")?.click(); window.setTimeout(syncControls, 50); return;
      }
      if (target.closest("[data-ref-extra='stop']")) {
        event.preventDefault(); event.stopPropagation(); document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='stop']")?.click(); window.setTimeout(syncControls, 50); return;
      }
      if (target.closest("[data-ref='arabic']")) { event.preventDefault(); event.stopPropagation(); setTextMode("arabic"); return; }
      if (target.closest("[data-ref='translation']")) { event.preventDefault(); event.stopPropagation(); setTextMode("translation"); return; }
      if (target.closest("[data-ref='transliteration']")) { event.preventDefault(); event.stopPropagation(); setTextMode("transliteration"); }
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
      root?.classList.remove("wopt-theme-night");
    };
  }, [pathname]);

  return null;
}
