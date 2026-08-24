"use client";

import { usePathname } from "next/navigation";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;

const items = [
  ["/", "🏠", "Home"],
  ["/quran/", "۞", "Qur’an"],
  ["/games/", "🎮", "Games"],
  ["/events/", "🌙", "Events"],
  ["/qibla/", "🕋", "Qibla"],
  ["/more/", "☰", "More"],
] as const;

export default function WebAppNav() {
  const pathname = usePathname();
  const localPath = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;

  return (
    <nav className="web-app-nav" aria-label="Hassoun app navigation">
      {items.map(([href, icon, label]) => {
        const active = href === "/" ? localPath === "/" : localPath.startsWith(href.replace(/\/$/, ""));
        return (
          <a key={href} href={appPath(href)} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span className="web-app-nav-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
