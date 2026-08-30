import type { ReactNode } from "react";
import LogoUploadEnhancer from "./LogoUploadEnhancer";
import "./masjid-tv-polish.css";
import "./reference-layouts.css";

export default function MasjidTvLayout({ children }: { children: ReactNode }) {
  return <>{children}<LogoUploadEnhancer /></>;
}
