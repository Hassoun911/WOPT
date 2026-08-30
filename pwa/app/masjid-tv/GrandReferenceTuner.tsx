"use client";

import { useEffect } from "react";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

export default function GrandReferenceTuner() {
  useEffect(() => {
    let lastLogo = "";

    const tune = () => {
      const shell = document.querySelector<HTMLElement>(".webtv-shell.layout-grand");
      const root = shell?.querySelector<HTMLElement>(".pixel-replica-one");
      const svg = root?.querySelector<SVGSVGElement>(".px-reference-art");
      if (!shell || !root || !svg) return;

      // The supplied reference is a true 16:9 composition. Keep that exact
      // design ratio and let the outer TV shell letterbox safely when needed.
      svg.setAttribute("viewBox", "0 0 1440 810");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      // Extend the artwork to the 16:9 bottom edge rather than stretching it.
      svg.querySelectorAll<SVGRectElement>('rect[width="1440"][height="790"]').forEach(r => r.setAttribute("height", "810"));
      svg.querySelectorAll<SVGRectElement>('rect[y="735"][height="55"]').forEach(r => r.setAttribute("height", "75"));
      const powered = [...svg.querySelectorAll<SVGTextElement>("text")].find(t => (t.textContent || "").includes("Powered by Hassoun"));
      if (powered) powered.setAttribute("y", "781");

      // Match the darker emerald/black-green reference instead of the brighter teal.
      const bg = svg.querySelector<SVGLinearGradientElement>("#bg");
      const stops = bg?.querySelectorAll<SVGStopElement>("stop");
      if (stops?.[0]) stops[0].setAttribute("stop-color", "#002b25");
      if (stops?.[1]) stops[1].setAttribute("stop-color", "#043f35");
      if (stops?.[2]) stops[2].setAttribute("stop-color", "#012a25");

      // The reference clock is clean and large, not a heavy display serif.
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

      // Slightly denser glass panels and subtler pattern, like the supplied target.
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

      // If the masjid uploaded a logo in Studio, use the real logo in the Grand
      // reference artwork instead of keeping the generic fallback emblem.
      const sourceLogo = document.querySelector<HTMLImageElement>(".template-grand .tv-brand img")?.src || "";
      if (sourceLogo !== lastLogo) {
        lastLogo = sourceLogo;
        svg.querySelector("#grand-live-logo")?.remove();
        svg.querySelector("#grand-live-logo-mask")?.remove();
        if (sourceLogo) {
          const mask = document.createElementNS(SVG_NS, "rect");
          mask.id = "grand-live-logo-mask";
          mask.setAttribute("x", "58"); mask.setAttribute("y", "18");
          mask.setAttribute("width", "154"); mask.setAttribute("height", "136");
          mask.setAttribute("rx", "4"); mask.setAttribute("fill", "#012f29");
          const image = document.createElementNS(SVG_NS, "image");
          image.id = "grand-live-logo";
          image.setAttribute("x", "64"); image.setAttribute("y", "20");
          image.setAttribute("width", "142"); image.setAttribute("height", "130");
          image.setAttribute("preserveAspectRatio", "xMidYMid meet");
          image.setAttribute("href", sourceLogo);
          image.setAttributeNS(XLINK_NS, "href", sourceLogo);
          const firstGroup = svg.querySelector("g");
          if (firstGroup) {
            firstGroup.insertBefore(mask, firstGroup.firstChild);
            firstGroup.insertBefore(image, mask.nextSibling);
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
