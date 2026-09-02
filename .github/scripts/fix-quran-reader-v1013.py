from pathlib import Path

path = Path('mobile/src/quran/QuranV3.tsx')
text = path.read_text(encoding='utf-8')

old_touch = '''  const handleVerticalTouchEnd = (event: { nativeEvent: { pageY: number } }) => {
    if (appearance.browseMode !== "vertical") {
      verticalGestureStartY.current = null;
      return;
    }
    const start = verticalGestureStartY.current;
    verticalGestureStartY.current = null;
    if (start == null) return;
    const dy = event.nativeEvent.pageY - start;
    if (Math.abs(dy) < 24) return;

    // A Mushaf page that fits entirely inside the viewport never produces enough
    // scroll events to mark itself as "at bottom". Treat it as both scroll edges
    // so an upward/downward page gesture always works. This applies regardless of
    // whether the reader was opened from Surah, Juz, Pages, Search or Bookmark.
    const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;
    if (dy < 0 && (readerAtBottom.current || contentFits)) turnReaderPage(1);
    else if (dy > 0 && (readerAtTop.current || contentFits)) turnReaderPage(-1);
  };
'''
new_touch = '''  const handleVerticalTouchEnd = (_event: { nativeEvent: { pageY: number } }) => {
    // Normal vertical reading gestures must never change Mushaf pages. Page changes
    // are explicit through the Previous / Next controls below the page so the user
    // can rest at the bottom of a page without being moved while still reading.
    verticalGestureStartY.current = null;
  };
'''
if old_touch not in text:
    raise SystemExit('vertical touch block not found')
text = text.replace(old_touch, new_touch, 1)

old_drag = '''            onScrollEndDrag={() => {
              const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;
              if (readerScrollDirection.current === "down" && (readerAtBottom.current || contentFits)) {
                turnReaderPage(1);
              } else if (readerScrollDirection.current === "up" && (readerAtTop.current || contentFits)) {
                turnReaderPage(-1);
              }
              readerScrollDirection.current = null;
            }}
'''
new_drag = '''            onScrollEndDrag={() => {
              // Reaching either scroll edge is not a page-turn command.
              readerScrollDirection.current = null;
            }}
'''
if old_drag not in text:
    raise SystemExit('scroll-end block not found')
text = text.replace(old_drag, new_drag, 1)

old_page = '''            {spreadMode ? <View style={styles.bookSpread}>{spreadLeftPage ? <View style={styles.bookPageSlot}>{renderMushafPage(spreadLeftPage)}</View> : <View style={[styles.bookPageSlot, styles.blankBookPage]} /> }<View style={styles.bookGutter} /><View style={styles.bookPageSlot}>{renderMushafPage(spreadRightPage)}</View></View> : renderMushafPage(currentPage)}
'''
new_page = '''            {spreadMode ? <View style={styles.bookSpread}>{spreadLeftPage ? <View style={styles.bookPageSlot}>{renderMushafPage(spreadLeftPage)}</View> : <View style={[styles.bookPageSlot, styles.blankBookPage]} /> }<View style={styles.bookGutter} /><View style={styles.bookPageSlot}>{renderMushafPage(spreadRightPage)}</View></View> : renderMushafPage(currentPage)}
            <View style={styles.readerPageNav}>
              <Pressable disabled={currentPage <= 1} onPress={() => turnReaderPage(-1)} style={[styles.readerPageNavButton, currentPage <= 1 && styles.readerPageNavDisabled]}>
                <Text style={styles.readerPageNavArrow}>{ar ? "›" : "‹"}</Text>
                <Text style={styles.readerPageNavText}>{tr("Previous page", "الصفحة السابقة")}</Text>
              </Pressable>
              <View style={styles.readerPageNumberPill}><Text style={styles.readerPageNumberText}>{tr(`Page ${currentPage}`, `صفحة ${num(currentPage)}`)}</Text></View>
              <Pressable disabled={currentPage >= 604} onPress={() => turnReaderPage(1)} style={[styles.readerPageNavButton, currentPage >= 604 && styles.readerPageNavDisabled]}>
                <Text style={styles.readerPageNavText}>{tr("Next page", "الصفحة التالية")}</Text>
                <Text style={styles.readerPageNavArrow}>{ar ? "‹" : "›"}</Text>
              </Pressable>
            </View>
'''
if old_page not in text:
    raise SystemExit('page render anchor not found')
text = text.replace(old_page, new_page, 1)

text = text.replace('bookCanvas: { padding: 8, paddingBottom: 12 }', 'bookCanvas: { padding: 8, paddingBottom: 104 }', 1)

style_anchor = '''  readerBody: { flex: 1, backgroundColor: "#e9e5dc" },'''
style_insert = '''  readerPageNav: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 3, paddingTop: 10, paddingBottom: 8 },
  readerPageNavButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: "#edf5f1", borderWidth: 1, borderColor: "#d8e5df", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 7 },
  readerPageNavDisabled: { opacity: .35 },
  readerPageNavArrow: { color: "#0b654f", fontSize: 21, fontWeight: "900" },
  readerPageNavText: { color: "#0b654f", fontSize: 8, fontWeight: "900", textAlign: "center" },
  readerPageNumberPill: { minWidth: 74, minHeight: 48, borderRadius: 16, backgroundColor: "#103f35", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  readerPageNumberText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  readerBody: { flex: 1, backgroundColor: "#e9e5dc" },'''
if style_anchor not in text:
    raise SystemExit('style anchor not found')
text = text.replace(style_anchor, style_insert, 1)

path.write_text(text, encoding='utf-8')
print('Applied Quran reader safety fixes: no overlay obstruction and no scroll-driven page turns.')
