"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

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

  return (
    <>
      <div style={{ minHeight: "100dvh", overflow: "visible", paddingBottom: 86 }}>
        {children}
      </div>
      <nav
        aria-label="Admin CMS navigation"
        style={{
          position: "fixed",
          left: 14,
          bottom: 14,
          zIndex: 10000,
          display: "flex",
          gap: 7,
          padding: 7,
          borderRadius: 999,
          background: "rgba(255,255,255,.96)",
          border: "1px solid #cedbd6",
          boxShadow: "0 10px 30px rgba(17,61,49,.14)",
          fontFamily: "system-ui,-apple-system,sans-serif",
          maxWidth: "calc(100vw - 28px)",
          overflowX: "auto"
        }}
      >
        <a href={`${basePath}/admin/`} style={linkStyle}>Dashboard</a>
        <a href={`${basePath}/admin/email/`} style={linkStyle}>Email campaigns</a>
        <a href={`${basePath}/admin/reset/`} style={linkStyle}>Password recovery</a>
      </nav>
    </>
  );
}

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 11px",
  borderRadius: 999,
  color: "#0b5b47",
  fontSize: 12,
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap"
};