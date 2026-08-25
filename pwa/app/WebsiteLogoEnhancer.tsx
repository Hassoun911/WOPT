"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LOGO = "/hassoun-brand.svg?v=20260825-exact-5";

function makeLogo(size = 48, radius = 14) {
  const img = document.createElement("img");
  img.src = LOGO;
  img.alt = "Hassoun";
  img.dataset.hassounBrand = "official";
  img.style.cssText = `width:${size}px;height:${size}px;object-fit:contain;background:#0b5b47;border-radius:${radius}px;display:block`;
  return img;
}

export default function WebsiteLogoEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (
          src.includes("hassoun-logo.png") ||
          src.includes("hassoun-official-logo.jpg") ||
          src.includes("favicon-logo.png") ||
          src.includes("app-icon.svg") ||
          src.includes("icon-192.png") ||
          src.includes("icon-512.png") ||
          src.includes("apple-touch-icon.png") ||
          src.includes("maskable-icon-512.png")
        ) {
          if (img.src !== new URL(LOGO, window.location.origin).href) img.src = LOGO;
          img.dataset.hassounBrand = "official";
        }
        if (img.dataset.hassounBrand === "official") {
          img.style.objectFit = "contain";
          img.style.background = "#0b5b47";
        }
      });

      const pageBrandTargets = [
        "main > .parity-hero > .hero-badge",
        "main.games-web-page > .games-hero:not(.compact) > .hero-badge",
        "main > .utility-hero > .utility-mark",
      ];
      pageBrandTargets.forEach((selector) => {
        const target = document.querySelector<HTMLElement>(selector);
        if (!target || target.dataset.hassounBrandApplied === "true") return;
        target.dataset.hassounBrandApplied = "true";
        target.textContent = "";
        target.style.overflow = "hidden";
        target.style.padding = "8px";
        target.style.background = "#0b5b47";
        target.style.display = "flex";
        target.style.alignItems = "center";
        target.style.justifyContent = "center";
        const logo = makeLogo(64, 16);
        logo.style.width = "100%";
        logo.style.height = "100%";
        logo.style.objectFit = "contain";
        target.appendChild(logo);
      });

      if (pathname.includes("/quran")) {
        const brand = document.querySelector<HTMLElement>(".quran-brand");
        if (brand && !brand.querySelector("img[data-hassoun-brand]")) {
          const old = brand.querySelector<HTMLElement>(":scope > span");
          if (old) old.replaceWith(makeLogo(46, 13));
          const title = brand.querySelector("strong");
          const note = brand.querySelector("small");
          if (title) title.textContent = "Hassoun Qur’an";
          if (note) note.textContent = "Read · Listen · School";
        }
      }

      if (pathname.startsWith("/admin")) {
        Array.from(document.querySelectorAll<HTMLElement>("div,span")).forEach((node) => {
          const text = node.textContent?.trim();
          if (node.children.length === 0 && (text === "و" || text === "☪") && !node.dataset.hassounLogoReplaced) {
            node.dataset.hassounLogoReplaced = "true";
            node.textContent = "";
            node.style.overflow = "hidden";
            node.appendChild(makeLogo(Math.max(42, Math.min(72, node.clientWidth || 48)), 14));
          }
        });
      }
    };

    apply();
    const timer = window.setInterval(apply, 700);
    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
