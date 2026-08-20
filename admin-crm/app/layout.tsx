import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hassoun Admin CRM",
  description: "Hassoun Owner Control Center"
};

const apiProxyBootstrap = `
(() => {
  const workerOrigin = "https://wopt-prayer-push.wopt-windsor.workers.dev";
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const raw = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (raw.startsWith(workerOrigin + "/admin/")) {
        const target = location.origin + "/api" + raw.slice(workerOrigin.length);
        if (input instanceof Request) {
          return originalFetch(new Request(target, input), init);
        }
        return originalFetch(target, init);
      }
    } catch (_) {}
    return originalFetch(input, init);
  };
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: apiProxyBootstrap }} />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}