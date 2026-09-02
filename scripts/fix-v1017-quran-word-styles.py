from pathlib import Path
import re

path = Path('mobile/src/quran/QuranV3.tsx')
text = path.read_text(encoding='utf-8')

styles = {
    'selectionPlayRow': '{ flexDirection: "row", gap: 7, paddingHorizontal: 10, paddingBottom: 7 }',
    'selectionPlayPill': '{ flex: 1, minHeight: 36, borderRadius: 13, backgroundColor: "#edf5f1", borderWidth: 1, borderColor: "#cfe0d8", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }',
    'selectionPlayPillText': '{ color: "#0b654f", fontSize: 8.5, fontWeight: "900" }',
    'wordAudioBlock': '{ paddingHorizontal: 10, paddingBottom: 8 }',
    'wordAudioLabel': '{ color: "#6e7d77", fontSize: 7.5, fontWeight: "800", marginBottom: 5 }',
    'wordAudioRow': '{ gap: 6, paddingRight: 8 }',
    'wordAudioChip': '{ minHeight: 34, borderRadius: 12, backgroundColor: "#fffaf0", borderWidth: 1, borderColor: "#dfd2b7", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }',
    'wordAudioChipText': '{ color: "#173f35", fontSize: 16, writingDirection: "rtl" }',
}

# Remove every previous generated copy, including copies embedded on a long StyleSheet line.
for name in styles:
    text = re.sub(rf'\s*{re.escape(name)}\s*:\s*\{{[^{{}}]*\}}\s*,?', '', text)

marker = 'const styles = StyleSheet.create({'
pos = text.find(marker)
if pos < 0:
    raise SystemExit('Could not locate StyleSheet.create for v1.0.17 Quran controls')
insert_at = pos + len(marker)
block = '\n' + ''.join(f'  {name}: {value},\n' for name, value in styles.items())
text = text[:insert_at] + block + text[insert_at:]

for name in styles:
    count = text.count(f'{name}:')
    if count != 1:
        raise SystemExit(f'Expected exactly one {name} style, found {count}')

path.write_text(text, encoding='utf-8')
print('Applied exactly one set of v1.0.17 Quran word control styles.')
