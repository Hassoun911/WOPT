import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile-nav-fix.css";
import "./quran.css";
import "./direction-fixes.css";
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
import QuranMemorizeExperienceEnhancer from "./QuranMemorizeExperienceEnhancer";
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

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const asset = (path: string) => `${basePath}${path}`;

export const metadata: Metadata = {
  title: "Windsor Prayer Times",
  description: "Accurate five daily Adhan times for Windsor, Ontario with a full Qur’an reader, listening, search, bookmarks, and memorization tools.",
  manifest: asset("/manifest.webmanifest"),
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Windsor Prayer Times" },
  other: { "codex-preview": "development" },
  icons: {
    icon: [
      { url: asset("/icon-192.png"), type: "image/png", sizes: "192x192" },
      { url: asset("/icon-512.png"), type: "image/png", sizes: "512x512" },
    ],
    shortcut: asset("/icon-192.png"),
    apple: asset("/apple-touch-icon.png"),
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b5b47" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
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
        <QuranMemorizeExperienceEnhancer />
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
      </body>
    </html>
  );
}
