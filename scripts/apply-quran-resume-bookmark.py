from pathlib import Path

path = Path("mobile/src/quran/QuranV3.tsx")
text = path.read_text(encoding="utf-8")

old = '''  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {
    const target = getAyah(surah, ayah);
    if (!target) return;
    const next = { surah: target.surah, ayah: target.ayah };
    setPosition(next);
    setSelectedAyah(null);
    setBackTarget(from === "reader" ? "home" : from);
    persistLast(next);
    setScreen("reader");
  };'''

new = '''  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {
    const target = getAyah(surah, ayah);
    if (!target) return;
    const next = { surah: target.surah, ayah: target.ayah };
    setPosition(next);
    // A bookmark is a resume point, not merely a page reference. When a saved
    // bookmark is opened, keep that exact ayah selected so the reader visibly
    // identifies where the user stopped reading. Other navigation keeps the
    // normal clean reading view.
    setSelectedAyah(from === "bookmarks" ? target : null);
    setBackTarget(from === "reader" ? "home" : from);
    persistLast(next);
    setScreen("reader");
  };'''

if old not in text:
    raise SystemExit("QuranV3 openReader anchor not found; source changed")

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Applied exact-ayah resume bookmark behavior.")
