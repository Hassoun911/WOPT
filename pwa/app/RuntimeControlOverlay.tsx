"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";

type Runtime = {
  maintenance: boolean;
  banner: { enabled: boolean; title: string; message: string };
};

const DEFAULT_RUNTIME: Runtime = {
  maintenance: false,
  banner: { enabled: false, title: "", message: "" }
};

export default function RuntimeControlOverlay() {
  const pathname = usePathname();
  const [runtime, setRuntime] = useState<Runtime>(DEFAULT_RUNTIME);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    void fetch(`${API}/app/runtime`, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload: { settings?: Record<string, unknown> } | null) => {
        const settings = payload?.settings ?? {};
        const rawBanner = settings.system_banner;
        const banner = rawBanner && typeof rawBanner === "object" ? rawBanner as Record<string, unknown> : {};
        setRuntime({
          maintenance: settings.maintenance_mode === true,
          banner: {
            enabled: banner.enabled === true,
            title: typeof banner.title === "string" ? banner.title : "",
            message: typeof banner.message === "string" ? banner.message : ""
          }
        });
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, []);

  if (pathname?.includes("/admin")) return null;

  if (runtime.maintenance) {
    return (
      <div style={styles.maintenance} role="alert" aria-live="assertive">
        <div style={styles.mark}>ح</div>
        <p style={styles.eyebrow}>HASSOUN</p>
        <h1 style={styles.title}>Maintenance in progress</h1>
        <p style={styles.message}>Hassoun is being updated right now. Please check again shortly.</p>
      </div>
    );
  }

  if (!runtime.banner.enabled || (!runtime.banner.title && !runtime.banner.message)) return null;
  return (
    <div style={styles.banner} role="status" aria-live="polite">
      {runtime.banner.title ? <strong style={styles.bannerTitle}>{runtime.banner.title}</strong> : null}
      {runtime.banner.message ? <span style={styles.bannerMessage}>{runtime.banner.message}</span> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  maintenance: { position: "fixed", inset: 0, zIndex: 999999, background: "#f6f0e5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, fontFamily: "system-ui,-apple-system,sans-serif", color: "#153f35" },
  mark: { width: 82, height: 82, borderRadius: 24, display: "grid", placeItems: "center", background: "#e2eee8", color: "#0b5b47", fontSize: 38, fontWeight: 900 },
  eyebrow: { margin: "16px 0 0", color: "#8f826e", fontSize: 11, letterSpacing: 2, fontWeight: 900 },
  title: { margin: "7px 0 0", fontSize: "clamp(28px,5vw,44px)" },
  message: { margin: "12px 0 0", maxWidth: 520, color: "#687872", fontSize: 15, lineHeight: 1.6 },
  banner: { position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 99999, width: "min(720px,calc(100% - 28px))", boxSizing: "border-box", borderRadius: 15, background: "#153f35", color: "#fffdf8", padding: "12px 16px", boxShadow: "0 10px 30px rgba(0,0,0,.2)", fontFamily: "system-ui,-apple-system,sans-serif", display: "grid", gap: 3 },
  bannerTitle: { fontSize: 14 },
  bannerMessage: { color: "#e4eee9", fontSize: 12, lineHeight: 1.5 }
};
