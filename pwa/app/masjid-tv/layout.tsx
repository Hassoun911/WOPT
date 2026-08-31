import type { ReactNode } from "react";
import LogoUploadEnhancer from "./LogoUploadEnhancer";
import TvModeChromeSuppressor from "./TvModeChromeSuppressor";
import PixelReplicaEnhancer from "./PixelReplicaEnhancer";
import StudioPreviewEnhancer from "./StudioPreviewEnhancer";
import StudioDevicePairingEnhancer from "./StudioDevicePairingEnhancer";
import MasjidTvWakeLock from "./MasjidTvWakeLock";
import "./masjid-tv-polish.css";
import "./reference-layouts.css";
import "./jumuah-exact.css";
import "./pixel-replica.css";
import "./studio-previews.css";

export default function MasjidTvLayout({ children }: { children: ReactNode }) {
  return <>{children}<MasjidTvWakeLock /><LogoUploadEnhancer /><TvModeChromeSuppressor /><PixelReplicaEnhancer /><StudioPreviewEnhancer /><StudioDevicePairingEnhancer /></>;
}
