import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile-nav-fix.css";
import "./quran.css";
import "./direction-fixes.css";
import "./parity.css";
import "./quran-index-fix.css";
import "./home-app-match.css";
import "./fluid-dashboard.css";
import EmailManageRedirect from "./EmailManageRedirect";
import NavEnhancer from "./NavEnhancer";
import PrayerAlertAudioEnhancer from "./PrayerAlertAudioEnhancer";
import PrayerCardInteractionEnhancer from "./PrayerCardInteractionEnhancer";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";
import WebPushRegistration from "./WebPushRegistration";
import QuranUiFixEnhancer from "./QuranUiFixEnhancer";
import QuranReferenceLayoutEnhancer from "./QuranReferenceLayoutEnhancer";
import QuranReferenceControlsEnhancer from "./QuranReferenceControlsEnhancer";
import QuranViewModeEnhancer from "./QuranViewModeEnhancer";
import QuranTranslationLanguageEnhancer from "./QuranTranslationLanguageEnhancer";
import QuranVerseMenuEnhancer from "./QuranVerseMenuEnhancer";
import QuranInfoMeaningEnhancer from "./QuranInfoMeaningEnhancer";
import QuranHeaderSearchEnhancer from "./QuranHeaderSearchEnhancer";
import QuranHomeLinkFixEnhancer from "./QuranHomeLinkFixEnhancer";
import QuranCleanReadingEnhancer from "./QuranCleanReadingEnhancer";
import QuranCleanToolbarFixEnhancer from "./QuranCleanToolbarFixEnhancer";
import QuranMoreMenuEnhancer from "./QuranMoreMenuEnhancer";
import QuranTapAnchorEnhancer from "./QuranTapAnchorEnhancer";
import QuranPrintedPageEnhancer from "./QuranPrintedPageEnhancer";
import QuranScriptTajweedEnhancer from "./QuranScriptTajweedEnhancer";
import QuranPrintedScrollEnhancer from "./QuranPrintedScrollEnhancer";
import QuranIndexEnhancer from "./QuranIndexEnhancer";
import QuranAudioSystem from "./QuranAudioSystem";
import QuranGlyphSafetyEnhancer from "./QuranGlyphSafetyEnhancer";
import QuranContextSurahChooserEnhancer from "./QuranContextSurahChooserEnhancer";
import QuranPageOrderGuardEnhancer from "./QuranPageOrderGuardEnhancer";
import QuranSchoolLinkEnhancer from "./QuranSchoolLinkEnhancer";
import WebsiteLogoEnhancer from "./WebsiteLogoEnhancer";
import WebAppNav from "./WebAppNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const asset = (path: string) => `${basePath}${path}`;
const ICON_VERSION = "20260825-web-icon-1";

export const metadata: Metadata = {
  title: "Hassoun",
  description: "Prayer times, Qur’an reading and audio, Qur’an School, memorization, Qibla, Islamic events and learning tools.",
  manifest: asset(`/manifest.webmanifest?v=${ICON_VERSION}`),
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Hassoun" },
  other: { "codex-preview": "development" },
  icons: {
    icon: [
      { url: asset(`/hassoun-logo.png?v=${ICON_VERSION}`), type: "image/png", sizes: "512x512" },
      { url: asset(`/icon-192.png?v=${ICON_VERSION}`), type: "image/png", sizes: "192x192" },
      { url: asset(`/favicon.svg?v=${ICON_VERSION}`), type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: asset(`/hassoun-logo.png?v=${ICON_VERSION}`),
    apple: [{ url: asset(`/apple-touch-icon.png?v=${ICON_VERSION}`), type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b5b47" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <EmailManageRedirect />
        <NavEnhancer />
        <PrayerAlertAudioEnhancer />
        <PrayerCardInteractionEnhancer />
        <ServiceWorkerRegistration />
        <WebPushRegistration />
        <QuranUiFixEnhancer />
        <QuranReferenceLayoutEnhancer />
        <QuranReferenceControlsEnhancer />
        <QuranViewModeEnhancer />
        <QuranTranslationLanguageEnhancer />
        <QuranVerseMenuEnhancer />
        <QuranInfoMeaningEnhancer />
        <QuranHeaderSearchEnhancer />
        <QuranHomeLinkFixEnhancer />
        <QuranCleanReadingEnhancer />
        <QuranCleanToolbarFixEnhancer />
        <QuranMoreMenuEnhancer />
        <QuranTapAnchorEnhancer />
        <QuranPrintedPageEnhancer />
        <QuranScriptTajweedEnhancer />
        <QuranPrintedScrollEnhancer />
        <QuranIndexEnhancer />
        <QuranAudioSystem />
        <QuranGlyphSafetyEnhancer />
        <QuranContextSurahChooserEnhancer />
        <QuranPageOrderGuardEnhancer />
        <QuranSchoolLinkEnhancer />
        <WebsiteLogoEnhancer />
        <WebAppNav />
      </body>
    </html>
  );
}
