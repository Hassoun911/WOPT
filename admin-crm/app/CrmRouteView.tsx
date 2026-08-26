"use client";

import { useEffect } from "react";
import CrmDashboard from "./CrmDashboard";
import PasswordResetLink from "./PasswordResetLink";

export default function CrmRouteView({ navText }: { navText: string }) {
  useEffect(() => {
    let attempts = 0;
    const open = () => {
      attempts += 1;
      const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes(navText)) as HTMLButtonElement | undefined;
      if (button) { button.click(); return; }
      if (attempts < 30) window.setTimeout(open, 100);
    };
    open();
  }, [navText]);

  return <><CrmDashboard /><PasswordResetLink /></>;
}
