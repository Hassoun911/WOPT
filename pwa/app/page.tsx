"use client";

import { useEffect, useState } from "react";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
type PrayerDay = Record<PrayerKey, string>;
type PrayerTimes = Record<string, PrayerDay>;
type Sheet = "month" | "alerts" | "settings" | "install" | null;
type DevicePlatform = "android" | "ios" | "desktop";
type AlertKind = "twenty" | "ten" | "prayer";
type AlertPreferences = Record<AlertKind, boolean>;
type ThemePreference = "system" | "light" | "dark";

interface PrayerFile {
  metadata?: { year?: number; source_page?: string };
  prayer_times: PrayerTimes;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const TIMEZONE = "America/Toronto";
const prayerOrder: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const fallbackTimes: PrayerTimes = {
  "2026-08-13": { fajr: "05:00", dhuhr: "13:37", asr: "17:29", maghrib: "20:38", isha: "22:02" },
};

const labels = {
  en: {
    title: "Hassoun",
    subtitle: "Official local prayer schedule",
    city: "Windsor, Ontario",
    next: "Next prayer",
    local: "Local time",
    begins: "Begins at",
    remaining: "Time remaining",
    source: "Windsor Islamic Association • Adhan time",
    schedule: "Daily schedule",
    todays: "Daily prayers",
    month: "View month",
    verified: "Times verified for Windsor",
    verifiedText: "Showing the five daily Adhan times. Sunrise and Iqamah are intentionally excluded.",
    updated: "Live 2026 schedule",
    today: "Today",
    navToday: "Today",
    navMonth: "Month",
    navAlerts: "Alerts",
    navSettings: "Settings",
    selected: "Selected date",
    install: "Install app",
    installed: "App installed",
    installTitle: "Install Hassoun",
    installIntro: "Add the prayer-times app to your home screen for one-tap access and offline use.",
    openChrome: "Open in Chrome",
    installSteps: "On your Android phone",
    androidStep1: "Tap Open in Chrome below.",
    androidStep2: "In Chrome, tap the three-dot menu ⋮.",
    androidStep3: "Choose Install app or Add to Home screen.",
    iosStep1: "Open this page in Safari.",
    iosStep2: "Tap the Share button.",
    iosStep3: "Choose Add to Home Screen, then tap Add.",
    desktopStep1: "Open this page in Chrome or Edge.",
    desktopStep2: "Select the install icon in the address bar.",
    copyLink: "Copy app link",
    copied: "Link copied",
    close: "Close",
    monthTitle: "Monthly prayer times",
    alertsTitle: "Prayer alerts",
    alert20: "20 minutes before",
    alert20Help: "An early reminder so you have time to prepare.",
    alert10: "10 minutes before",
    alert10Help: "A second reminder as the prayer time approaches.",
    alertPrayer: "At prayer time",
    alertPrayerHelp: "A notification when the prayer time begins.",
    alertBrowserNote: "PWA alerts use your phone's notification sound. Full Adhan playback is handled by the native Android app.",
    permissionGranted: "Notifications allowed",
    permissionDenied: "Notifications blocked",
    permissionDefault: "Permission not requested",
    permissionUnsupported: "Notifications unavailable",
    settingsTitle: "App settings",
    language: "Language",
    appearance: "Appearance",
    systemTheme: "System",
    lightTheme: "Light",
    darkTheme: "Dark",
    alertSettings: "Alert settings",
    manage: "Manage",
    scheduleData: "Prayer schedule",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    dailyLight: "Daily Islamic light",
    dailyLightText: "A new Ayah, dua, and authentic Hadith selected for each Windsor day.",
    ayah: "Ayah of the day",
    dua: "Dua of the day",
    hadith: "Hadith of the day",
    sourceLink: "View source",
    offline: "Install on your phone for quick access and offline support after your first visit.",
    dataLive: "Synced by Hassoun",
    dataFallback: "Using saved schedule",
  },
  ar: {
    title: "مواقيت الصلاة في وندسور",
    subtitle: "الجدول المحلي الرسمي للصلاة",
    city: "وندسور، أونتاريو",
    next: "الصلاة القادمة",
    local: "الوقت المحلي",
    begins: "وقت الأذان",
    remaining: "الوقت المتبقي",
    source: "الجمعية الإسلامية في وندسور • وقت الأذان",
    schedule: "الجدول اليومي",
    todays: "الصلوات اليومية",
    month: "عرض الشهر",
    verified: "تم التحقق من مواقيت وندسور",
    verifiedText: "نعرض أوقات الأذان للصلوات الخمس فقط، من دون الشروق أو الإقامة.",
    updated: "جدول ٢٠٢٦ المباشر",
    today: "اليوم",
    navToday: "اليوم",
    navMonth: "الشهر",
    navAlerts: "التنبيهات",
    navSettings: "الإعدادات",
    selected: "التاريخ المحدد",
    install: "تثبيت التطبيق",
    installed: "تم تثبيت التطبيق",
    installTitle: "تثبيت تطبيق Hassoun",
    installIntro: "أضف تطبيق مواقيت الصلاة إلى الشاشة الرئيسية للوصول السريع والعمل دون اتصال.",
    openChrome: "فتح في Chrome",
    installSteps: "على هاتف أندرويد",
    androidStep1: "اضغط فتح في Chrome أدناه.",
    androidStep2: "في Chrome، اضغط قائمة النقاط الثلاث ⋮.",
    androidStep3: "اختر تثبيت التطبيق أو الإضافة إلى الشاشة الرئيسية.",
    iosStep1: "افتح هذه الصفحة في Safari.",
    iosStep2: "اضغط زر المشاركة.",
    iosStep3: "اختر إضافة إلى الشاشة الرئيسية ثم اضغط إضافة.",
    desktopStep1: "افتح هذه الصفحة في Chrome أو Edge.",
    desktopStep2: "اختر رمز التثبيت في شريط العنوان.",
    copyLink: "نسخ رابط التطبيق",
    copied: "تم نسخ الرابط",
    close: "إغلاق",
    monthTitle: "مواقيت الصلاة الشهرية",
    alertsTitle: "تنبيهات الصلاة",
    alert20: "قبل الصلاة بـ٢٠ دقيقة",
    alert20Help: "تنبيه مبكر لتستعد للصلاة.",
    alert10: "قبل الصلاة بـ١٠ دقائق",
    alert10Help: "تنبيه ثانٍ عند اقتراب وقت الصلاة.",
    alertPrayer: "عند دخول وقت الصلاة",
    alertPrayerHelp: "إشعار عند دخول وقت الصلاة.",
    alertBrowserNote: "تنبيهات الويب تستخدم صوت إشعارات الهاتف. تشغيل الأذان الكامل متوفر في تطبيق أندرويد الأصلي.",
    permissionGranted: "تم السماح بالتنبيهات",
    permissionDenied: "التنبيهات محظورة",
    permissionDefault: "لم يُطلب الإذن بعد",
    permissionUnsupported: "التنبيهات غير متاحة",
    settingsTitle: "إعدادات التطبيق",
    language: "اللغة",
    appearance: "المظهر",
    systemTheme: "النظام",
    lightTheme: "فاتح",
    darkTheme: "داكن",
    alertSettings: "إعدادات التنبيه",
    manage: "إدارة",
    scheduleData: "جدول الصلاة",
    refresh: "تحديث",
    refreshing: "جارٍ التحديث…",
    dailyLight: "نور إسلامي يومي",
    dailyLightText: "آية ودعاء وحديث صحيح مختارة لكل يوم في وندسور.",
    ayah: "آية اليوم",
    dua: "دعاء اليوم",
    hadith: "حديث اليوم",
    sourceLink: "عرض المصدر",
    offline: "ثبّت التطبيق على هاتفك للوصول السريع والعمل دون اتصال بعد الزيارة الأولى.",
    dataLive: "متزامن عبر Hassoun",
    dataFallback: "استخدام الجدول المحفوظ",
  },
};

const prayerNames: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" },
};

const dailyContent = [
  {
    ayah: { ar: "أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ", en: "Surely, hearts find comfort in the remembrance of Allah.", ref: "Qur’an 13:28", url: "https://quran.com/13/28" },
    dua: { ar: "رَبَّنَآ ءَاتِنَا فِى ٱلدُّنْيَا حَسَنَةً وَفِى ٱلْـَٔاخِرَةِ حَسَنَةً وَقِنَا عَذَابَ ٱلنَّارِ", en: "Our Lord, grant us good in this world and the Hereafter, and protect us from the Fire.", ref: "Qur’an 2:201", url: "https://quran.com/2/201" },
    hadith: { ar: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ", en: "Actions are judged by intentions.", ref: "Sahih al-Bukhari 1", url: "https://sunnah.com/bukhari:1" },
  },
  {
    ayah: { ar: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا", en: "With hardship comes ease.", ref: "Qur’an 94:5", url: "https://quran.com/94/5" },
    dua: { ar: "رَبِّ ٱشْرَحْ لِى صَدْرِى وَيَسِّرْ لِىٓ أَمْرِى وَٱحْلُلْ عُقْدَةً مِّن لِّسَانِى يَفْقَهُوا۟ قَوْلِى", en: "My Lord, uplift my heart, make my task easy, and let my speech be understood.", ref: "Qur’an 20:25–28", url: "https://quran.com/20/25-28" },
    hadith: { ar: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ", en: "The best among you are those who learn the Qur’an and teach it.", ref: "Sahih al-Bukhari 5027", url: "https://sunnah.com/bukhari:5027" },
  },
  {
    ayah: { ar: "لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا", en: "Allah does not require of any soul more than what it can afford.", ref: "Qur’an 2:286", url: "https://quran.com/2/286" },
    dua: { ar: "رَّبِّ زِدْنِى عِلْمًا", en: "My Lord, increase me in knowledge.", ref: "Qur’an 20:114", url: "https://quran.com/20/114" },
    hadith: { ar: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ", en: "Your smile for your brother is charity.", ref: "Jami‘ at-Tirmidhi 1956", url: "https://sunnah.com/tirmidhi:1956" },
  },
  {
    ayah: { ar: "لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ", en: "Do not lose hope in Allah’s mercy.", ref: "Qur’an 39:53", url: "https://quran.com/39/53" },
    dua: { ar: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً", en: "Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy.", ref: "Qur’an 3:8", url: "https://quran.com/3/8" },
    hadith: { ar: "إِنَّ الرِّفْقَ لَا يَكُونُ فِي شَيْءٍ إِلَّا زَانَهُ", en: "Kindness is not found in anything except that it adds to its beauty.", ref: "Sahih Muslim 2594a", url: "https://sunnah.com/muslim:2594a" },
  },
  {
    ayah: { ar: "وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُ", en: "Whoever puts their trust in Allah, He is sufficient for them.", ref: "Qur’an 65:3", url: "https://quran.com/65/3" },
    dua: { ar: "لَّآ إِلَـٰهَ إِلَّآ أَنتَ سُبْحَـٰنَكَ إِنِّى كُنتُ مِنَ ٱلظَّـٰلِمِينَ", en: "There is no god except You. Glory be to You; I have certainly done wrong.", ref: "Qur’an 21:87", url: "https://quran.com/21/87" },
    hadith: { ar: "الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ", en: "A strong believer is better and more beloved to Allah, while there is good in both.", ref: "Sahih Muslim 2664", url: "https://sunnah.com/muslim:2664" },
  },
  {
    ayah: { ar: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ", en: "If you are grateful, I will certainly give you more.", ref: "Qur’an 14:7", url: "https://quran.com/14/7" },
    dua: { ar: "حَسْبُنَا ٱللَّهُ وَنِعْمَ ٱلْوَكِيلُ", en: "Allah is sufficient for us, and He is the best Protector.", ref: "Qur’an 3:173", url: "https://quran.com/3/173" },
    hadith: { ar: "إِنَّ اللَّهَ لَا يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ", en: "Allah looks to your hearts and your deeds, not to your faces and wealth.", ref: "Sahih Muslim 2564c", url: "https://sunnah.com/muslim:2564c" },
  },
  {
    ayah: { ar: "قَالَ لَا تَخَافَآ ۖ إِنَّنِى مَعَكُمَآ أَسْمَعُ وَأَرَىٰ", en: "Have no fear. I am with you, hearing and seeing.", ref: "Qur’an 20:46", url: "https://quran.com/20/46" },
    dua: { ar: "رَبَّنَآ أَفْرِغْ عَلَيْنَا صَبْرًا وَتَوَفَّنَا مُسْلِمِينَ", en: "Our Lord, shower us with patience and let us die in submission to You.", ref: "Qur’an 7:126", url: "https://quran.com/7/126" },
    hadith: { ar: "أَحَبُّ الأَعْمَالِ أَدْوَمُهَا إِلَى اللَّهِ وَإِنْ قَلَّ", en: "The deeds most beloved to Allah are those done regularly, even if they are small.", ref: "Sahih al-Bukhari 6464", url: "https://sunnah.com/bukhari:6464" },
  },
] as const;

function windsorDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function minutesOf(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatPrayerTime(time: string, locale: "en" | "ar") {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2026, 0, 1, hour, minute);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function currentWindsorTime(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: value("hour"), minute: value("minute"), second: value("second") };
}

function humanCountdown(totalSeconds: number, locale: "en" | "ar") {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (locale === "ar") return `${hours ? `${hours} س ` : ""}${minutes} د`;
  return `${hours ? `${hours}h ` : ""}${minutes}m`;
}

function dailyIndex(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const daysSinceEpoch = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return Math.abs(daysSinceEpoch) % dailyContent.length;
}

export default function Home() {
  const [now, setNow] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => windsorDateKey());
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes>(fallbackTimes);
  const [isLive, setIsLive] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [alertPreferences, setAlertPreferences] = useState<AlertPreferences>({ twenty: false, ten: false, prayer: false });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>("desktop");
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("wpt-locale");
    const savedAlerts = window.localStorage.getItem("wpt-alert-preferences");
    const savedPrayerTimes = window.localStorage.getItem("wpt-prayer-times");
    const savedTheme = window.localStorage.getItem("wpt-theme");
    const hydratePreferences = window.setTimeout(() => {
      if (savedLocale === "ar") setLocale("ar");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      if (savedAlerts) {
        try {
          const parsed = JSON.parse(savedAlerts) as Partial<AlertPreferences>;
          setAlertPreferences({ twenty: Boolean(parsed.twenty), ten: Boolean(parsed.ten), prayer: Boolean(parsed.prayer) });
        } catch {
          window.localStorage.removeItem("wpt-alert-preferences");
        }
      } else if (window.localStorage.getItem("wpt-alerts") === "on") {
        setAlertPreferences({ twenty: false, ten: true, prayer: false });
      }
      setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
      if (savedPrayerTimes) {
        try {
          setPrayerTimes(JSON.parse(savedPrayerTimes) as PrayerTimes);
        } catch {
          window.localStorage.removeItem("wpt-prayer-times");
        }
      }
      const userAgent = navigator.userAgent.toLowerCase();
      setPlatform(/iphone|ipad|ipod/.test(userAgent) ? "ios" : /android/.test(userAgent) ? "android" : "desktop");
      setIsInstalled(
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      );
    }, 0);

    fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Prayer schedule unavailable");
        return response.json() as Promise<PrayerFile>;
      })
      .then((data) => {
        if (data.prayer_times) {
          setPrayerTimes(data.prayer_times);
          setIsLive(true);
          setLastSync(new Date().toISOString());
          window.localStorage.setItem("wpt-prayer-times", JSON.stringify(data.prayer_times));
        }
      })
      .catch(() => setIsLive(false));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setSheet(null);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(hydratePreferences);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("wpt-locale", locale);
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("wpt-theme", theme);
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sheet]);

  useEffect(() => {
    if (!Object.values(alertPreferences).some(Boolean) || !("Notification" in window) || Notification.permission !== "granted") return;
    const checkReminder = () => {
      const dateKey = windsorDateKey();
      const times = prayerTimes[dateKey];
      if (!times) return;
      const current = currentWindsorTime(new Date());
      const currentSeconds = current.hour * 3600 + current.minute * 60 + current.second;
      for (const key of prayerOrder) {
        const secondsUntil = minutesOf(times[key]) * 60 - currentSeconds;
        const rules: Array<{ kind: AlertKind; due: boolean; title: string }> = [
          {
            kind: "twenty",
            due: alertPreferences.twenty && secondsUntil <= 1200 && secondsUntil > 1155,
            title: locale === "ar" ? `بقي ٢٠ دقيقة على صلاة ${prayerNames[key].ar}` : `${prayerNames[key].en} in 20 minutes`,
          },
          {
            kind: "ten",
            due: alertPreferences.ten && secondsUntil <= 600 && secondsUntil > 555,
            title: locale === "ar" ? `بقي ١٠ دقائق على صلاة ${prayerNames[key].ar}` : `${prayerNames[key].en} in 10 minutes`,
          },
          {
            kind: "prayer",
            due: alertPreferences.prayer && secondsUntil <= 0 && secondsUntil > -45,
            title: locale === "ar" ? `حان الآن وقت صلاة ${prayerNames[key].ar}` : `It is time for ${prayerNames[key].en}`,
          },
        ];

        for (const rule of rules) {
          const reminderKey = `wpt-alert:${dateKey}:${key}:${rule.kind}`;
          if (!rule.due || window.localStorage.getItem(reminderKey)) continue;
          const options = { body: `${formatPrayerTime(times[key], locale)} • Windsor, Ontario`, icon: "/icon-192.png", badge: "/icon-192.png", tag: reminderKey };
          if ("serviceWorker" in navigator) {
            void navigator.serviceWorker.ready.then((registration) => registration.showNotification(rule.title, options));
          } else {
            new Notification(rule.title, options);
          }
          window.localStorage.setItem(reminderKey, "sent");
        }
      }
    };
    checkReminder();
    const reminderTimer = window.setInterval(checkReminder, 15000);
    return () => window.clearInterval(reminderTimer);
  }, [alertPreferences, locale, prayerTimes]);

  const todayKey = windsorDateKey(now);
  const selectedTimes = prayerTimes[selectedDate] ?? fallbackTimes["2026-08-13"];
  const displayDate = new Date(`${selectedDate}T12:00:00`);
  const t = labels[locale];

  const nextPrayer = (() => {
    if (selectedDate !== todayKey) {
      return { key: "fajr" as PrayerKey, seconds: 0, dayOffset: 0 };
    }
    const current = currentWindsorTime(now);
    const currentSeconds = current.hour * 3600 + current.minute * 60 + current.second;
    for (const key of prayerOrder) {
      const targetSeconds = minutesOf(selectedTimes[key]) * 60;
      if (targetSeconds > currentSeconds) return { key, seconds: targetSeconds - currentSeconds, dayOffset: 0 };
    }
    const tomorrow = prayerTimes[addDays(selectedDate, 1)];
    const fajrSeconds = minutesOf(tomorrow?.fajr ?? selectedTimes.fajr) * 60;
    return { key: "fajr" as PrayerKey, seconds: 86400 - currentSeconds + fajrSeconds, dayOffset: 1 };
  })();

  const clock = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
  const weekday = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { weekday: "long" }).format(displayDate);
  const gregorian = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric" }).format(displayDate);
  const hijri = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic" : "en-u-ca-islamic", { year: "numeric", month: "long", day: "numeric" }).format(displayDate);
  const monthPrefix = selectedDate.slice(0, 7);
  const monthRows = Object.entries(prayerTimes).filter(([date]) => date.startsWith(monthPrefix));
  const daily = dailyContent[dailyIndex(selectedDate)];
  const enabledAlertCount = Object.values(alertPreferences).filter(Boolean).length;
  const permissionLabel = notificationPermission === "granted"
    ? t.permissionGranted
    : notificationPermission === "denied"
      ? t.permissionDenied
      : notificationPermission === "unsupported"
        ? t.permissionUnsupported
        : t.permissionDefault;

  const changeDate = (days: number) => {
    const nextDate = addDays(selectedDate, days);
    if (prayerTimes[nextDate]) setSelectedDate(nextDate);
  };

  const toggleLanguage = () => setLocale((current) => (current === "en" ? "ar" : "en"));

  const toggleAlert = async (kind: AlertKind) => {
    const enabling = !alertPreferences[kind];
    if (enabling) {
      if (!("Notification" in window)) {
        setNotificationPermission("unsupported");
        return;
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") return;
    }
    setAlertPreferences((current) => {
      const next = { ...current, [kind]: !current[kind] };
      window.localStorage.setItem("wpt-alert-preferences", JSON.stringify(next));
      window.localStorage.removeItem("wpt-alerts");
      return next;
    });
  };

  const refreshSchedule = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Prayer schedule unavailable");
      const data = await response.json() as PrayerFile;
      if (!data.prayer_times) throw new Error("Prayer schedule missing");
      setPrayerTimes(data.prayer_times);
      setIsLive(true);
      setLastSync(new Date().toISOString());
      window.localStorage.setItem("wpt-prayer-times", JSON.stringify(data.prayer_times));
    } catch {
      setIsLive(false);
    } finally {
      setRefreshing(false);
    }
  };

  const installApp = async () => {
    if (isInstalled) {
      setSheet("install");
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setIsInstalled(true);
    } else {
      setSheet("install");
    }
  };

  const openInChrome = () => {
    const httpsUrl = window.location.href;
    const chromeTarget = httpsUrl.replace(/^https?:\/\//, "");
    window.location.href = `intent://${chromeTarget}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
  };

  const copyAppLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const sheetTitle = sheet === "month" ? t.monthTitle : sheet === "alerts" ? t.alertsTitle : sheet === "install" ? t.installTitle : t.settingsTitle;

  return (
    <main className="app-shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <a className="brand" href="#today" aria-label={t.title}>
          <span className="brand-mark" aria-hidden="true">و</span>
          <span><strong>{t.title}</strong><small>{t.subtitle}</small></span>
        </a>
        <div className="header-actions">
          <button className="install-button" type="button" onClick={installApp}>{t.install}</button>
          <button className="language-pill" type="button" onClick={toggleLanguage} aria-label={t.language}>
            {locale === "en" ? "EN" : "ع"} <span aria-hidden="true">⌄</span>
          </button>
          <button className="round-button" type="button" onClick={() => setSheet("alerts")} aria-label={t.alertsTitle}>
            <span aria-hidden="true">◔</span>
          </button>
          <button className="round-button" type="button" onClick={() => setSheet("settings")} aria-label={t.settingsTitle}>
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>

      <section className="dashboard" id="today">
        <div className="date-column">
          <div className={`sync-pill ${isLive ? "live" : ""}`}><span />{isLive ? t.dataLive : t.dataFallback}</div>
          <p className="eyebrow">{t.city}</p>
          <h1>{weekday}</h1>
          <p className="gregorian-date">{gregorian}</p>
          <p className="hijri-date">{hijri}</p>
          <div className="date-nav" aria-label="Choose prayer date">
            <button type="button" onClick={() => changeDate(locale === "ar" ? 1 : -1)} aria-label="Previous day">←</button>
            <button className="today-button" type="button" onClick={() => prayerTimes[todayKey] && setSelectedDate(todayKey)}>{t.today}</button>
            <button type="button" onClick={() => changeDate(locale === "ar" ? -1 : 1)} aria-label="Next day">→</button>
          </div>
        </div>

        <article className="next-prayer-card">
          <div className="next-card-head">
            <div>
              <p className="eyebrow light">{selectedDate === todayKey ? t.next : t.selected}</p>
              <h2>{locale === "ar" ? prayerNames[nextPrayer.key].ar : prayerNames[nextPrayer.key].en} <span>{locale === "ar" ? prayerNames[nextPrayer.key].en : prayerNames[nextPrayer.key].ar}</span></h2>
            </div>
            <div className="live-clock"><span>{t.local}</span><strong>{clock}</strong></div>
          </div>
          <div className="countdown-row">
            <div><span>{t.begins}</span><strong>{formatPrayerTime(selectedTimes[nextPrayer.key], locale)}</strong></div>
            <div className="countdown-divider" />
            <div><span>{t.remaining}</span><strong className="countdown">{selectedDate === todayKey ? humanCountdown(nextPrayer.seconds, locale) : "—"}</strong></div>
          </div>
          <p className="source-note"><span /> {t.source}</p>
        </article>
      </section>

      <section className="prayer-section" aria-labelledby="daily-prayers">
        <div className="section-heading">
          <div><p className="eyebrow">{t.schedule}</p><h2 id="daily-prayers">{t.todays}</h2></div>
          <button className="text-button" type="button" onClick={() => setSheet("month")}>{t.month} <span>→</span></button>
        </div>
        <div className="prayer-grid">
          {prayerOrder.map((key, index) => (
            <article className={`prayer-card ${selectedDate === todayKey && key === nextPrayer.key ? "active" : ""}`} key={key}>
              <div className="prayer-number">0{index + 1}</div>
              <div className="prayer-name"><h3>{locale === "ar" ? prayerNames[key].ar : prayerNames[key].en}</h3><span>{locale === "ar" ? prayerNames[key].en : prayerNames[key].ar}</span></div>
              <time dateTime={selectedTimes[key]}>{formatPrayerTime(selectedTimes[key], locale)}</time>
              {selectedDate === todayKey && key === nextPrayer.key && <span className="next-label">{t.next}</span>}
            </article>
          ))}
        </div>
      </section>

      <section className="daily-light-section" aria-labelledby="daily-light-title">
        <div className="section-heading daily-heading">
          <div><p className="eyebrow">{selectedDate === todayKey ? t.today : t.selected}</p><h2 id="daily-light-title">{t.dailyLight}</h2></div>
          <p>{t.dailyLightText}</p>
        </div>
        <div className="daily-light-grid">
          {(["ayah", "dua", "hadith"] as const).map((kind) => {
            const item = daily[kind];
            return (
              <article className={`daily-card ${kind}`} key={kind}>
                <div className="daily-card-top"><span>{t[kind]}</span><b aria-hidden="true">{kind === "ayah" ? "۞" : kind === "dua" ? "🤲" : "◌"}</b></div>
                <p className="daily-arabic" lang="ar" dir="rtl">{item.ar}</p>
                <p className="daily-meaning">{item.en}</p>
                <a href={item.url} target="_blank" rel="noreferrer"><strong>{item.ref}</strong><span>{t.sourceLink} ↗</span></a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="notice-card">
        <div className="notice-icon" aria-hidden="true">✓</div>
        <div><strong>{t.verified}</strong><p>{t.verifiedText}</p></div>
        <span className="verified-date">{t.updated}</span>
      </section>

      <nav className="mobile-nav" aria-label="Primary navigation">
        <button className="selected" type="button" onClick={() => { setSheet(null); if (prayerTimes[todayKey]) setSelectedDate(todayKey); }}><span>◷</span>{t.navToday}</button>
        <button type="button" onClick={() => setSheet("month")}><span>▦</span>{t.navMonth}</button>
        <button type="button" onClick={() => setSheet("alerts")}><span>◔</span>{t.navAlerts}</button>
        <button type="button" onClick={() => setSheet("settings")}><span>⚙</span>{t.navSettings}</button>
      </nav>

      {sheet && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setSheet(null)}>
          <section className={`sheet-panel ${sheet === "month" ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={sheetTitle} onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div><p className="eyebrow">{t.city}</p><h2>{sheetTitle}</h2></div>
              <button type="button" onClick={() => setSheet(null)} aria-label={t.close}>×</button>
            </div>

            {sheet === "month" && (
              <div className="month-table" role="table">
                <div className="month-row month-head" role="row"><span>{locale === "ar" ? "التاريخ" : "Date"}</span>{prayerOrder.map((key) => <span key={key}>{locale === "ar" ? prayerNames[key].ar : prayerNames[key].en}</span>)}</div>
                {monthRows.map(([date, times]) => (
                  <button className={`month-row ${date === selectedDate ? "chosen" : ""}`} type="button" role="row" key={date} onClick={() => { setSelectedDate(date); setSheet(null); }}>
                    <span>{new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00`))}</span>
                    {prayerOrder.map((key) => <span key={key}>{formatPrayerTime(times[key], locale).replace(" ", "")}</span>)}
                  </button>
                ))}
              </div>
            )}

            {sheet === "alerts" && (
              <div className="alerts-stack">
                <div className={`permission-banner ${notificationPermission}`}><span aria-hidden="true">{notificationPermission === "granted" ? "✓" : "!"}</span><div><strong>{permissionLabel}</strong><p>{enabledAlertCount} / 3 {locale === "ar" ? "تنبيهات مفعّلة" : "alerts enabled"}</p></div></div>
                <div className="setting-card">
                  <div><strong>{t.alert20}</strong><p>{t.alert20Help}</p></div>
                  <button className={`toggle ${alertPreferences.twenty ? "on" : ""}`} type="button" onClick={() => toggleAlert("twenty")} aria-pressed={alertPreferences.twenty} aria-label={t.alert20}><span /></button>
                </div>
                <div className="setting-card">
                  <div><strong>{t.alert10}</strong><p>{t.alert10Help}</p></div>
                  <button className={`toggle ${alertPreferences.ten ? "on" : ""}`} type="button" onClick={() => toggleAlert("ten")} aria-pressed={alertPreferences.ten} aria-label={t.alert10}><span /></button>
                </div>
                <div className="setting-card">
                  <div><strong>{t.alertPrayer}</strong><p>{t.alertPrayerHelp}</p></div>
                  <button className={`toggle ${alertPreferences.prayer ? "on" : ""}`} type="button" onClick={() => toggleAlert("prayer")} aria-pressed={alertPreferences.prayer} aria-label={t.alertPrayer}><span /></button>
                </div>
                <p className="sheet-note">{t.alertBrowserNote}</p>
              </div>
            )}

            {sheet === "settings" && (
              <div className="settings-stack">
                <div className="setting-card"><div><strong>{t.language}</strong><p>English / العربية</p></div><button className="setting-action" type="button" onClick={toggleLanguage}>{locale === "en" ? "العربية" : "English"}</button></div>
                <div className="setting-card smart-setting"><div><strong>{t.alertSettings}</strong><p>{permissionLabel} • {enabledAlertCount}/3</p></div><button className="setting-action" type="button" onClick={() => setSheet("alerts")}>{t.manage}</button></div>
                <div className="setting-card appearance-setting">
                  <div><strong>{t.appearance}</strong><p>{locale === "ar" ? "اختر مظهر التطبيق" : "Choose how the app looks"}</p></div>
                  <div className="segmented-control" role="group" aria-label={t.appearance}>
                    {(["system", "light", "dark"] as const).map((choice) => (
                      <button className={theme === choice ? "active" : ""} type="button" key={choice} onClick={() => setTheme(choice)}>{choice === "system" ? t.systemTheme : choice === "light" ? t.lightTheme : t.darkTheme}</button>
                    ))}
                  </div>
                </div>
                <div className="setting-card smart-setting"><div><strong>{t.scheduleData}</strong><p>{isLive ? t.dataLive : t.dataFallback}{lastSync ? ` • ${new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { hour: "numeric", minute: "2-digit" }).format(new Date(lastSync))}` : ""}</p></div><button className="setting-action" type="button" onClick={refreshSchedule} disabled={refreshing}>{refreshing ? t.refreshing : t.refresh}</button></div>
                <div className="install-card"><img src="/icon-192.png" alt="" /><div><strong>{isInstalled ? t.installed : t.install}</strong><p>{t.offline}</p></div><button type="button" onClick={installApp} aria-label={t.install}>→</button></div>
              </div>
            )}

            {sheet === "install" && (
              <div className="install-guide">
                <div className="install-app-summary">
                  <img src="/icon-192.png" alt="" />
                  <div><strong>{isInstalled ? t.installed : t.title}</strong><p>{t.installIntro}</p></div>
                </div>

                {isInstalled ? (
                  <div className="installed-message"><span aria-hidden="true">✓</span><strong>{t.installed}</strong></div>
                ) : (
                  <>
                    <div className="install-steps">
                      <strong>{platform === "android" ? t.installSteps : t.install}</strong>
                      <ol>
                        {platform === "android" && <><li>{t.androidStep1}</li><li>{t.androidStep2}</li><li>{t.androidStep3}</li></>}
                        {platform === "ios" && <><li>{t.iosStep1}</li><li>{t.iosStep2}</li><li>{t.iosStep3}</li></>}
                        {platform === "desktop" && <><li>{t.desktopStep1}</li><li>{t.desktopStep2}</li></>}
                      </ol>
                    </div>
                    <div className="install-actions">
                      {platform === "android" && <button className="primary-install-action" type="button" onClick={openInChrome}>{t.openChrome} <span>↗</span></button>}
                      <button className="secondary-install-action" type="button" onClick={copyAppLink}>{linkCopied ? t.copied : t.copyLink}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
