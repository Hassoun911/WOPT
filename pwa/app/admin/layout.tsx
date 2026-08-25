"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverflowY: html.style.overflowY,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyOverflowY: body.style.overflowY,
      bodyHeight: body.style.height,
      bodyPosition: body.style.position,
    };

    // Admin/CRM screens can be much taller than the viewport. Always restore
    // document scrolling here in case a modal/menu enhancer locked the page.
    html.style.overflow = "visible";
    html.style.overflowY = "auto";
    html.style.height = "auto";
    body.style.overflow = "visible";
    body.style.overflowY = "auto";
    body.style.height = "auto";
    body.style.position = "static";

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.overflowY = previous.htmlOverflowY;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.height = previous.bodyHeight;
      body.style.position = previous.bodyPosition;
    };
  }, []);

  // Admin navigation is handled by the top Menu control. Do not add a second
  // fixed navigation bar at the bottom of CRM pages.
  return <div style={{ minHeight: "100dvh", overflow: "visible", paddingBottom: 24 }}>{children}</div>;
}
