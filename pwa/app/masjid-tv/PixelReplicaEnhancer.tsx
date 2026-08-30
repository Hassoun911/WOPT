"use client";

import { useEffect } from "react";

const text = (el: Element | null) => (el?.textContent || "").trim();
const GRAND_ART = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/pwa/public/masjid-tv/grand-reference.webp?v=10";

export default function PixelReplicaEnhancer() {
  useEffect(() => {
    const draw = () => {
      const shell = document.querySelector<HTMLElement>(".webtv-shell.layout-grand");
      const source = document.querySelector<HTMLElement>(".template-grand");
      if (!shell || !source) {
        document.querySelector(".pixel-replica-one")?.remove();
        return;
      }

      let root = shell.querySelector<HTMLElement>(".pixel-replica-one");
      if (!root) {
        root = document.createElement("section");
        root.className = "pixel-replica-one";
        shell.appendChild(root);
      }

      const clock = text(source.querySelector(".tv-clock"));

      root.innerHTML = `
        <img class="px-reference-art" src="${GRAND_ART}" alt="Grand Masjid display artwork" referrerpolicy="no-referrer" />
        <button class="px-clock-hotspot" type="button" aria-label="Open Masjid Display Studio"></button>
      `;

      const image = root.querySelector<HTMLImageElement>(".px-reference-art");
      image?.addEventListener("error", () => root?.classList.add("art-load-error"), { once: true });
      image?.addEventListener("load", () => root?.classList.remove("art-load-error"), { once: true });

      root.querySelector(".px-clock-hotspot")?.addEventListener("click", () => {
        (source.querySelector(".tv-clock") as HTMLButtonElement | null)?.click();
      });
      root.setAttribute("data-clock", clock);
    };

    draw();
    const timer = window.setInterval(draw, 1000);
    return () => {
      window.clearInterval(timer);
      document.querySelector(".pixel-replica-one")?.remove();
    };
  }, []);

  return null;
}
