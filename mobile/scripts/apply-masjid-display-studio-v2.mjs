import fs from "node:fs";

// The consolidated clock/branding patch uses `masjidLogoUri` as the canonical
// mosque-owned logo field. Reuse the Display Studio patch with that canonical
// field so the build stays compatible with the existing persisted settings.
const originalUrl = new URL("./apply-masjid-display-studio.mjs", import.meta.url);
const runtimeUrl = new URL("./.apply-masjid-display-studio-runtime.mjs", import.meta.url);
const source = fs.readFileSync(originalUrl, "utf8").replaceAll("mosqueLogoUri", "masjidLogoUri");
fs.writeFileSync(runtimeUrl, source);
try {
  await import(`${runtimeUrl.href}?v=${Date.now()}`);
} finally {
  try { fs.unlinkSync(runtimeUrl); } catch {}
}
