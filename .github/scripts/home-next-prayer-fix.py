from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Missing patch target: {label} in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


app = "mobile/App.tsx"
config = "mobile/app.config.ts"

replace_once(
    app,
    '''function hijriDateLabel(date: Date, locale: "en" | "ar") {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: WINDSOR_TIME_ZONE
    }).format(date);
  } catch {
    return "";
  }
}
''',
    '''function hijriDateLabel(date: Date, locale: "en" | "ar") {
  try {
    // Align the displayed Hijri date with the verified Umm al-Qura date
    // used for the Windsor calendar on Android.
    const correctedDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: WINDSOR_TIME_ZONE
    }).format(correctedDate);
  } catch {
    return "";
  }
}
''',
    "verified Umm al-Qura date",
)

replace_once(
    app,
    "      {today && next ? (\n",
    "      {next ? (\n",
    "always show next prayer card",
)

replace_once(config, 'version: "0.4.5",', 'version: "0.4.6",', "app version")
replace_once(config, 'versionCode: 17,', 'versionCode: 18,', "Android versionCode")

print("Final home next-prayer and Hijri correction applied")
