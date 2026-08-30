import type { ReactNode } from "react";
import LogoUploadEnhancer from "./LogoUploadEnhancer";
import TvModeChromeSuppressor from "./TvModeChromeSuppressor";
import ReplicaOneEnhancer from "./ReplicaOneEnhancer";
import "./masjid-tv-polish.css";
import "./reference-layouts.css";
import "./jumuah-exact.css";
import "./replica-one.css";
import "./replica-one-header-fix.css";

export default function MasjidTvLayout({ children }: { children: ReactNode }) {
  return <>{children}<LogoUploadEnhancer /><TvModeChromeSuppressor /><ReplicaOneEnhancer /></>;
}
