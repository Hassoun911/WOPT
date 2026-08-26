"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import EmailSponsorSaveFix from "./EmailSponsorSaveFix";

const sections = [
  {
    label: "MAIN",
    items: [
      ["/admin/", "🏠", "Dashboard"],
      ["/admin/users/", "👥", "Users"],
      ["/admin/school/", "🎓", "School"],
      ["/admin/content/", "📖", "Content"],
    ],
  },
  {
    label: "COMMUNICATION",
    items: [
      ["/admin/support/", "💬", "Support"],
      ["/admin/email/", "📧", "Email"],
      ["/admin/push/", "🔔", "Push"],
    ],
  },
  {
    label: "CONTROL",
    items: [
      ["/admin/control/", "🎛️", "App Control"],
      ["/admin/reports/", "📊", "Reports"],
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      ["/admin/admins/", "🔐", "Admins"],
      ["/admin/audit/", "🧾", "Audit"],
      ["/admin/system/", "🩺", "System Health"],
    ],
  },
] as const;

const STORAGE_KEY = "hassoun:admin-sidebar-expanded";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/admin/";
  const isDashboard = pathname === "/admin" || pathname === "/admin/";
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setExpanded(saved !== "0");
      else if (window.innerWidth < 900) setExpanded(false);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0"); } catch {}
  }, [expanded]);

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
    href === "/admin/"
      ? isDashboard
      : pathname.startsWith(href.replace(/\/$/, ""));

  return (
    <div className="admin-shell" data-expanded={expanded ? "1" : "0"}>
      <EmailSponsorSaveFix />
      <style>{`
        .web-menu-trigger,.web-menu-backdrop,.web-slide-menu{display:none!important}

        ${isDashboard ? `
          body main > header + nav{display:none!important}
          body main > header a[href="/admin/email"],
          body main > header a[href="/admin/email/"]{display:none!important}
        ` : ""}

        .admin-shell{--side-collapsed:68px;--side-expanded:238px;min-height:100dvh;background:#f7f5ef}
        .admin-sidebar{position:fixed;left:0;top:0;bottom:0;z-index:1100;width:var(--side-collapsed);background:#103f35;color:white;border-right:1px solid rgba(255,255,255,.12);box-shadow:4px 0 22px rgba(17,57,48,.11);transition:width .22s ease;overflow-x:hidden;overflow-y:auto}
        .admin-shell[data-expanded="1"] .admin-sidebar{width:var(--side-expanded)}
        .admin-content{min-height:100dvh;margin-left:var(--side-collapsed);transition:margin-left .22s ease;overflow:visible}
        .admin-shell[data-expanded="1"] .admin-content{margin-left:var(--side-expanded)}
        .admin-side-head{height:66px;display:flex;align-items:center;gap:10px;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.1);position:sticky;top:0;background:#103f35;z-index:2}
        .admin-side-logo{width:44px;height:44px;object-fit:contain;border-radius:12px;flex:0 0 auto;background:#0b5b47}
        .admin-side-brand{min-width:150px;opacity:0;transform:translateX(-5px);transition:opacity .15s ease,transform .15s ease;white-space:nowrap}
        .admin-shell[data-expanded="1"] .admin-side-brand{opacity:1;transform:none}
        .admin-side-brand strong{display:block;font-size:13px;letter-spacing:.08em}.admin-side-brand small{display:block;margin-top:2px;color:#bdd5ce;font-size:11px}
        .admin-side-toggle{display:grid;place-items:center;width:40px;height:40px;margin:9px auto;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.08);color:white;font-size:19px;cursor:pointer}
        .admin-shell[data-expanded="1"] .admin-side-toggle{margin-left:auto;margin-right:10px}
        .admin-section-label{height:22px;margin:12px 14px 4px;color:#8fb4aa;font-size:9px;font-weight:900;letter-spacing:.13em;white-space:nowrap;opacity:0}
        .admin-shell[data-expanded="1"] .admin-section-label{opacity:1}
        .admin-side-link{position:relative;display:flex;align-items:center;height:46px;margin:4px 8px;padding:0 12px;border-radius:12px;text-decoration:none;color:#dfece8;gap:12px;transition:background .15s ease,color .15s ease}
        .admin-side-link:hover{background:rgba(255,255,255,.1);color:white}
        .admin-side-link.active{background:#f8f3e8;color:#12493c;font-weight:850;box-shadow:0 5px 14px rgba(0,0,0,.1)}
        .admin-side-icon{width:28px;flex:0 0 28px;text-align:center;font-size:18px;line-height:1}
        .admin-side-text{font-size:13px;white-space:nowrap;opacity:0;transition:opacity .12s ease}
        .admin-shell[data-expanded="1"] .admin-side-text{opacity:1}
        .admin-shell[data-expanded="0"] .admin-side-link::after{content:attr(data-label);position:fixed;left:74px;background:#173f35;color:white;padding:7px 9px;border-radius:8px;font-size:12px;font-weight:750;opacity:0;pointer-events:none;transform:translateX(-4px);transition:.12s;white-space:nowrap;z-index:1300}
        .admin-shell[data-expanded="0"] .admin-side-link:hover::after{opacity:1;transform:none}
        .admin-side-bottom{padding:14px 8px 20px;margin-top:8px;border-top:1px solid rgba(255,255,255,.08)}
        .admin-side-bottom a{display:flex;align-items:center;height:42px;padding:0 12px;gap:12px;border-radius:11px;text-decoration:none;color:#c9ddd7}

        @media(max-width:760px){
          .admin-sidebar{width:60px}.admin-content{margin-left:60px}.admin-shell[data-expanded="1"] .admin-sidebar{width:min(250px,84vw);box-shadow:10px 0 40px rgba(0,0,0,.28)}.admin-shell[data-expanded="1"] .admin-content{margin-left:60px}
          .admin-shell[data-expanded="1"]::after{content:"";position:fixed;inset:0 0 0 60px;background:rgba(10,40,33,.24);z-index:1050;pointer-events:none}
        }
      `}</style>

      <aside className="admin-sidebar" aria-label="Hassoun admin navigation">
        <div className="admin-side-head">
          <img className="admin-side-logo" src="/hassoun-logo.png" alt="Hassoun" />
          <div className="admin-side-brand">
            <strong>HASSOUN ADMIN</strong>
            <small>Owner Control Center</small>
          </div>
        </div>

        <button
          className="admin-side-toggle"
          type="button"
          aria-label={expanded ? "Collapse admin menu" : "Expand admin menu"}
          title={expanded ? "Collapse menu" : "Expand menu"}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "‹" : "›"}
        </button>

        <nav>
          {sections.map((section) => (
            <div key={section.label}>
              <div className="admin-section-label">{section.label}</div>
              {section.items.map(([href, icon, label]) => {
                const isActive = active(href);
                return (
                  <a
                    key={href}
                    href={href}
                    className={`admin-side-link${isActive ? " active" : ""}`}
                    data-label={label}
                    title={!expanded ? label : undefined}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="admin-side-icon">{icon}</span>
                    <span className="admin-side-text">{label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-side-bottom">
          <a href="/" target="_blank" rel="noreferrer" data-label="Open Hassoun">
            <span className="admin-side-icon">🌐</span>
            <span className="admin-side-text">Open Hassoun</span>
          </a>
        </div>
      </aside>

      <div className="admin-content">{children}</div>
    </div>
  );
}
