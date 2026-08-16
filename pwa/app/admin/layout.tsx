"use client";

import type { ReactNode } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
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
          fontFamily: "system-ui,-apple-system,sans-serif"
        }}
      >
        <a href={`${basePath}/admin/`} style={linkStyle}>Dashboard</a>
        <a href={`${basePath}/admin/email/`} style={linkStyle}>Email campaigns</a>
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
  textDecoration: "none"
};
