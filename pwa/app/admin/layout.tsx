"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import EmailSponsorSaveFix from "./EmailSponsorSaveFix";

const groups = [
  { label: "🏠 Dashboard", href: "/admin/" },
  {
    label: "👥 People",
    items: [
      ["/admin/users/", "Users"],
      ["/admin/school/", "School"],
    ],
  },
  { label: "📖 Content", href: "/admin/content/" },
  {
    label: "💬 Messages",
    items: [
      ["/admin/support/", "Support"],
      ["/admin/email/", "Email"],
      ["/admin/push/", "Push"],
    ],
  },
  {
    label: "🎛️ Controls",
    items: [
      ["/admin/control/", "App Control"],
      ["/admin/reports/", "Reports"],
    ],
  },
  {
    label: "🔐 Admin",
    items: [
      ["/admin/admins/", "Admins"],
      ["/admin/audit/", "Audit"],
      ["/admin/system/", "System Health"],
    ],
  },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/admin/";
  const isDashboard = pathname === "/admin" || pathname === "/admin/";

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      ho: html.style.overflow,
      hoy: html.style.overflowY,
      hh: html.style.height,
      bo: body.style.overflow,
      boy: body.style.overflowY,
      bh: body.style.height,
      bp: body.style.position,
    };
    html.style.overflow = "visible";
    html.style.overflowY = "auto";
    html.style.height = "auto";
    body.style.overflow = "visible";
    body.style.overflowY = "auto";
    body.style.height = "auto";
    body.style.position = "static";
    return () => {
      html.style.overflow = previous.ho;
      html.style.overflowY = previous.hoy;
      html.style.height = previous.hh;
      body.style.overflow = previous.bo;
      body.style.overflowY = previous.boy;
      body.style.height = previous.bh;
      body.style.position = previous.bp;
    };
  }, []);

  const active = (href: string) =>
    href === "/admin/" ? isDashboard : pathname.startsWith(href.replace(/\/$/, ""));

  const groupActive = (items: readonly (readonly [string, string])[]) => items.some(([href]) => active(href));

  return (
    <div style={{ minHeight: "100dvh", overflow: "visible", paddingBottom: 24 }}>
      <EmailSponsorSaveFix />
      <style>{`
        /* Public-site navigation is intentionally hidden inside the owner CRM. */
        .web-menu-trigger,
        .web-menu-backdrop,
        .web-slide-menu { display:none !important; }

        ${isDashboard ? `
        /* The dashboard used to render a second duplicate CRM tab bar. The
           global admin navigation below is now the single source of truth. */
        body main > header + nav { display: none !important; }
        body main > header a[href="/admin/email"],
        body main > header a[href="/admin/email/"] { display: none !important; }
        ` : ""}
        .hassoun-admin-nav details > summary::-webkit-details-marker { display:none; }
        .hassoun-admin-nav details[open] > summary { background:#0b735b !important; color:white !important; }
        @media (max-width: 760px) {
          .hassoun-admin-nav { overflow-x:auto; flex-wrap:nowrap !important; justify-content:flex-start !important; }
          .hassoun-admin-nav .nav-label { white-space:nowrap; }
        }
      `}</style>

      <nav
        className="hassoun-admin-nav"
        aria-label="Admin navigation"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          padding: "9px 14px",
          background: "rgba(250,248,242,.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e5dfd2",
          boxShadow: "0 2px 12px rgba(30,70,57,.05)",
        }}
      >
        {groups.map((group) => {
          if ("href" in group) {
            const isActive = active(group.href);
            return (
              <a
                key={group.label}
                href={group.href}
                className="nav-label"
                style={{
                  textDecoration: "none",
                  color: isActive ? "white" : "#145746",
                  background: isActive ? "#0b735b" : "white",
                  border: "1px solid #d8e0dc",
                  borderRadius: 12,
                  padding: "9px 13px",
                  fontSize: 13,
                  fontWeight: 850,
                }}
              >
                {group.label}
              </a>
            );
          }

          const isActive = groupActive(group.items);
          return (
            <details key={group.label} style={{ position: "relative" }}>
              <summary
                className="nav-label"
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  color: isActive ? "white" : "#145746",
                  background: isActive ? "#0b735b" : "white",
                  border: "1px solid #d8e0dc",
                  borderRadius: 12,
                  padding: "9px 13px",
                  fontSize: 13,
                  fontWeight: 850,
                  userSelect: "none",
                }}
              >
                {group.label} ▾
              </summary>
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 7px)",
                  left: 0,
                  minWidth: 190,
                  padding: 7,
                  background: "white",
                  border: "1px solid #d8e0dc",
                  borderRadius: 14,
                  boxShadow: "0 14px 38px rgba(23,63,53,.16)",
                  display: "grid",
                  gap: 4,
                }}
              >
                {group.items.map(([href, label]) => {
                  const itemActive = active(href);
                  return (
                    <a
                      key={href}
                      href={href}
                      style={{
                        textDecoration: "none",
                        color: itemActive ? "white" : "#173f35",
                        background: itemActive ? "#0b735b" : "transparent",
                        borderRadius: 9,
                        padding: "9px 10px",
                        fontSize: 13,
                        fontWeight: 750,
                      }}
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            </details>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
