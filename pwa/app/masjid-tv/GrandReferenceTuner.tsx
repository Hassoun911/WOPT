"use client";

import { useEffect } from "react";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

export default function GrandReferenceTuner() {
  useEffect(() => {
    let lastLogo = "__unset__";

    const tune = () => {
      const shell = document.querySelector<HTMLElement>(".webtv-shell.layout-grand");
      const root = shell?.querySelector<HTMLElement>(".pixel-replica-one");
      const svg = root?.querySelector<SVGSVGElement>(".px-reference-art");
      if (!shell || !root || !svg) return;

      // Keep the exact Grand composition ratio and letterbox safely when needed.
      svg.setAttribute("viewBox", "0 0 1440 810");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      svg.querySelectorAll<SVGRectElement>('rect[width="1440"][height="790"]').forEach(r => r.setAttribute("height", "810"));
      svg.querySelectorAll<SVGRectElement>('rect[y="735"][height="55"]').forEach(r => r.setAttribute("height", "75"));
      const powered = [...svg.querySelectorAll<SVGTextElement>("text")].find(t => (t.textContent || "").includes("Powered by Hassoun"));
      if (powered) powered.setAttribute("y", "781");

      const bg = svg.querySelector<SVGLinearGradientElement>("#bg");
      const stops = bg?.querySelectorAll<SVGStopElement>("stop");
      if (stops?.[0]) stops[0].setAttribute("stop-color", "#002b25");
      if (stops?.[1]) stops[1].setAttribute("stop-color", "#043f35");
      if (stops?.[2]) stops[2].setAttribute("stop-color", "#012a25");

      const clock = svg.querySelector<SVGTextElement>('text[x="715"][y="104"]');
      if (clock) {
        clock.style.fontFamily = "Arial, Helvetica, sans-serif";
        clock.style.fontWeight = "500";
        clock.style.fontSize = "80px";
        clock.style.letterSpacing = "-2px";
      }
      const nextTime = svg.querySelector<SVGTextElement>('text[x="720"][y="269"]');
      if (nextTime) {
        nextTime.style.fontFamily = "Arial, Helvetica, sans-serif";
        nextTime.style.fontWeight = "500";
      }

      let style = svg.querySelector<HTMLStyleElement>("#grand-reference-tune");
      if (!style) {
        style = document.createElementNS(SVG_NS, "style") as unknown as HTMLStyleElement;
        style.id = "grand-reference-tune";
        svg.appendChild(style as unknown as Node);
      }
      style.textContent = `
        .box{fill:#033a31!important;fill-opacity:.91!important;stroke:#a58a4c!important;stroke-width:1.2!important}
        .iconCircle{fill:#07473c!important;stroke:#a58a4c!important}
        .line{stroke:#917a45!important;opacity:.38!important}
      `;

      // Uploaded masjid logo REPLACES the built-in Grand emblem.
      // Never draw both at the same time.
      const sourceLogo = document.querySelector<HTMLImageElement>(".template-grand .tv-brand img")?.src || "";
      if (sourceLogo !== lastLogo) {
        lastLogo = sourceLogo;

        const defaultLogo = svg.querySelector<SVGGElement>("#grand-default-logo");
        const slot = svg.querySelector<SVGGElement>("#grand-custom-logo-slot");

        if (defaultLogo) defaultLogo.style.display = sourceLogo ? "none" : "";
        if (slot) {
          while (slot.firstChild) slot.removeChild(slot.firstChild);

          if (sourceLogo) {
            const image = document.createElementNS(SVG_NS, "image");
            image.id = "grand-live-logo";
            image.setAttribute("x", "60");
            image.setAttribute("y", "20");
            image.setAttribute("width", "170");
            image.setAttribute("height", "130");
            image.setAttribute("preserveAspectRatio", "xMidYMid meet");
            image.setAttribute("href", sourceLogo);
            image.setAttributeNS(XLINK_NS, "href", sourceLogo);
            slot.appendChild(image);
          }
        }
      }
    };

    tune();
    const timer = window.setInterval(tune, 250);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
