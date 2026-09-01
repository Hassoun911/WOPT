import type { ReactNode } from "react";
import LogoUploadEnhancer from "./LogoUploadEnhancer";
import DisplayArtSettingsEnhancer from "./DisplayArtSettingsEnhancer";
import TvModeChromeSuppressor from "./TvModeChromeSuppressor";
import PixelReplicaEnhancer from "./PixelReplicaEnhancer";
import StudioPreviewEnhancer from "./StudioPreviewEnhancer";
import StudioGrandMirrorEnhancer from "./StudioGrandMirrorEnhancer";
import StudioDevicePairingEnhancer from "./StudioDevicePairingEnhancer";
import MasjidTvWakeLock from "./MasjidTvWakeLock";
import TvTickerFooter from "./TvTickerFooter";
import SmartVerseDisplayEnhancer from "./SmartVerseDisplayEnhancer";
import TvIslamicCalendarEnhancer from "./TvIslamicCalendarEnhancer";
import DonationQrEnhancer from "./DonationQrEnhancer";
import "./masjid-tv-polish.css";
import "./reference-layouts.css";
import "./jumuah-exact.css";
import "./pixel-replica.css";
import "./studio-previews.css";

export default function MasjidTvLayout({ children }: { children: ReactNode }) {
  return <>{children}<MasjidTvWakeLock /><LogoUploadEnhancer /><DisplayArtSettingsEnhancer /><TvModeChromeSuppressor /><PixelReplicaEnhancer /><StudioPreviewEnhancer /><StudioGrandMirrorEnhancer /><StudioDevicePairingEnhancer /><TvTickerFooter /><SmartVerseDisplayEnhancer /><TvIslamicCalendarEnhancer /><DonationQrEnhancer /></>;
}
