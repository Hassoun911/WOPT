import fs from 'node:fs';

function patchFile(path, mutate) {
  let s = fs.readFileSync(path, 'utf8');
  const next = mutate(s);
  if (next === s) console.log(path + ': no changes needed');
  else { fs.writeFileSync(path, next); console.log(path + ': updated'); }
}

patchFile('App.tsx', (s) => {
  if (!s.includes('BackHandler,')) {
    s = s.replace('  AppState,\n', '  AppState,\n  BackHandler,\n');
  }
  if (!s.includes('hardwareBackPress')) {
    const marker = '  useEffect(() => {\n    const sync = () => { if (QuranAudio) setGlobalQuranAudio(QuranAudio.getStatus()); };';
    if (!s.includes(marker)) throw new Error('App back-handler insertion marker not found');
    const effect = `  useEffect(() => {\n    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {\n      // Let Qur’an sub-screens handle their own back navigation first.\n      if (activeTab === "quran" && !quranAppNavVisible) return false;\n      if (activeTab !== "home") {\n        setActiveTab("home");\n        return true;\n      }\n      return false;\n    });\n    return () => subscription.remove();\n  }, [activeTab, quranAppNavVisible]);\n\n`;
    s = s.replace(marker, effect + marker);
  }
  return s;
});

patchFile('src/SettingsHub.tsx', (s) => {
  if (!s.includes('  BackHandler,\n')) {
    s = s.replace('  Alert,\n', '  Alert,\n  BackHandler,\n');
  }
  if (!s.includes('settingsHardwareBack')) {
    const marker = '  const updateWidget = (patch: Partial<HassounWidgetPreferences>) => {';
    if (!s.includes(marker)) throw new Error('Settings back-handler insertion marker not found');
    const effect = `  useEffect(() => {\n    const settingsHardwareBack = BackHandler.addEventListener("hardwareBackPress", () => {\n      if (readerOpen) {\n        setReaderOpen(false);\n        return true;\n      }\n      if (page !== "root") {\n        setPage("root");\n        return true;\n      }\n      return false;\n    });\n    return () => settingsHardwareBack.remove();\n  }, [page, readerOpen]);\n\n`;
    s = s.replace(marker, effect + marker);
  }
  return s;
});

patchFile('src/HomePrayerPanel.tsx', (s) => {
  s = s.replace('const active = next?.prayer === prayer && !next.isTomorrow;', 'const active = next?.prayer === prayer;');
  s = s.replace('{rowUrgent ? (locale === "ar" ? "قريباً" : "SOON") : (locale === "ar" ? "القادمة" : "NEXT")}', '{rowUrgent ? (locale === "ar" ? "قريباً" : "SOON") : next?.isTomorrow ? (locale === "ar" ? "غداً" : "TOMORROW") : (locale === "ar" ? "القادمة" : "NEXT")}');
  return s;
});

patchFile('src/FeatureGuidePage.tsx', (s) => {
  // Refresh existing Al-Hafiz description to match the current interactive card tools.
  s = s.replace(
    'whatEn:"Create saved lessons from a Surah, ayah range, Mushaf page or passage, then split them into easy study cards."',
    'whatEn:"Create lessons from a Surah, ayah range, Mushaf page or pasted passage. Study cards support word audio, translation, looping, splitting, quizzes and per-card font controls."'
  );
  s = s.replace(
    'whatAr:"أنشئ دروساً محفوظة من سورة أو آيات أو صفحة مصحف أو مقطع ثم قسمها إلى بطاقات سهلة."',
    'whatAr:"أنشئ درساً من سورة أو نطاق آيات أو صفحة مصحف أو نص ملصق. تدعم البطاقات صوت الكلمة والترجمة والتكرار والتقسيم والاختبارات والتحكم بخط كل بطاقة."'
  );
  s = s.replace(
    'stepsEn:["Qur’an → Memorize / Al-Hafiz.","Create or import a lesson.","Tap Make Cards.","Listen, study, test a card or test the whole lesson."]',
    'stepsEn:["Qur’an → Memorize / Al-Hafiz.","Search and select a Surah or paste Qur’an text.","Choose the ayah range and create cards.","Tap words for audio, use translation/loop/split, then choose Fill the Blank, ABC or recitation test."]'
  );
  s = s.replace(
    'stepsAr:["القرآن ← الحفظ / الحافظ.","أنشئ أو استورد درساً.","اضغط إنشاء بطاقات.","استمع وادرس ثم اختبر بطاقة أو الدرس كاملاً."]',
    'stepsAr:["القرآن ← الحفظ / الحافظ.","ابحث عن السورة واخترها أو الصق نصاً قرآنياً.","حدد نطاق الآيات وأنشئ البطاقات.","اضغط الكلمات للصوت واستخدم الترجمة والتكرار والتقسيم ثم اختر ملء الفراغ أو ABC أو اختبار التلاوة."]'
  );

  if (!s.includes('en:"Home & next prayer"')) {
    const marker = ' {emoji:"🛠️",en:"Quick troubleshooting"';
    if (!s.includes(marker)) throw new Error('Feature guide insertion marker not found');
    const additions = ` {emoji:"🏠",en:"Home & next prayer",ar:"الرئيسية والصلاة القادمة",whatEn:"Home shows the next prayer, a live countdown, all five daily prayer times and quick Qibla access. The next prayer row stays highlighted, including tomorrow’s Fajr.",whatAr:"تعرض الرئيسية الصلاة القادمة مع عد تنازلي مباشر ومواقيت الصلوات الخمس والوصول السريع للقبلة. تبقى خانة الصلاة القادمة مميزة حتى إذا كانت فجر الغد.",stepsEn:["Open Home.","Read the large next-prayer countdown.","Find the same highlighted prayer in Today’s Prayer Times.","When 5 minutes or less remain, the warning turns red and pulses."],stepsAr:["افتح الرئيسية.","شاهد العد التنازلي الكبير للصلاة القادمة.","ستجد الصلاة نفسها مميزة في قائمة مواقيت اليوم.","عند بقاء 5 دقائق أو أقل يتحول التنبيه إلى الأحمر ويومض."],exampleEn:"After Isha, tomorrow’s Fajr is highlighted and shows the remaining time.",exampleAr:"بعد العشاء يتم تمييز فجر الغد مع عرض الوقت المتبقي.",tipEn:"🔴 Red means prayer time is within five minutes.",tipAr:"🔴 اللون الأحمر يعني أن الصلاة خلال خمس دقائق.",tags:"home next prayer countdown timer red warning tomorrow fajr"},\n {emoji:"🕋",en:"Qibla compass",ar:"بوصلة القبلة",whatEn:"Use the live compass to turn toward the Kaaba. Hassoun shows your bearing and helps indicate when you are aligned.",whatAr:"استخدم البوصلة المباشرة للتوجه نحو الكعبة. يعرض Hassoun زاوية الاتجاه ويساعدك عند مطابقة القبلة.",stepsEn:["Home → Open the Qibla compass.","Allow Location if requested.","Move the phone in a figure-eight if the compass needs calibration.","Turn until the Qibla indicator aligns."],stepsAr:["الرئيسية ← افتح بوصلة القبلة.","اسمح بالموقع إذا طُلب.","حرّك الهاتف بشكل رقم 8 إذا احتاجت البوصلة للمعايرة.","استدر حتى يتطابق مؤشر القبلة."],exampleEn:"The Qibla card shows the approximate bearing before you open the live compass.",exampleAr:"تعرض بطاقة القبلة زاوية تقريبية قبل فتح البوصلة المباشرة.",tipEn:"🧭 Keep the phone flat and away from magnets for better accuracy.",tipAr:"🧭 أبق الهاتف مستوياً وبعيداً عن المغناطيس لدقة أفضل.",tags:"qibla compass kaaba direction bearing"},\n {emoji:"⚙️",en:"More, settings & support",ar:"المزيد والإعدادات والدعم",whatEn:"More contains Qur’an appearance, widgets, prayer alerts, language, Learn the App, contact, permissions, About Hassoun and privacy/legal controls.",whatAr:"يحتوي المزيد على مظهر القرآن والويدجت وتنبيهات الصلاة واللغة وتعرّف على التطبيق والتواصل والأذونات وحول Hassoun والخصوصية والشروط.",stepsEn:["Tap More.","Choose the section you need.","Use Android Back to return to the previous Hassoun screen instead of closing the app."],stepsAr:["اضغط المزيد.","اختر القسم المطلوب.","استخدم زر الرجوع في أندرويد للعودة داخل Hassoun بدلاً من إغلاق التطبيق."],exampleEn:"Learn the App → Back returns to Settings; Back again returns to Home.",exampleAr:"تعرّف على التطبيق ← رجوع يعيدك للإعدادات ثم رجوع يعيدك للرئيسية.",tipEn:"🆘 Contact us is available inside Settings & Support.",tipAr:"🆘 التواصل معنا موجود داخل الإعدادات والدعم.",tags:"more settings support back privacy about permissions language"},\n`;
    s = s.replace(marker, additions + marker);
  }
  return s;
});
