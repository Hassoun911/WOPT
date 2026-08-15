"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranSmartPlayerEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptSmartPlayer = "true";
    style.textContent = `
      .wopt-ref-safe-card.wopt-smart-player{position:relative;transition:max-height .22s ease,padding .22s ease,box-shadow .22s ease,opacity .22s ease;overflow:hidden}
      .wopt-smart-mini{display:none;align-items:center;gap:10px;min-height:58px;padding:10px 12px;border-radius:16px;background:#f5f6f7;color:#222;box-shadow:0 2px 10px rgba(0,0,0,.04);font-family:Arial,sans-serif;cursor:pointer}
      .wopt-smart-mini button{width:40px;height:40px;border:1px solid #dce5e3;border-radius:50%;background:#fff;color:#2e9f9d;font-size:15px;font-weight:800}
      .wopt-smart-mini-main{min-width:0;flex:1}.wopt-smart-mini-main strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}.wopt-smart-mini-main span{display:block;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#707070;font-size:10px}
      .wopt-smart-mini-progress{width:74px;height:4px;border-radius:999px;background:#d9dfdd;overflow:hidden}.wopt-smart-mini-progress i{display:block;width:0;height:100%;background:#3baaa8}
      .wopt-smart-mini .chev{width:auto;height:auto;border:0;background:transparent;color:#666;font-size:18px;padding:6px}
      .wopt-ref-safe.wopt-player-collapsed .wopt-ref-safe-card{display:none!important}
      .wopt-ref-safe.wopt-player-collapsed .wopt-smart-mini{display:flex}
      .wopt-ref-safe:not(.wopt-player-collapsed) .wopt-smart-mini{display:none}
      @media(max-width:700px){.wopt-smart-mini{margin:10px 18px 18px}.wopt-smart-mini-progress{width:58px}}
    `;
    document.head.appendChild(style);

    let shell: HTMLElement | null = null;
    let card: HTMLElement | null = null;
    let mini: HTMLElement | null = null;
    let hideTimer: number | null = null;
    let initialized = false;

    const clearHide = () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = null;
    };

    const overlaysOpen = () => Boolean(document.querySelector(".wopt-ref-settings-backdrop.open,.wopt-verse-menu.open,.wopt-verse-translate-backdrop.open,.quran-drawer-backdrop,.memorize-overlay"));

    const collapse = () => {
      if (!shell || overlaysOpen()) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && card?.contains(active)) return;
      shell.classList.add("wopt-player-collapsed");
    };

    const scheduleCollapse = (delay = 4500) => {
      clearHide();
      hideTimer = window.setTimeout(collapse, delay);
    };

    const expand = () => {
      if (!shell) return;
      shell.classList.remove("wopt-player-collapsed");
      scheduleCollapse();
    };

    const init = () => {
      shell = document.querySelector<HTMLElement>(".wopt-ref-safe");
      card = shell?.querySelector<HTMLElement>(".wopt-ref-safe-card") || null;
      if (!shell || !card) return false;
      if (initialized) return true;
      initialized = true;
      card.classList.add("wopt-smart-player");

      mini = document.createElement("div");
      mini.className = "wopt-smart-mini";
      mini.setAttribute("role", "button");
      mini.setAttribute("tabindex", "0");
      mini.setAttribute("aria-label", "Open Qur’an audio controls");
      mini.innerHTML = `
        <button type="button" data-smart-play aria-label="Play or pause">▶</button>
        <div class="wopt-smart-mini-main"><strong data-smart-title>Qur’an audio</strong><span data-smart-reciter>Tap to open controls</span></div>
        <div class="wopt-smart-mini-progress" aria-hidden="true"><i></i></div>
        <button type="button" class="chev" data-smart-expand aria-label="Expand controls">⌄</button>`;
      card.insertAdjacentElement("beforebegin", mini);

      const openFromMini = (event: Event) => {
        const target = event.target as HTMLElement;
        if (target.closest("[data-smart-play]")) return;
        expand();
      };
      mini.addEventListener("click", openFromMini);
      mini.addEventListener("keydown", (event) => {
        if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
          event.preventDefault();
          expand();
        }
      });
      mini.querySelector("[data-smart-play]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='play']")?.click();
      });

      card.addEventListener("pointerdown", () => { clearHide(); });
      card.addEventListener("pointerup", () => scheduleCollapse());
      card.addEventListener("input", () => scheduleCollapse(7000));
      card.addEventListener("change", () => scheduleCollapse(7000));
      card.addEventListener("focusin", () => clearHide());
      card.addEventListener("focusout", () => scheduleCollapse(5500));

      // Start compact after the user has had a moment to see the controls.
      window.setTimeout(() => shell?.classList.add("wopt-player-collapsed"), 1200);
      return true;
    };

    const syncMini = () => {
      if (!init() || !mini) return;
      const title = mini.querySelector<HTMLElement>("[data-smart-title]");
      const reciter = mini.querySelector<HTMLElement>("[data-smart-reciter]");
      const play = mini.querySelector<HTMLButtonElement>("[data-smart-play]");
      const bar = mini.querySelector<HTMLElement>(".wopt-smart-mini-progress i");
      const cardTitle = document.querySelector<HTMLElement>(".wopt-ref-safe-title strong")?.textContent?.trim() || "Qur’an";
      const visibleReciter = document.querySelector<HTMLSelectElement>("#wopt-visible-reciter")?.selectedOptions[0]?.textContent?.trim()
        || document.querySelector<HTMLSelectElement>(".wopt-quran-player [data-player='reciter']")?.selectedOptions[0]?.textContent?.trim()
        || "Qur’an reciter";
      const hiddenPlay = document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='play']")?.textContent || "▶ Play";
      const hiddenProgress = document.querySelector<HTMLInputElement>(".wopt-quran-player [data-player='progress']");
      if (title) title.textContent = cardTitle;
      if (reciter) reciter.textContent = visibleReciter;
      if (play) play.textContent = /pause/i.test(hiddenPlay) ? "❚❚" : "▶";
      if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(hiddenProgress?.value || 0) / 10))}%`;

      // Keep full controls open while a modal/menu is active.
      if (overlaysOpen()) {
        clearHide();
        shell?.classList.remove("wopt-player-collapsed");
      }
    };

    const pageTouch = (event: PointerEvent) => {
      if (!shell || !initialized) return;
      const target = event.target as HTMLElement;
      if (target.closest(".wopt-smart-mini,.wopt-ref-safe-card,.wopt-ref-settings-backdrop,.wopt-verse-menu,.wopt-verse-translate-backdrop")) return;
      // A normal tap on the reading surface briefly reveals the player.
      expand();
      scheduleCollapse(3600);
    };

    document.addEventListener("pointerdown", pageTouch, { passive: true });
    const timer = window.setInterval(syncMini, 300);
    syncMini();

    return () => {
      clearHide();
      window.clearInterval(timer);
      document.removeEventListener("pointerdown", pageTouch);
      mini?.remove();
      shell?.classList.remove("wopt-player-collapsed");
      card?.classList.remove("wopt-smart-player");
      style.remove();
    };
  }, [pathname]);

  return null;
}
