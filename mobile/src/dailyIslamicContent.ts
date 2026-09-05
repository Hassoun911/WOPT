export type DailyIslamicContent = {
  ayah: { ar: string; en: string; ref: string };
  hadith: { ar: string; en: string; ref: string };
};

const DAILY_CONTENT: DailyIslamicContent[] = [
  {
    ayah: { ar: "أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ", en: "Surely, hearts find comfort in the remembrance of Allah.", ref: "Qur’an 13:28" },
    hadith: { ar: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ", en: "Actions are judged by intentions.", ref: "Sahih al-Bukhari 1" }
  },
  {
    ayah: { ar: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا", en: "With hardship comes ease.", ref: "Qur’an 94:5" },
    hadith: { ar: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ", en: "The best among you are those who learn the Qur’an and teach it.", ref: "Sahih al-Bukhari 5027" }
  },
  {
    ayah: { ar: "لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا", en: "Allah does not require of any soul more than what it can afford.", ref: "Qur’an 2:286" },
    hadith: { ar: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ", en: "Your smile for your brother is charity.", ref: "Jami‘ at-Tirmidhi 1956" }
  },
  {
    ayah: { ar: "لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ", en: "Do not lose hope in Allah’s mercy.", ref: "Qur’an 39:53" },
    hadith: { ar: "مَنْ لَا يَرْحَمْ لَا يُرْحَمْ", en: "Whoever does not show mercy will not be shown mercy.", ref: "Sahih al-Bukhari 6013" }
  },
  {
    ayah: { ar: "وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُ", en: "Whoever puts their trust in Allah, He is sufficient for them.", ref: "Qur’an 65:3" },
    hadith: { ar: "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ", en: "The deeds most beloved to Allah are those done consistently, even if small.", ref: "Sahih Muslim 783" }
  },
  {
    ayah: { ar: "إِنَّ ٱللَّهَ مَعَ ٱلصَّابِرِينَ", en: "Indeed, Allah is with those who are patient.", ref: "Qur’an 2:153" },
    hadith: { ar: "الطُّهُورُ شَطْرُ الإِيمَانِ", en: "Purity is half of faith.", ref: "Sahih Muslim 223" }
  },
  {
    ayah: { ar: "ٱدْعُونِىٓ أَسْتَجِبْ لَكُمْ", en: "Call upon Me; I will respond to you.", ref: "Qur’an 40:60" },
    hadith: { ar: "الدِّينُ النَّصِيحَةُ", en: "Religion is sincere counsel.", ref: "Sahih Muslim 55" }
  }
];

export function dailyIslamicContentForDate(date: Date, timeZone: string) {
  const key = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).format(date);
  let hash = 0;
  for (const char of key) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return DAILY_CONTENT[hash % DAILY_CONTENT.length];
}
