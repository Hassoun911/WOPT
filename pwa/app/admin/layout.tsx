"use client";

import type { ReactNode } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body { max-width: 100%; overflow-x: hidden; }
        #hassoun-admin-nav { scrollbar-width: none; }
        #hassoun-admin-nav::-webkit-scrollbar { display: none; }
        @media (max-width: 860px) {
          body { -webkit-text-size-adjust: 100%; }
          main { max-width: 100% !important; min-width: 0 !important; padding: 12px !important; overflow-x: hidden !important; }
          main > aside {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            border-right: 0 !important;
            border-bottom: 1px solid #d7dfda !important;
            border-radius: 18px !important;
            padding: 12px !important;
            margin-bottom: 12px !important;
          }
          main > aside > div:nth-child(2) {
            display: flex !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            gap: 6px !important;
            padding: 8px 0 4px !important;
            scrollbar-width: none;
          }
          main > aside > div:nth-child(2)::-webkit-scrollbar { display: none; }
          main > aside > div:nth-child(2) button { flex: 0 0 auto !important; white-space: nowrap !important; width: auto !important; }
          main > aside > div:last-child { display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; gap: 10px !important; margin-top: 8px !important; }
          main > section { width: 100% !important; max-width: none !important; min-width: 0 !important; margin: 0 !important; padding: 0 0 92px !important; }
          main > section > header, main > header {
            min-height: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            padding: 6px 0 12px !important;
          }
          main > section > header > div:last-child, main > header > div:last-child { flex-wrap: wrap !important; }
          main div[style*="grid-template-columns"],
          main section[style*="grid-template-columns"],
          main form[style*="grid-template-columns"] { grid-template-columns: minmax(0, 1fr) !important; }
          main div[style*="display: grid"], main section[style*="display: grid"] { min-width: 0 !important; }
          main section, main article, main form, main div { max-width: 100%; box-sizing: border-box; }
          main input, main textarea, main select, main button { max-width: 100% !important; box-sizing: border-box !important; }
          main input, main textarea, main select { font-size: 16px !important; }
          main textarea { min-width: 0 !important; }
          main div[style*="overflow"] { max-width: 100% !important; }
          main table { min-width: 680px; width: max-content !important; }
          main td, main th { white-space: normal; overflow-wrap: anywhere; }
          main article > div[style*="justify-content: space-between"],
          main section > div[style*="justify-content: space-between"] { flex-wrap: wrap !important; }
          main h1 { font-size: clamp(24px, 8vw, 34px) !important; }
          main h2, main h3 { overflow-wrap: anywhere; }
          #hassoun-admin-nav {
            left: 8px !important;
            right: 8px !important;
            bottom: calc(8px + env(safe-area-inset-bottom)) !important;
            width: auto !important;
            max-width: calc(100vw - 16px) !important;
            overflow-x: auto !important;
            justify-content: flex-start !important;
            border-radius: 16px !important;
          }
          #hassoun-admin-nav a { flex: 0 0 auto !important; white-space: nowrap !important; }
        }
        @media (max-width: 480px) {
          main { padding: 8px !important; }
          main > aside { border-radius: 14px !important; padding: 10px !important; }
          main table { min-width: 620px; }
          #hassoun-admin-nav { left: 6px !important; right: 6px !important; max-width: calc(100vw - 12px) !important; }
        }
      `}</style>
      {children}
      <nav
        id="hassoun-admin-nav"
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
  textDecoration: "none"
};