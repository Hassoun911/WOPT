from pathlib import Path

qpath = Path('mobile/src/quran/QuranV3.tsx')
q = qpath.read_text(encoding='utf-8')

# Replace the entire reader pan responder with one canonical rule set.
start = q.find('  const readerPanResponder = useMemo(')
end = q.find('\n\n  const handleVerticalTouchStart', start)
if start < 0 or end <= start:
    raise SystemExit('Could not locate readerPanResponder block')
q = q[:start] + '''  const readerPanResponder = useMemo(\n    () => PanResponder.create({\n      onStartShouldSetPanResponder: () => false,\n      onMoveShouldSetPanResponderCapture: (_event, gestureState) => {\n        const horizontal = Math.abs(gestureState.dx);\n        const vertical = Math.abs(gestureState.dy);\n        // Horizontal Mushaf paging only. Vertical movement is reading/scrolling only.\n        return horizontal >= 24 && horizontal > vertical * 1.35;\n      },\n      onPanResponderRelease: (_event, gestureState) => {\n        const horizontal = Math.abs(gestureState.dx);\n        const vertical = Math.abs(gestureState.dy);\n        if (horizontal < 42 || horizontal <= vertical * 1.35) return;\n        // Arabic-book behavior requested for Hassoun:\n        // finger LEFT => NEXT page, finger RIGHT => PREVIOUS page.\n        if (gestureState.dx <= -42) turnReaderPage(1);\n        else if (gestureState.dx >= 42) turnReaderPage(-1);\n      },\n      onPanResponderTerminate: () => {\n        verticalGestureStartY.current = null;\n      }\n    }),\n    [currentPage, spreadMode]\n  );''' + q[end:]

# Vertical touch handlers are explicitly no-op for paging.
start = q.find('  const handleVerticalTouchStart = ')
end = q.find('\n\n  const handleVerticalTouchEnd', start)
if start < 0 or end <= start:
    raise SystemExit('Could not locate vertical touch start block')
q = q[:start] + '''  const handleVerticalTouchStart = (_event: { nativeEvent: { pageY: number } }) => {\n    verticalGestureStartY.current = null;\n  };''' + q[end:]

start = q.find('  const handleVerticalTouchEnd = ')
end_candidates = [
    q.find('\n\n  const handleReaderSurfaceTouchStart', start),
    q.find('\n\n  const handleReaderSurfaceTouchEnd', start),
    q.find('\n\n  const ', start + 10),
]
end = next((x for x in end_candidates if x > start), -1)
if start < 0 or end <= start:
    raise SystemExit('Could not locate vertical touch end block')
q = q[:start] + '''  const handleVerticalTouchEnd = (_event: { nativeEvent: { pageY: number } }) => {\n    verticalGestureStartY.current = null;\n  };''' + q[end:]

# Remove any scroll-end auto paging callback that may survive from older sources.
needle = 'onScrollEndDrag={() => {'
pos = 0
while True:
    s = q.find(needle, pos)
    if s < 0:
        break
    e = q.find('}}', s)
    if e < 0:
        break
    block = q[s:e+2]
    if 'turnReaderPage(' in block:
        q = q[:s] + 'onScrollEndDrag={() => { readerScrollDirection.current = null; }}' + q[e+2:]
        pos = s + 20
    else:
        pos = e + 2

# Hard fail if any known wrong/vertical paging logic remains.
forbidden = [
    'turnReaderPage(gestureState.dx > 0 ? 1 : -1)',
    'turnReaderPage(gestureState.dx < 0 ? -1 : 1)',
    'if (dy < 0 && (readerAtBottom.current || contentFits)) turnReaderPage(1)',
    'else if (dy > 0 && (readerAtTop.current || contentFits)) turnReaderPage(-1)',
    'readerScrollDirection.current === "down" && (readerAtBottom.current || contentFits)',
]
for marker in forbidden:
    if marker in q:
        raise SystemExit('Forbidden reader gesture logic remains: ' + marker)

required = [
    'gestureState.dx <= -42) turnReaderPage(1)',
    'gestureState.dx >= 42) turnReaderPage(-1)',
    'const handleVerticalTouchEnd = (_event',
]
for marker in required:
    if marker not in q:
        raise SystemExit('Missing required reader gesture rule: ' + marker)

qpath.write_text(q, encoding='utf-8')
print('Applied v1.0.18 hard reader gesture fix: LEFT next, RIGHT previous, vertical never pages.')
