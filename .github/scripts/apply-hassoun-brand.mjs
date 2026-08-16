import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceRequired(src, from, to, label) {
  if (!src.includes(from)) throw new Error(`Missing ${label}`);
  return src.replace(from, to);
}
function replaceAllSafe(path, replacements) {
  let src = read(path);
  for (const [from, to] of replacements) src = src.split(from).join(to);
  write(path, src);
}

// Native app display name/version + splash.
{
  const path = "mobile/app.config.ts";
  let src = read(path);
  src = src.replace('name: "Windsor Prayer Times"', 'name: "Hassoun"');
  src = src.replace('version: "0.3.8"', 'version: "0.4.0"');
  src = src.replace('versionCode: 11', 'versionCode: 12');
  if (!src.includes('splash: {')) {
    src = src.replace('userInterfaceStyle: "automatic",', 'userInterfaceStyle: "automatic",\n  splash: {\n    image: "./assets/splash-logo.png",\n    resizeMode: "contain",\n    backgroundColor: "#003d33"\n  },');
  }
  write(path, src);
}

// Native home/app shell branding.
{
  const path = "mobile/App.tsx";
  let src = read(path);
  if (!src.includes("  Image,")) src = src.replace("  AppState,\n", "  AppState,\n  Image,\n");
  src = src.replace('Alert.alert("Notifications are off", "Allow notifications for WOPT in Android settings, then try again.");', 'Alert.alert("Notifications are off", "Allow notifications for Hassoun in Android settings, then try again.");');
  src = src.replace('Alert.alert("Test scheduled", "Lock the phone. A WOPT notification with the reminder chime should arrive in about 15 seconds.");', 'Alert.alert("Test scheduled", "Lock the phone. A Hassoun notification with the reminder chime should arrive in about 15 seconds.");');
  src = src.replace('"Exact alarm access is off. Enable it, return to WOPT, then run the Adhan test again."', '"Exact alarm access is off. Enable it, return to Hassoun, then run the Adhan test again."');
  const oldHeader = `      <View style={styles.brandText}>\n        <Text style={styles.title}>{locale === "ar" ? "مواقيت الصلاة في وندسور" : "Windsor Prayer Times"}</Text>\n        <Text style={styles.subtitle}>📍 {CITY_LABEL}</Text>\n      </View>`;
  const newHeader = `      <Image source={require("./assets/hassoun-logo.png")} style={styles.headerLogo} />\n      <View style={styles.brandText}>\n        <Text style={styles.title}>Hassoun</Text>\n        <Text style={styles.subtitle}>{locale === "ar" ? "📍 وندسور، أونتاريو • مواقيت الصلاة" : \`📍 ${CITY_LABEL} • Prayer Times\`}</Text>\n      </View>`;
  if (src.includes(oldHeader)) src = src.replace(oldHeader, newHeader);
  src = src.replace('live ? "Synced from WOPT" : "Saved official schedule"', 'live ? (locale === "ar" ? "متزامن عبر Hassoun" : "Synced by Hassoun") : (locale === "ar" ? "الجدول الرسمي محفوظ" : "Saved official schedule")');
  src = src.replace('<Text style={styles.pageEyebrow}>✨ WOPT</Text>', '<Text style={styles.pageEyebrow}>✨ HASSOUN</Text>');
  if (!src.includes("headerLogo:")) {
    src = src.replace('  brandText: { flex: 1 },', '  headerLogo: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#003d33" },\n  brandText: { flex: 1 },');
  }
  write(path, src);
}

replaceAllSafe("mobile/AppWithEmail.tsx", [
  ["WOPT EMAIL ALERTS", "HASSOUN EMAIL ALERTS"],
  [">WOPT<", ">HASSOUN<"]
]);
replaceAllSafe("mobile/src/EmailSignupCard.tsx", [
  ["Allow location so WOPT can select your local prayer times.", "Allow location so Hassoun can select your local prayer times."],
  ["اسمح بالموقع ليختار WOPT مواقيت الصلاة المحلية.", "اسمح بالموقع ليختار Hassoun مواقيت الصلاة المحلية."]
]);
replaceAllSafe("mobile/src/notifications.ts", [
  ["WOPT updates", "Hassoun updates"],
  ["other WOPT updates", "other Hassoun updates"],
  ["WOPT test notification", "Hassoun test notification"]
]);
replaceAllSafe("mobile/src/quran/QuranV3.tsx", [
  ["WOPT QUR’AN", "HASSOUN QUR’AN"],
  ["قرآن ووبت", "قرآن Hassoun"],
  ["Return to WOPT Home", "Return to Hassoun Home"],
  ["العودة إلى الرئيسية", "العودة إلى Hassoun"],
  ["WOPT’s", "Hassoun’s"],
  ["WOPT's", "Hassoun's"],
  ["WOPT", "Hassoun"]
]);
replaceAllSafe("mobile/src/quran/SmartMemorize.tsx", [
  ["WOPT’s", "Hassoun’s"],
  ["WOPT's", "Hassoun's"],
  ["WOPT", "Hassoun"]
]);

// Prayer foreground notification branding.
{
  const path = "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAudioService.kt";
  let src = read(path);
  src = src.replace('.setContentTitle("$prayer Adhan")', '.setContentTitle("Hassoun • $prayer Adhan")');
  src = src.replace('"WOPT:PrayerAudio"', '"Hassoun:PrayerAudio"');
  write(path, src);
}

// Email brand: logo, subjects, footer, and sender display name.
{
  const path = "push-server/src/emailDelivery.ts";
  let src = read(path);
  src = src.split("WOPT").join("Hassoun");
  const oldBrand = `<td style="vertical-align:middle"><div style="width:44px;height:44px;line-height:44px;text-align:center;border-radius:14px;background:#0b5b47;color:#fff;font-size:24px;font-weight:900">و</div></td>\n              <td style="vertical-align:middle;padding-${options.locale === "ar" ? "right" : "left"}:12px;width:100%"><div style="font-size:10px;letter-spacing:2px;color:#9a8a70;font-weight:800">Hassoun</div><div style="font-size:14px;color:#355c52;font-weight:800">Prayer Times</div></td>`;
  const newBrand = `<td style="vertical-align:middle"><img src="https://hassoun911.github.io/WOPT/assets/hassoun-logo.png" width="54" height="54" alt="Hassoun" style="display:block;border:0;border-radius:15px;background:#003d33" /></td>\n              <td style="vertical-align:middle;padding-${options.locale === "ar" ? "right" : "left"}:12px;width:100%"><div style="font-size:11px;letter-spacing:2px;color:#a17825;font-weight:900">HASSOUN</div><div style="font-size:14px;color:#355c52;font-weight:800">Prayer • Qur’an • Knowledge</div></td>`;
  if (src.includes(oldBrand)) src = src.replace(oldBrand, newBrand);
  const fromNeedle = '      from: env.EMAIL_FROM,';
  const fromReplacement = '      from: env.EMAIL_FROM.includes("<") ? env.EMAIL_FROM.replace(/^[^<]+</, "Hassoun <") : `Hassoun <${env.EMAIL_FROM}>`,';
  if (src.includes(fromNeedle)) src = src.replace(fromNeedle, fromReplacement);
  write(path, src);
}

for (const path of [
  "push-server/src/adminEmail.ts",
  "push-server/src/adminPasswordReset.ts",
  "push-server/src/adminPush.ts"
]) {
  if (fs.existsSync(path)) replaceAllSafe(path, [["WOPT", "Hassoun"]]);
}

// PWA/web branding and notification title.
replaceAllSafe("pwa/app/layout.tsx", [
  ['title: "Windsor Prayer Times"', 'title: "Hassoun"'],
  ['title: "Windsor Prayer Times"', 'title: "Hassoun"']
]);
replaceAllSafe("pwa/app/page.tsx", [
  ['title: "Windsor Prayer Times"', 'title: "Hassoun"'],
  ['dataLive: "Synced from WOPT"', 'dataLive: "Synced by Hassoun"'],
  ['dataLive: "متزامن من WOPT"', 'dataLive: "متزامن عبر Hassoun"'],
  ['installTitle: "Install Windsor Prayer Times"', 'installTitle: "Install Hassoun"'],
  ['installTitle: "تثبيت تطبيق مواقيت وندسور"', 'installTitle: "تثبيت تطبيق Hassoun"']
]);
replaceAllSafe("pwa/public/sw.js", [
  ['const CACHE_NAME = "windsor-prayer-times-v11";', 'const CACHE_NAME = "hassoun-v1";'],
  ['data.title || "Windsor Prayer Times"', 'data.title || "Hassoun"'],
  ['icon: scoped("/icon-192.png")', 'icon: scoped("/assets/hassoun-logo.png")']
]);

{
  const path = "pwa/public/manifest.webmanifest";
  const manifest = JSON.parse(read(path));
  manifest.name = "Hassoun";
  manifest.short_name = "Hassoun";
  manifest.description = "Prayer times, Qur’an reading and audio, smart memorization, Islamic quizzes, reminders, and Islamic tools in one app.";
  write(path, JSON.stringify(manifest, null, 2) + "\n");
}

console.log("Hassoun rebrand patches applied");
