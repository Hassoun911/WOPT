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
import WebMasjidTvMenuEnhancer from "./WebMasjidTvMenuEnhancer";
import LocationPrayerTimesEnhancer from "./LocationPrayerTimesEnhancer";
import LocationMovementRefresh from "./LocationMovementRefresh";
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
import QuranDesktopScrollInputFix from "./QuranDesktopScrollInputFix";
import QuranIndexEnhancer from "./QuranIndexEnhancer";
import QuranAudioSystem from "./QuranAudioSystem";
import QuranGlyphSafetyEnhancer from "./QuranGlyphSafetyEnhancer";
import QuranContextSurahChooserEnhancer from "./QuranContextSurahChooserEnhancer";
import QuranPageOrderGuardEnhancer from "./QuranPageOrderGuardEnhancer";
import QuranSchoolLinkEnhancer from "./QuranSchoolLinkEnhancer";
import WebsiteLogoEnhancer from "./WebsiteLogoEnhancer";
import WebAppNav from "./WebAppNav";
import RemoteAppControl from "./RemoteAppControl";

const geistSans=Geist({variable:"--font-geist-sans",subsets:["latin"]});
const geistMono=Geist_Mono({variable:"--font-geist-mono",subsets:["latin"]});
const basePath=process.env.NEXT_PUBLIC_BASE_PATH||"";const asset=(path:string)=>`${basePath}${path}`;const ICON_VERSION="20260825-exact-5";
export const metadata:Metadata={title:"Hassoun",description:"Prayer times, Qur’an reading and audio, Qur’an School, memorization, Qibla, Islamic events and learning tools.",manifest:asset(`/manifest.webmanifest?v=${ICON_VERSION}`),appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"Hassoun"},other:{"codex-preview":"development"},icons:{icon:[{url:asset(`/hassoun-brand.svg?v=${ICON_VERSION}`),type:"image/svg+xml",sizes:"any"}],shortcut:asset(`/hassoun-brand.svg?v=${ICON_VERSION}`),apple:[{url:asset(`/hassoun-brand.svg?v=${ICON_VERSION}`),type:"image/svg+xml",sizes:"any"}]}};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#0b5b47"};

const legacyTvBootstrap = `(function(){
  var KEY='hassoun-web-masjid-tv-mode-v4';
  var p=window.location.pathname||'/';
  var q=window.location.search||'';
  var isTv=p.indexOf('/masjid-tv')!==-1;
  var forceWeb=q.indexOf('mode=web')!==-1;
  var activate=q.indexOf('activate=1')!==-1;
  try{
    if(forceWeb){sessionStorage.setItem('hassoun-force-web','1');}
    if(activate){localStorage.setItem(KEY,'enabled');sessionStorage.removeItem('hassoun-force-web');}
    if(!isTv&&!forceWeb&&sessionStorage.getItem('hassoun-force-web')!=='1'&&localStorage.getItem(KEY)==='enabled'){
      window.location.replace('/masjid-tv/?mode=tv');return;
    }
  }catch(e){}
  function ready(){
    var enter=document.getElementById('hassoun-tv-fallback');
    var exit=document.getElementById('hassoun-web-fallback');
    if(isTv){
      if(enter) enter.style.display='none';
      if(exit) exit.style.display='block';
    }else{
      if(exit) exit.style.display='none';
      if(enter) enter.style.display='block';
    }
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',ready);}else{ready();}
})();`;

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><script dangerouslySetInnerHTML={{__html:legacyTvBootstrap}}/></head><body className={`${geistSans.variable} ${geistMono.variable}`}><a id="hassoun-tv-fallback" href={asset('/masjid-tv/?mode=tv&activate=1')} style={{display:"none",position:"fixed",right:18,bottom:18,zIndex:2147483646,padding:"14px 20px",borderRadius:999,background:"#0b5b47",color:"#fff",textDecoration:"none",fontWeight:900,fontSize:14,boxShadow:"0 10px 32px rgba(0,0,0,.28)"}}>▣ ENTER MASJID TV</a><a id="hassoun-web-fallback" href={asset('/?mode=web')} style={{display:"none",position:"fixed",right:18,bottom:18,zIndex:2147483646,padding:"12px 18px",borderRadius:999,background:"rgba(255,255,255,.92)",color:"#0b5b47",textDecoration:"none",fontWeight:900,fontSize:13,boxShadow:"0 8px 24px rgba(0,0,0,.22)"}}>Website Mode</a><RemoteAppControl/>{children}<EmailManageRedirect/><NavEnhancer/><WebMasjidTvMenuEnhancer/><LocationPrayerTimesEnhancer/><LocationMovementRefresh/><PrayerAlertAudioEnhancer/><PrayerCardInteractionEnhancer/><ServiceWorkerRegistration/><WebPushRegistration/><QuranUiFixEnhancer/><QuranReferenceLayoutEnhancer/><QuranReferenceControlsEnhancer/><QuranViewModeEnhancer/><QuranTranslationLanguageEnhancer/><QuranVerseMenuEnhancer/><QuranInfoMeaningEnhancer/><QuranHeaderSearchEnhancer/><QuranHomeLinkFixEnhancer/><QuranCleanReadingEnhancer/><QuranCleanToolbarFixEnhancer/><QuranMoreMenuEnhancer/><QuranTapAnchorEnhancer/><QuranPrintedPageEnhancer/><QuranScriptTajweedEnhancer/><QuranPrintedScrollEnhancer/><QuranDesktopScrollInputFix/><QuranIndexEnhancer/><QuranAudioSystem/><QuranGlyphSafetyEnhancer/><QuranContextSurahChooserEnhancer/><QuranPageOrderGuardEnhancer/><QuranSchoolLinkEnhancer/><WebsiteLogoEnhancer/><WebAppNav/></body></html>}
