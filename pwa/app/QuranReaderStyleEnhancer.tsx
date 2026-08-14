"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type ReaderLayout = "book" | "flow" | "cards" | "compact";
type ReaderFont = "mushaf" | "naskh" | "traditional" | "modern";

type ReaderStyleSettings = {
  layout: ReaderLayout;
  font: ReaderFont;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  pageColor: string;
};

const STORAGE_KEY = "wopt-quran-reader-style-v3";

const DEFAULTS: ReaderStyleSettings = {
  layout: "book",
  font: "mushaf",
  fontSize: 29,
  lineHeight: 1.72,
  textColor: "#151713",
  pageColor: "#fffaf0",
};

const FONT_STACKS: Record<ReaderFont, string> = {
  mushaf: '"KFGQPC Uthman Taha Naskh","UthmanicHafs","Noto Naskh Arabic","Amiri Quran","Traditional Arabic",serif',
  naskh: '"Noto Naskh Arabic","Amiri","Traditional Arabic",serif',
  traditional: '"Traditional Arabic","Arabic Typesetting","Times New Roman",serif',
  modern: '"Segoe UI","Tahoma","Arial",sans-serif',
};

function loadSettings(): ReaderStyleSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ReaderStyleSettings>;
    return {
      layout: (["book", "flow", "cards", "compact"] as string[]).includes(parsed.layout || "") ? parsed.layout as ReaderLayout : DEFAULTS.layout,
      font: (["mushaf", "naskh", "traditional", "modern"] as string[]).includes(parsed.font || "") ? parsed.font as ReaderFont : DEFAULTS.font,
      fontSize: Math.max(22, Math.min(72, Number(parsed.fontSize) || DEFAULTS.fontSize)),
      lineHeight: Math.max(1.2, Math.min(2.8, Number(parsed.lineHeight) || DEFAULTS.lineHeight)),
      textColor: /^#[0-9a-f]{6}$/i.test(parsed.textColor || "") ? parsed.textColor! : DEFAULTS.textColor,
      pageColor: /^#[0-9a-f]{6}$/i.test(parsed.pageColor || "") ? parsed.pageColor! : DEFAULTS.pageColor,
    };
  } catch {
    return DEFAULTS;
  }
}

export default function QuranReaderStyleEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptReaderStyle = "true";
    style.textContent = `
      .wopt-reader-style-button{min-height:38px;padding:0 13px;border:1px solid var(--q-green)!important;border-radius:12px;background:rgba(11,91,71,.07)!important;color:var(--q-green)!important;font-size:10px!important;font-weight:850!important;white-space:nowrap}
      .wopt-reader-style-backdrop{position:fixed;z-index:90;inset:0;background:rgba(5,26,20,.42);backdrop-filter:blur(5px);display:flex;align-items:flex-end;justify-content:center;padding:18px}
      .wopt-reader-style-panel{width:min(760px,100%);max-height:min(88dvh,820px);overflow:auto;border:1px solid var(--q-line);border-radius:26px;background:var(--q-paper);color:var(--q-ink);box-shadow:0 28px 90px rgba(5,38,29,.32);padding:22px}
      .wopt-style-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:16px;border-bottom:1px solid var(--q-line)}
      .wopt-style-head p{margin:0 0 4px;color:var(--q-green);font-size:9px;font-weight:900;letter-spacing:.16em}.wopt-style-head h2{margin:0;font-size:25px;letter-spacing:-.035em}.wopt-style-head span{display:block;margin-top:5px;color:var(--q-muted);font-size:10px;line-height:1.5}
      .wopt-style-close{width:40px;height:40px;border:1px solid var(--q-line);border-radius:50%;background:transparent;color:var(--q-ink);font-size:21px}
      .wopt-style-section{padding:18px 0;border-bottom:1px solid var(--q-line)}.wopt-style-section:last-of-type{border-bottom:0}.wopt-style-section>strong{display:block;margin-bottom:10px;font-size:12px}.wopt-style-section>small{display:block;margin:-5px 0 12px;color:var(--q-muted);font-size:9px;line-height:1.5}
      .wopt-layout-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.wopt-layout-card{min-height:86px;padding:11px;border:1px solid var(--q-line);border-radius:15px;background:transparent;color:var(--q-ink);text-align:left}.wopt-layout-card.active{border-color:var(--q-green);background:rgba(11,91,71,.08);box-shadow:0 0 0 2px rgba(11,91,71,.08)}.wopt-layout-card b{display:block;font-size:11px}.wopt-layout-card span{display:block;margin-top:5px;color:var(--q-muted);font-size:8px;line-height:1.45}.wopt-layout-preview{height:28px;margin-bottom:8px;border-radius:7px;background:repeating-linear-gradient(180deg,currentColor 0 2px,transparent 2px 7px);opacity:.22}
      .wopt-style-row{display:grid;grid-template-columns:155px 1fr;gap:16px;align-items:center;margin-top:12px}.wopt-style-row label{font-size:10px;font-weight:780}.wopt-style-row select,.wopt-style-row input[type=range]{width:100%}.wopt-style-row select{min-height:40px;padding:0 11px;border:1px solid var(--q-line);border-radius:12px;background:transparent;color:var(--q-ink)}
      .wopt-size-control{display:grid;grid-template-columns:38px 1fr 38px 52px;gap:8px;align-items:center}.wopt-size-control button{height:38px;border:1px solid var(--q-line);border-radius:10px;background:transparent;color:var(--q-ink);font-size:18px}.wopt-size-control output{font-size:10px;text-align:right;color:var(--q-muted)}
      .wopt-color-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.wopt-color-box{padding:12px;border:1px solid var(--q-line);border-radius:14px}.wopt-color-box label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px;font-weight:780}.wopt-color-box input[type=color]{width:48px;height:34px;padding:2px;border:1px solid var(--q-line);border-radius:9px;background:transparent}
      .wopt-preset-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.wopt-preset-row button{min-height:34px;padding:0 11px;border:1px solid var(--q-line);border-radius:10px;background:transparent;color:var(--q-ink);font-size:9px;font-weight:780}
      .wopt-style-footer{display:flex;justify-content:space-between;gap:10px;padding-top:18px}.wopt-style-footer button{min-height:42px;padding:0 15px;border:1px solid var(--q-line);border-radius:12px;background:transparent;color:var(--q-ink);font-size:10px;font-weight:800}.wopt-style-footer .primary{margin-left:auto;border-color:var(--q-green);background:var(--q-green);color:#fff}

      .quran-app.wopt-layout-book{--q-green:#11866f!important;--q-line:#ddd5c6!important}
      .quran-app.wopt-layout-book .mushaf-shell{max-width:760px!important;margin-top:20px!important;padding:0 18px 22px!important;border:1px solid #ddd5c6!important;border-radius:4px!important;background:var(--wopt-page-color)!important;box-shadow:0 9px 32px rgba(58,48,28,.08)!important}
      .quran-app.wopt-layout-book .mushaf-page-head{min-height:44px!important;padding:0 2px!important;color:#696b73!important;border-bottom:0!important;font-size:10px!important;text-transform:none!important;letter-spacing:0!important}
      .quran-app.wopt-layout-book .mushaf-page-head span:nth-child(2){display:none!important}
      .quran-app.wopt-layout-book .enhanced-surah-title{margin:4px 0 10px!important;padding:9px 14px 13px!important;border:1px solid #2b8d77!important;background:linear-gradient(90deg,transparent,rgba(17,134,111,.055),transparent)!important}
      .quran-app.wopt-layout-book .enhanced-surah-title .surah-ornament{font-size:8px!important;letter-spacing:.12em!important}.quran-app.wopt-layout-book .enhanced-surah-title .surah-ornament:before,.quran-app.wopt-layout-book .enhanced-surah-title .surah-ornament:after{background:#2b8d77!important}
      .quran-app.wopt-layout-book .enhanced-surah-title h2{margin:4px 0 0!important;font-size:24px!important;color:#151713!important}.quran-app.wopt-layout-book .enhanced-surah-title .surah-english{font-size:9px!important}.quran-app.wopt-layout-book .enhanced-surah-title .bismillah{margin:12px 0 0!important;font-size:24px!important;line-height:1.45!important;color:#151713!important}.quran-app.wopt-layout-book .enhanced-surah-title .audio-hint{display:none!important}
      .quran-app.wopt-layout-book .mushaf-text{padding:14px 0 24px!important;direction:rtl!important;text-align:justify!important;text-align-last:auto!important;font-size:var(--wopt-reader-size)!important;line-height:var(--wopt-reader-line)!important;word-spacing:-.04em!important;color:var(--wopt-reader-color)!important}
      .quran-app.wopt-layout-book .mushaf-ayah{display:inline!important;border-radius:5px!important}.quran-app.wopt-layout-book .quran-word{padding:0 .015em!important;border-radius:3px!important;color:var(--wopt-reader-color)!important}
      .quran-app.wopt-layout-book .ayah-marker{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:1.72em!important;height:1.72em!important;margin:0 .16em!important;padding:0 .18em!important;border:1.4px solid #11866f!important;border-radius:999px!important;color:#11866f!important;background:transparent!important;font-size:.48em!important;font-weight:700!important;line-height:1!important;vertical-align:.18em!important;white-space:nowrap!important}
      .quran-app.wopt-layout-book .mushaf-page-foot{min-height:40px!important;color:#6d6d73!important;border-top:0!important;font-size:10px!important;text-transform:none!important;letter-spacing:0!important}
      .quran-app.wopt-layout-book .inline-translation,.quran-app.wopt-layout-book .inline-transliteration{display:block!important;margin:10px 0 16px!important;font-size:11px!important;line-height:1.55!important}
      .quran-app.wopt-layout-flow .mushaf-shell{max-width:1080px!important;border-radius:24px!important}.quran-app.wopt-layout-flow .mushaf-text{text-align:justify!important;text-align-last:center!important}.quran-app.wopt-layout-flow .mushaf-ayah{display:inline!important}
      .quran-app.wopt-layout-cards .mushaf-text{padding:24px 0 34px!important;text-align:right!important}.quran-app.wopt-layout-cards .mushaf-ayah{display:block!important;margin:0 0 12px!important;padding:16px 18px!important;border:1px solid var(--q-line)!important;border-radius:16px!important;background:color-mix(in srgb,var(--wopt-page-color) 94%,var(--q-green) 6%)!important}.quran-app.wopt-layout-cards .ayah-marker{float:left;margin:.1em .25em .1em .5em!important}
      .quran-app.wopt-layout-compact .mushaf-shell{max-width:980px!important}.quran-app.wopt-layout-compact .mushaf-text{padding:24px 8px 34px!important}.quran-app.wopt-layout-compact .mushaf-ayah{display:inline!important}
      .quran-app .mushaf-shell{background:var(--wopt-page-color)!important}.quran-app .mushaf-text,.quran-app .quran-word{font-family:var(--wopt-reader-font)!important;color:var(--wopt-reader-color)!important}.quran-app .mushaf-text{font-size:var(--wopt-reader-size)!important;line-height:var(--wopt-reader-line)!important}.quran-app .quran-word,.quran-app .ayah-marker{line-height:inherit}.quran-app:not(.wopt-layout-book) .ayah-marker{font-size:inherit}.quran-app .ayah-marker{color:var(--q-green)!important}
      @media(max-width:700px){.wopt-reader-style-backdrop{padding:0}.wopt-reader-style-panel{border-radius:24px 24px 0 0;padding:18px 15px max(22px,env(safe-area-inset-bottom));max-height:90dvh}.wopt-layout-grid{grid-template-columns:1fr 1fr}.wopt-style-row{grid-template-columns:1fr;gap:7px}.wopt-color-row{grid-template-columns:1fr}.quran-app.wopt-layout-book .mushaf-shell{margin-left:-7px!important;margin-right:-7px!important;padding:0 10px 18px!important}.quran-app.wopt-layout-book .mushaf-text{padding:11px 0 22px!important;font-size:var(--wopt-reader-size)!important}.quran-app.wopt-layout-book .enhanced-surah-title{padding:7px 10px 10px!important}.quran-app.wopt-layout-book .enhanced-surah-title h2{font-size:22px!important}.quran-app.wopt-layout-book .enhanced-surah-title .bismillah{font-size:22px!important}}
    `;
    document.head.appendChild(style);

    const app = document.querySelector<HTMLElement>(".quran-app");
    if (!app) { style.remove(); return; }

    let settings = loadSettings();
    let panel: HTMLElement | null = null;

    const apply = () => {
      app.classList.remove("wopt-layout-book", "wopt-layout-flow", "wopt-layout-cards", "wopt-layout-compact");
      app.classList.add(`wopt-layout-${settings.layout}`);
      app.style.setProperty("--wopt-reader-font", FONT_STACKS[settings.font]);
      app.style.setProperty("--wopt-reader-size", `${settings.fontSize}px`);
      app.style.setProperty("--wopt-reader-line", String(settings.lineHeight));
      app.style.setProperty("--wopt-reader-color", settings.textColor);
      app.style.setProperty("--wopt-page-color", settings.pageColor);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      if (panel) renderPanelBody();
    };

    const set = (patch: Partial<ReaderStyleSettings>) => {
      settings = { ...settings, ...patch };
      apply();
    };

    const layoutLabel: Record<ReaderLayout, [string, string]> = {
      book: ["Book", "Printed Mushaf-style page"],
      flow: ["Flow", "Spacious centered reading"],
      cards: ["Verse cards", "One ayah per clear block"],
      compact: ["Compact", "More Qur’an on each screen"],
    };

    const renderPanelBody = () => {
      if (!panel) return;
      const body = panel.querySelector<HTMLElement>("[data-style-body]");
      if (!body) return;
      body.innerHTML = `
        <section class="wopt-style-section"><strong>Reading layout</strong><small>Book is the default and is tuned to look much closer to a printed Mushaf page.</small><div class="wopt-layout-grid">${(Object.keys(layoutLabel) as ReaderLayout[]).map((key) => `<button type="button" class="wopt-layout-card ${settings.layout === key ? "active" : ""}" data-layout="${key}"><div class="wopt-layout-preview"></div><b>${layoutLabel[key][0]}</b><span>${layoutLabel[key][1]}</span></button>`).join("")}</div></section>
        <section class="wopt-style-section"><strong>Arabic typography</strong>
          <div class="wopt-style-row"><label>Font style</label><select data-style="font"><option value="mushaf" ${settings.font === "mushaf" ? "selected" : ""}>Mushaf / Uthmani</option><option value="naskh" ${settings.font === "naskh" ? "selected" : ""}>Naskh</option><option value="traditional" ${settings.font === "traditional" ? "selected" : ""}>Traditional Arabic</option><option value="modern" ${settings.font === "modern" ? "selected" : ""}>Modern Arabic</option></select></div>
          <div class="wopt-style-row"><label>Text size</label><div class="wopt-size-control"><button type="button" data-size-step="-2">−</button><input data-style="fontSize" type="range" min="22" max="72" step="1" value="${settings.fontSize}"><button type="button" data-size-step="2">+</button><output>${settings.fontSize}px</output></div></div>
          <div class="wopt-style-row"><label>Line spacing</label><div class="wopt-size-control"><button type="button" data-line-step="-0.1">−</button><input data-style="lineHeight" type="range" min="1.2" max="2.8" step="0.05" value="${settings.lineHeight}"><button type="button" data-line-step="0.1">+</button><output>${settings.lineHeight.toFixed(2)}</output></div></div>
        </section>
        <section class="wopt-style-section"><strong>Page & text colors</strong><small>Choose any colors or use one of the quick presets.</small><div class="wopt-color-row"><div class="wopt-color-box"><label>Qur’an text <input data-style="textColor" type="color" value="${settings.textColor}"></label></div><div class="wopt-color-box"><label>Page <input data-style="pageColor" type="color" value="${settings.pageColor}"></label></div></div><div class="wopt-preset-row"><button type="button" data-preset="classic">Classic book</button><button type="button" data-preset="cream">Warm cream</button><button type="button" data-preset="green">Soft green</button><button type="button" data-preset="dark">Dark reading</button></div></section>
      `;
    };

    const closePanel = () => { panel?.parentElement?.remove(); panel = null; };

    const openPanel = () => {
      closePanel();
      const backdrop = document.createElement("div");
      backdrop.className = "wopt-reader-style-backdrop";
      backdrop.innerHTML = `<section class="wopt-reader-style-panel"><div class="wopt-style-head"><div><p>QUR’AN READER</p><h2>Layout & text style</h2><span>Make the page comfortable for your eyes. Changes save automatically.</span></div><button class="wopt-style-close" type="button" aria-label="Close">×</button></div><div data-style-body></div><div class="wopt-style-footer"><button type="button" data-style-reset>Reset to Book Default</button><button class="primary" type="button" data-style-done>Done</button></div></section>`;
      document.body.appendChild(backdrop);
      panel = backdrop.querySelector<HTMLElement>(".wopt-reader-style-panel");
      renderPanelBody();

      backdrop.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target === backdrop || target.closest(".wopt-style-close") || target.closest("[data-style-done]")) { closePanel(); return; }
        const layout = target.closest<HTMLElement>("[data-layout]")?.dataset.layout as ReaderLayout | undefined;
        if (layout) { set({ layout }); return; }
        const step = target.closest<HTMLElement>("[data-size-step]")?.dataset.sizeStep;
        if (step) { set({ fontSize: Math.max(22, Math.min(72, settings.fontSize + Number(step))) }); return; }
        const lineStep = target.closest<HTMLElement>("[data-line-step]")?.dataset.lineStep;
        if (lineStep) { set({ lineHeight: Math.max(1.2, Math.min(2.8, Number((settings.lineHeight + Number(lineStep)).toFixed(2)))) }); return; }
        if (target.closest("[data-style-reset]")) { settings = { ...DEFAULTS }; apply(); return; }
        const preset = target.closest<HTMLElement>("[data-preset]")?.dataset.preset;
        if (preset === "classic") set({ textColor: "#151713", pageColor: "#fffaf0" });
        if (preset === "cream") set({ textColor: "#232019", pageColor: "#fbf1d8" });
        if (preset === "green") set({ textColor: "#17342c", pageColor: "#f4f8f3" });
        if (preset === "dark") set({ textColor: "#edf7f2", pageColor: "#102b24" });
      });

      backdrop.addEventListener("input", (event) => {
        const input = event.target as HTMLInputElement | HTMLSelectElement;
        const key = input.dataset.style;
        if (key === "font") set({ font: input.value as ReaderFont });
        if (key === "fontSize") set({ fontSize: Number(input.value) });
        if (key === "lineHeight") set({ lineHeight: Number(input.value) });
        if (key === "textColor") set({ textColor: input.value });
        if (key === "pageColor") set({ pageColor: input.value });
      });
    };

    const addButton = () => {
      const toolbar = document.querySelector<HTMLElement>(".quran-reader-toolbar");
      if (!toolbar || toolbar.querySelector(".wopt-reader-style-button")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wopt-reader-style-button";
      button.textContent = "Aa Reader";
      button.addEventListener("click", openPanel);
      toolbar.insertAdjacentElement("afterbegin", button);
    };

    apply();
    addButton();
    const observer = new MutationObserver(addButton);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      closePanel();
      document.querySelector(".wopt-reader-style-button")?.remove();
      app.classList.remove("wopt-layout-book", "wopt-layout-flow", "wopt-layout-cards", "wopt-layout-compact");
      style.remove();
    };
  }, [pathname]);

  return null;
}
