"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranBookPolishEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptBookPolish = "true";
    style.textContent = `
      .wopt-player-collapse{display:none}
      .quran-app.wopt-layout-book .mushaf-shell{overflow:visible!important}
      .quran-app.wopt-layout-book .mushaf-page-head{min-height:38px!important;font-size:8px!important;border-bottom:1px solid rgba(18,69,55,.22)!important}
      .quran-app.wopt-layout-book .mushaf-page-head span:nth-child(2){display:none!important}
      .quran-app.wopt-layout-book .enhanced-surah-title{margin:0 -2px 6px!important;padding:13px 10px 14px!important;border:1px solid rgba(12,115,87,.55)!important;border-top:0!important;background:linear-gradient(180deg,rgba(11,91,71,.025),transparent)!important}
      .quran-app.wopt-layout-book .enhanced-surah-title .surah-ornament{font-size:8px!important;letter-spacing:.12em!important}
      .quran-app.wopt-layout-book .enhanced-surah-title .surah-ornament:before,.quran-app.wopt-layout-book .enhanced-surah-title .surah-ornament:after{width:40px!important}
      .quran-app.wopt-layout-book .enhanced-surah-title h2{margin:5px 0 0!important;font-size:25px!important;line-height:1.15!important}
      .quran-app.wopt-layout-book .enhanced-surah-title .surah-english{margin-top:2px!important;font-size:9px!important}
      .quran-app.wopt-layout-book .enhanced-surah-title .bismillah{margin:11px 0 0!important;font-size:23px!important;line-height:1.45!important}
      .quran-app.wopt-layout-book .enhanced-surah-title .audio-hint{display:none!important}
      .quran-app.wopt-layout-book .mushaf-text{padding-top:20px!important;padding-bottom:125px!important;word-spacing:.02em!important;letter-spacing:0!important}
      .quran-app.wopt-layout-book .quran-word{padding-inline:.015em!important;border-radius:3px!important}
      .quran-app.wopt-layout-book .ayah-marker{margin-inline:.08em!important;font-size:.78em!important;vertical-align:.08em!important}
      .quran-app.wopt-layout-book .mushaf-page-foot{min-height:42px!important;font-size:8px!important}

      @media(max-width:700px){
        .quran-app.wopt-layout-book{padding-bottom:calc(128px + env(safe-area-inset-bottom))!important}
        .quran-app.wopt-layout-book .mushaf-shell{margin-top:13px!important;margin-left:-7px!important;margin-right:-7px!important;padding-left:11px!important;padding-right:11px!important;padding-bottom:0!important;border-radius:3px!important;box-shadow:0 7px 24px rgba(38,33,21,.08)!important}
        .quran-app.wopt-layout-book .mushaf-text{padding-left:1px!important;padding-right:1px!important;padding-top:18px!important;padding-bottom:132px!important}
        .quran-app.wopt-layout-book .enhanced-surah-title{margin-left:-1px!important;margin-right:-1px!important;padding:11px 7px 12px!important}
        .quran-app.wopt-layout-book .enhanced-surah-title h2{font-size:23px!important}
        .quran-app.wopt-layout-book .enhanced-surah-title .bismillah{font-size:21px!important}

        .quran-app.wopt-layout-book .wopt-quran-player{top:6px!important;padding:8px 10px!important;border-radius:14px!important;box-shadow:0 10px 28px rgba(7,49,39,.18)!important}
        .quran-app.wopt-layout-book .wopt-player-top{grid-template-columns:1fr auto!important;gap:8px!important}
        .quran-app.wopt-layout-book .wopt-now-playing small{font-size:7px!important}
        .quran-app.wopt-layout-book .wopt-now-playing strong{font-size:12px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .quran-app.wopt-layout-book .wopt-now-playing span{font-size:8px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .quran-app.wopt-layout-book .wopt-player-collapse{display:grid;width:34px;height:34px;place-items:center;border:1px solid rgba(255,255,255,.22);border-radius:10px;background:rgba(255,255,255,.07);color:#fff;font-size:16px}
        .quran-app.wopt-layout-book .wopt-quran-player.wopt-player-compact .wopt-player-actions,
        .quran-app.wopt-layout-book .wopt-quran-player.wopt-player-compact .wopt-player-modes{display:none!important}
        .quran-app.wopt-layout-book .wopt-quran-player.wopt-player-compact .wopt-player-progress{margin-top:6px!important;grid-template-columns:31px 1fr 38px!important;gap:6px!important}
        .quran-app.wopt-layout-book .wopt-quran-player.wopt-player-compact .wopt-player-progress span{font-size:8px!important}
        .quran-app.wopt-layout-book .wopt-quran-player:not(.wopt-player-compact) .wopt-player-top{grid-template-columns:1fr auto!important}
        .quran-app.wopt-layout-book .wopt-quran-player:not(.wopt-player-compact) .wopt-player-actions{grid-column:1/-1;justify-content:flex-start!important}
        .quran-app.wopt-layout-book .wopt-quran-player:not(.wopt-player-compact) .wopt-player-actions select.reciter{max-width:180px!important}
        .quran-app.wopt-layout-book .quran-mobile-nav{bottom:max(8px,env(safe-area-inset-bottom))!important;height:68px!important}
      }
    `;
    document.head.appendChild(style);

    const enhancePlayer = () => {
      const player = document.querySelector<HTMLElement>(".wopt-quran-player");
      if (!player || player.querySelector(".wopt-player-collapse")) return;
      player.classList.add("wopt-player-compact");
      const top = player.querySelector<HTMLElement>(".wopt-player-top");
      if (!top) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wopt-player-collapse";
      button.setAttribute("aria-label", "Expand audio player");
      button.textContent = "⌄";
      button.addEventListener("click", () => {
        const compact = player.classList.toggle("wopt-player-compact");
        button.textContent = compact ? "⌄" : "⌃";
        button.setAttribute("aria-label", compact ? "Expand audio player" : "Collapse audio player");
      });
      top.appendChild(button);
    };

    enhancePlayer();
    const observer = new MutationObserver(enhancePlayer);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelector(".wopt-player-collapse")?.remove();
      document.querySelector(".wopt-quran-player")?.classList.remove("wopt-player-compact");
      style.remove();
    };
  }, [pathname]);

  return null;
}
