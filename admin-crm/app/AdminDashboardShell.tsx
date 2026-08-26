"use client";

import { useEffect } from "react";
import CrmDashboard from "./CrmDashboard";
import PasswordResetLink from "./PasswordResetLink";

const links = [
  ["👥 Users", "/admin/users"],
  ["📖 Quran", "/admin/quran"],
  ["🔔 Push", "/admin/push"],
  ["🛠️ Support", "/admin/support"],
  ["⚙️ Settings", "/admin/settings"]
] as const;

export default function AdminDashboardShell() {
  useEffect(() => {
    const wire = () => {
      const cards = Array.from(document.querySelectorAll("div"));
      const targets: Array<[string, () => void]> = [
        ["Active subscribers", () => { window.location.href = "/admin/users"; }],
        ["Push devices", () => { window.location.href = "/admin/push"; }],
        ["Android", () => { window.location.href = "/admin/push"; }],
        ["iOS", () => { window.location.href = "/admin/push"; }],
        ["Published content", () => { window.location.href = "/admin/quran"; }],
        ["Admins", () => clickNav("Admins")],
        ["Audit events", () => clickNav("Audit")]
      ];
      for (const [label, action] of targets) {
        const card = cards.find(el => el.textContent?.includes(label) && el.querySelector("strong"));
        if (!card || card.dataset.crmWired === "1") continue;
        card.dataset.crmWired = "1";
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.style.cursor = "pointer";
        card.addEventListener("click", action);
        card.addEventListener("keydown", e => { if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") action(); });
      }
    };
    const clickNav = (text: string) => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes(text));
      (btn as HTMLButtonElement | undefined)?.click();
    };
    wire();
    const obs = new MutationObserver(wire);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  return <>
    <div style={{maxWidth:1320,margin:"12px auto 0",padding:"0 22px",display:"flex",gap:8,flexWrap:"wrap",fontFamily:"system-ui,sans-serif"}}>
      {links.map(([label,href]) => <a key={href} href={href} style={{textDecoration:"none",border:"1px solid #cfd9d3",borderRadius:10,padding:"9px 12px",fontWeight:800,color:"#173f35",background:"white"}}>{label}</a>)}
    </div>
    <CrmDashboard />
    <PasswordResetLink />
  </>;
}
