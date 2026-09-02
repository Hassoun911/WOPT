from pathlib import Path

path = Path('mobile/src/quran/QuranV3.tsx')
text = path.read_text(encoding='utf-8')

if 'wordAudioChip:' not in text:
    marker = 'actionTransport:'
    pos = text.find(marker)
    if pos < 0:
        raise SystemExit('Could not locate actionTransport style for v1.0.17 word controls')
    line_start = text.rfind('\n', 0, pos) + 1
    indent = text[line_start:pos]
    styles = (
        f'{indent}selectionPlayRow: {{ flexDirection: "row", gap: 7, paddingHorizontal: 10, paddingBottom: 7 }},\n'
        f'{indent}selectionPlayPill: {{ flex: 1, minHeight: 36, borderRadius: 13, backgroundColor: "#edf5f1", borderWidth: 1, borderColor: "#cfe0d8", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }},\n'
        f'{indent}selectionPlayPillText: {{ color: "#0b654f", fontSize: 8.5, fontWeight: "900" }},\n'
        f'{indent}wordAudioBlock: {{ paddingHorizontal: 10, paddingBottom: 8 }},\n'
        f'{indent}wordAudioLabel: {{ color: "#6e7d77", fontSize: 7.5, fontWeight: "800", marginBottom: 5 }},\n'
        f'{indent}wordAudioRow: {{ gap: 6, paddingRight: 8 }},\n'
        f'{indent}wordAudioChip: {{ minHeight: 34, borderRadius: 12, backgroundColor: "#fffaf0", borderWidth: 1, borderColor: "#dfd2b7", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }},\n'
        f'{indent}wordAudioChipText: {{ color: "#173f35", fontSize: 16, writingDirection: "rtl" }},\n'
    )
    text = text[:line_start] + styles + text[line_start:]

required = ['selectionPlayRow:', 'selectionPlayPill:', 'wordAudioBlock:', 'wordAudioChip:', 'wordAudioChipText:']
for marker in required:
    if marker not in text:
        raise SystemExit(f'Missing Quran word style: {marker}')

path.write_text(text, encoding='utf-8')
print('Applied v1.0.17 Quran word control styles.')
