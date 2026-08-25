"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LOGO = "/hassoun-brand.svg?v=20260825-exact-3";

function makeLogo(size = 48, radius = 14) {
  const img = document.createElement("img");
  img.src = LOGO;
  img.alt = "Hassoun";
  img.dataset.hassounBrand = "official";
  img.style.cssText = `width:${size}px;height:${size}px;object-fit:cover;border-radius:${radius}px;display:block`;
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
      });

      const pageBrandTargets = [
        "main > .parity-hero > .hero-badge",
        "main > .games-hero > .hero-badge",
        "main > .utility-hero > .utility-mark",
      ];
      pageBrandTargets.forEach((selector) => {
        const target = document.querySelector<HTMLElement>(selector);
        if (!target || target.dataset.hassounBrandApplied === "true") return;
        target.dataset.hassounBrandApplied = "true";
        target.textContent = "";
        target.style.overflow = "hidden";
        target.style.padding = "0";
        const logo = makeLogo(64, 18);
        logo.style.width = "100%";
        logo.style.height = "100%";
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

        const nav = document.querySelector<HTMLElement>("nav");
        if (nav && !nav.querySelector(".hassoun-school-crm-link")) {
          const school = document.createElement("a");
          school.className = "hassoun-school-crm-link";
          school.href = "/admin/school";
          school.textContent = "Qur’an School CRM";
          school.style.cssText = "display:inline-flex;align-items:center;justify-content:center;border:1px solid #b8d1c9;border-radius:10px;padding:9px 12px;background:#edf7f3;color:#0f5e4c;text-decoration:none;font-weight:800;font-size:13px";
          nav.appendChild(school);
        }
      }
    };

    apply();
    const timer = window.setInterval(apply, 700);
    return () => { window.clearInterval(timer); document.querySelector(".hassoun-school-crm-link")?.remove(); };
  }, [pathname]);

  return null;
}
