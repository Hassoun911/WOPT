from pathlib import Path

path = Path('mobile/src/quran/quranRendering.tsx')
text = path.read_text(encoding='utf-8')

import_line = 'import { useSafeAreaInsets } from "react-native-safe-area-context";\n'
if import_line not in text:
    anchor = 'import type { QuranAyah, QuranLocale } from "./quranData";\n'
    text = text.replace(anchor, import_line + anchor)

hook_anchor = '  const effectiveColor = appearance.pageTheme === "dark" && appearance.textColor === "#111111" ? "#f2efe7" : appearance.textColor;\n\n  return (\n'
if 'const insets = useSafeAreaInsets();' not in text:
    text = text.replace(
        hook_anchor,
        '  const effectiveColor = appearance.pageTheme === "dark" && appearance.textColor === "#111111" ? "#f2efe7" : appearance.textColor;\n  const insets = useSafeAreaInsets();\n\n  return (\n'
    )

old_footer = '          <View style={styles.sheetFooter}>\n'
new_footer = '          <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, 12), minHeight: 72 + Math.max(insets.bottom, 12) }]}>\n'
if old_footer not in text and new_footer not in text:
    raise SystemExit('Could not find settings footer')
text = text.replace(old_footer, new_footer)

old_scroll = '  sheetScroll: { padding: 18, paddingBottom: 24 },\n'
new_scroll = '  sheetScroll: { padding: 18, paddingBottom: 36 },\n'
text = text.replace(old_scroll, new_scroll)

path.write_text(text, encoding='utf-8')
print('Applied Quran appearance safe-area footer fix')
