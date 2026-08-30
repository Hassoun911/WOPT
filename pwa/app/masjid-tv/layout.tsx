import type { ReactNode } from "react";
import LogoUploadEnhancer from "./LogoUploadEnhancer";
import TvModeChromeSuppressor from "./TvModeChromeSuppressor";
import PixelReplicaEnhancer from "./PixelReplicaEnhancer";
import "./masjid-tv-polish.css";
import "./reference-layouts.css";
import "./jumuah-exact.css";
import "./pixel-replica.css";

export default function MasjidTvLayout({ children }: { children: ReactNode }) {
  return <>{children}<LogoUploadEnhancer /><TvModeChromeSuppressor /><PixelReplicaEnhancer /></>;
}
