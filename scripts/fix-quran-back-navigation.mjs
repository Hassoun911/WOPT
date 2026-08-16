import fs from 'node:fs';

const path = 'pwa/app/QuranIndexEnhancer.tsx';
let src = fs.readFileSync(path, 'utf8');

const oldState = `    let chapters: Chapter[] = [];
    const open = () => { overlay.classList.add("open"); renderLocal(); void loadChapters(); };
    const close = () => overlay.classList.remove("open");
    const setBookPage = (page: number) => {
      close();`;

const newState = `    let chapters: Chapter[] = [];
    const historyState = () => (window.history.state || {}) as Record<string, unknown>;
    const ensureIndexHistory = () => {
      const current = historyState();
      if (current.woptQuranIndex || current.woptQuranReader || current.woptQuranSearchResult) return;
      window.history.replaceState({ ...current, woptQuranIndex: true }, "", window.location.href);
    };
    const enterReaderHistory = () => {
      const current = historyState();
      if (current.woptQuranReader) return;
      window.history.pushState({ ...current, woptQuranIndex: false, woptQuranReader: true }, "", window.location.href);
    };
    const open = () => { overlay.classList.add("open"); renderLocal(); void loadChapters(); };
    const close = () => overlay.classList.remove("open");
    const setBookPage = (page: number) => {
      enterReaderHistory();
      close();`;

if (!src.includes(oldState)) throw new Error('state insertion anchor not found');
src = src.replace(oldState, newState);

const oldClose = `      if (target.closest(".wopt-qindex-close")) { close(); return; }`;
const newClose = `      if (target.closest(".wopt-qindex-close")) { enterReaderHistory(); close(); return; }`;
if (!src.includes(oldClose)) throw new Error('close anchor not found');
src = src.replace(oldClose, newClose);

const oldOpenEvent = `    const onOpenEvent = () => open();

    overlay.addEventListener("click", onClick);`;
const newOpenEvent = `    const onOpenEvent = () => {
      const current = historyState();
      if (current.woptQuranReader && !overlay.classList.contains("open")) {
        window.history.back();
        return;
      }
      open();
    };
    const onPopState = (event: PopStateEvent) => {
      const next = (event.state || {}) as Record<string, unknown>;
      if (next.woptQuranIndex) {
        open();
        return;
      }
      if (next.woptQuranReader || next.woptQuranSearchResult) close();
    };

    overlay.addEventListener("click", onClick);`;
if (!src.includes(oldOpenEvent)) throw new Error('open-event anchor not found');
src = src.replace(oldOpenEvent, newOpenEvent);

const oldListeners = `    window.addEventListener("wopt-quran-open-index", onOpenEvent);

    // Qur’an opens to the smart index by default. Internal reader actions can reopen it anytime.
    window.setTimeout(open, 80);`;
const newListeners = `    window.addEventListener("wopt-quran-open-index", onOpenEvent);
    window.addEventListener("popstate", onPopState);

    // Qur’an index is the first in-section history level; reader pages sit one level above it.
    ensureIndexHistory();
    window.setTimeout(open, 80);`;
if (!src.includes(oldListeners)) throw new Error('listener anchor not found');
src = src.replace(oldListeners, newListeners);

const oldCleanup = `      window.removeEventListener("wopt-quran-open-index", onOpenEvent);
      overlay.remove();`;
const newCleanup = `      window.removeEventListener("wopt-quran-open-index", onOpenEvent);
      window.removeEventListener("popstate", onPopState);
      overlay.remove();`;
if (!src.includes(oldCleanup)) throw new Error('cleanup anchor not found');
src = src.replace(oldCleanup, newCleanup);

fs.writeFileSync(path, src);
