import fs from 'node:fs';

const path='src/quran/QuranV3.tsx';
let s=fs.readFileSync(path,'utf8');

const oldStart='onTouchStart={(event) => { handleReaderSurfaceTouchStart(event); handleVerticalTouchStart(event); }}';
const newStart='onTouchStart={(event) => { handleReaderSurfaceTouchStart(event); if (appearance.browseMode === "vertical") handleVerticalTouchStart(event); }}';
const oldEnd='onTouchEnd={(event) => { handleReaderSurfaceTouchEnd(event); handleVerticalTouchEnd(event); }}';
const newEnd='onTouchEnd={(event) => { handleReaderSurfaceTouchEnd(event); if (appearance.browseMode === "vertical") handleVerticalTouchEnd(event); }}';
if (s.includes(oldStart)) s=s.replace(oldStart,newStart);
if (s.includes(oldEnd)) s=s.replace(oldEnd,newEnd);

const oldDrag=`onScrollEndDrag={() => {
              const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;
              if (readerScrollDirection.current === "down" && (readerAtBottom.current || contentFits)) {
                turnReaderPage(1);
              } else if (readerScrollDirection.current === "up" && (readerAtTop.current || contentFits)) {
                turnReaderPage(-1);
              }
              readerScrollDirection.current = null;
            }}`;
const newDrag=`onScrollEndDrag={() => {
              // Page turns from vertical scrolling are allowed only in Vertical browse mode.
              // Horizontal mode must be exclusive: vertical movement may never change pages.
              if (appearance.browseMode !== "vertical") {
                readerScrollDirection.current = null;
                return;
              }
              const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;
              if (readerScrollDirection.current === "down" && (readerAtBottom.current || contentFits)) {
                turnReaderPage(1);
              } else if (readerScrollDirection.current === "up" && (readerAtTop.current || contentFits)) {
                turnReaderPage(-1);
              }
              readerScrollDirection.current = null;
            }}`;
if (!s.includes(newDrag)) {
  if (!s.includes(oldDrag)) throw new Error('Missing Quran onScrollEndDrag marker');
  s=s.replace(oldDrag,newDrag);
}

fs.writeFileSync(path,s);
console.log('Applied exclusive Quran browse direction: horizontal-only or vertical-only');