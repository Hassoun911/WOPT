import type { ReactNode } from "react";
import LogoUploadEnhancer from "./LogoUploadEnhancer";
import DisplayArtSettingsEnhancer from "./DisplayArtSettingsEnhancer";
import SmartGrandV2Enhancer from "./SmartGrandV2Enhancer";
import SmartMasjidSettingsEnhancer from "./SmartMasjidSettingsEnhancer";
import AdminPreviewStabilityEnhancer from "./AdminPreviewStabilityEnhancer";
import TvModeChromeSuppressor from "./TvModeChromeSuppressor";
import TvDisplayVisibilityGuard from "./TvDisplayVisibilityGuard";
import TvClockSettingsBridge from "./TvClockSettingsBridge";
import StudioPreviewEnhancer from "./StudioPreviewEnhancer";
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
  return <>{children}<MasjidTvWakeLock /><LogoUploadEnhancer /><DisplayArtSettingsEnhancer /><SmartMasjidSettingsEnhancer /><TvModeChromeSuppressor /><TvDisplayVisibilityGuard /><SmartGrandV2Enhancer /><TvClockSettingsBridge /><AdminPreviewStabilityEnhancer /><StudioPreviewEnhancer /><StudioDevicePairingEnhancer /><TvTickerFooter /><SmartVerseDisplayEnhancer /><TvIslamicCalendarEnhancer /><DonationQrEnhancer /></>;
}
