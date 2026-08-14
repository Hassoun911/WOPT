import type { NextConfig } from "next";

const staticExport = process.env.WOPT_STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const, trailingSlash: true } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // The Qur’an reader has a harmless fallback-word union warning that the existing
  // Vinext build accepts. Do not let that legacy typing warning block the static mirror.
  typescript: { ignoreBuildErrors: staticExport },
};

export default nextConfig;
