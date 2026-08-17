from pathlib import Path

path = Path("mobile/App.tsx")
text = path.read_text(encoding="utf-8")
old = '''    // Align the displayed Hijri date with the verified Umm al-Qura date
    // used for the Windsor calendar on Android.
    const correctedDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: WINDSOR_TIME_ZONE
    }).format(correctedDate);
'''
new = '''    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: WINDSOR_TIME_ZONE
    }).format(date);
'''
if old not in text:
    raise SystemExit("Hijri correction target not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Removed erroneous one-day Hijri offset")
