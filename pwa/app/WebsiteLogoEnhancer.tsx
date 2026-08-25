"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LOGO = "/hassoun-brand.svg?v=20260825-exact-2";

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
          img.src = LOGO;
          img.dataset.hassounBrand = "official";
        }
      });

      if (pathname.includes("/quran")) {
        const brand = document.querySelector<HTMLElement>(".quran-brand");
        if (brand && !brand.querySelector("img[data-hassoun-brand]")) {
          const old = brand.querySelector<HTMLElement>(":scope > span");
          if (old) {
            const img = document.createElement("img");
            img.src = LOGO;
            img.alt = "Hassoun";
            img.dataset.hassounBrand = "official";
            img.style.cssText = "width:46px;height:46px;object-fit:cover;border-radius:13px;display:block";
            old.replaceWith(img);
          }
          const title = brand.querySelector("strong");
          const note = brand.querySelector("small");
          if (title) title.textContent = "Hassoun Qur’an";
          if (note) note.textContent = "Read · Listen · School";
        }
      }

      if (pathname === "/admin" || pathname === "/admin/") {
        Array.from(document.querySelectorAll<HTMLElement>("div")).forEach((node) => {
          if (node.children.length === 0 && node.textContent?.trim() === "و" && !node.dataset.hassounLogoReplaced) {
            node.dataset.hassounLogoReplaced = "true";
            node.textContent = "";
            const img = document.createElement("img");
            img.src = LOGO;
            img.alt = "Hassoun";
            img.dataset.hassounBrand = "official";
            img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
            node.appendChild(img);
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
