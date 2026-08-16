from pathlib import Path

path = Path("pwa/app/QuranHeaderSearchEnhancer.tsx")
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"{label} target not found")
    text = text.replace(old, new, 1)


replace_once(
    'type SearchTarget = { verseKey: string; query: string; savedAt: number };',
    'type SearchTarget = { verseKey: string; query: string; savedAt: number; page?: number };',
    'SearchTarget type',
)

replace_once(
    '''    let searching = false;\n    let activeQuery = "";''',
    '''    let searching = false;\n    let activeQuery = "";\n    let searchReturnScroll = 0;\n    let searchResultActive = false;\n    let highlightClearTimer = 0;''',
    'search state',
)

start = text.index('    const applyPendingHighlight = () => {')
end = text.index('\n\n    const open = () => {', start)
new_highlight = r'''    const isVisibleVerseNode = (node: HTMLElement) => {
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    };

    const clearSearchHighlight = () => {
      if (highlightClearTimer) {
        window.clearTimeout(highlightClearTimer);
        highlightClearTimer = 0;
      }
      document.querySelectorAll(".wopt-search-hit,.wopt-search-word").forEach((node) => node.classList.remove("wopt-search-hit", "wopt-search-word"));
    };

    const applyPendingHighlight = () => {
      let target: SearchTarget | null = null;
      try { target = JSON.parse(window.localStorage.getItem(SEARCH_TARGET_KEY) || "null") as SearchTarget | null; } catch { target = null; }
      if (!target?.verseKey || Date.now() - target.savedAt > 180000) return false;

      const matches = Array.from(document.querySelectorAll<HTMLElement>(`[data-verse-key="${target.verseKey}"]`));
      const ayah = matches.find((node) => Boolean(node.closest(".wopt-printed-reader")) && isVisibleVerseNode(node))
        || matches.find(isVisibleVerseNode)
        || null;
      if (!ayah) return false;

      clearSearchHighlight();
      ayah.classList.add("wopt-search-hit");

      const q = normalize(target.query);
      if (q && !/^\d{1,3}\s*[:\/]\s*\d{1,3}$/.test(target.query)) {
        const terms = q.split(" ").filter((term) => term.length > 1);
        ayah.querySelectorAll<HTMLElement>(".quran-word").forEach((word) => {
          const wordText = normalize(word.textContent || "");
          if (wordText && terms.some((term) => wordText.includes(term) || term.includes(wordText))) word.classList.add("wopt-search-word");
        });
      }

      ayah.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      window.localStorage.removeItem(SEARCH_TARGET_KEY);
      highlightClearTimer = window.setTimeout(clearSearchHighlight, 20000);
      return true;
    };

    const waitForPendingHighlight = async () => {
      const started = Date.now();
      while (Date.now() - started < 6500) {
        if (applyPendingHighlight()) return true;
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      return false;
    };

    const pageForVerse = async (key: string) => {
      const localNodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-verse-key="${key}"]`));
      const local = localNodes.find(isVisibleVerseNode) || localNodes[0];
      const localPage = Number(local?.dataset.page || local?.closest<HTMLElement>("[data-printed-page]")?.dataset.printedPage || 0);
      if (localPage) return localPage;
      try {
        const response = await fetch(`${API}/verses/by_key/${encodeURIComponent(key)}?language=en&words=false&fields=page_number`);
        if (!response.ok) return 0;
        const data = await response.json() as { verse?: { page_number?: number } };
        return Number(data.verse?.page_number || 0);
      } catch {
        return 0;
      }
    };'''
text = text[:start] + new_highlight + text[end:]

old_open = '''    const open = () => {\n      renderHistory();\n      overlay.classList.add("open");\n      window.setTimeout(() => input.focus(), 40);\n    };\n    const close = () => overlay.classList.remove("open");'''
new_open = r'''    const open = (restoreResults = false) => {
      renderHistory();
      overlay.classList.add("open");
      if (restoreResults) {
        window.setTimeout(() => { results.scrollTop = searchReturnScroll; }, 0);
      } else {
        window.setTimeout(() => input.focus(), 40);
      }
    };
    const close = () => overlay.classList.remove("open");

    const navigateToResult = async (key: string) => {
      const chapterId = Number(key.split(":")[0]);
      const query = activeQuery || input.value.trim();
      const page = await pageForVerse(key);
      if (!page) {
        results.insertAdjacentHTML("afterbegin", `<div class="wopt-search-status">Could not open ${escapeHtml(key)}. Please try again.</div>`);
        return;
      }

      const savedAt = Date.now();
      searchReturnScroll = results.scrollTop;
      searchResultActive = true;
      window.localStorage.setItem(LAST_READ_KEY, JSON.stringify({ chapterId, verseKey: key, page, savedAt }));
      window.localStorage.setItem(SEARCH_TARGET_KEY, JSON.stringify({ verseKey: key, query, page, savedAt } satisfies SearchTarget));
      window.history.pushState(
        { woptQuranSearchResult: true, key, query, page, searchScroll: searchReturnScroll },
        "",
        `${pathname}?searchVerse=${encodeURIComponent(key)}`,
      );
      close();
      window.dispatchEvent(new CustomEvent("wopt-quran-book-mode", { detail: { enabled: true, page } }));
      window.setTimeout(() => { void waitForPendingHighlight(); }, 60);
    };

    const onPopState = (event: PopStateEvent) => {
      const state = (event.state || {}) as { woptQuranSearchResult?: boolean; key?: string; query?: string; page?: number; searchScroll?: number };
      if (state.woptQuranSearchResult && state.key && state.page) {
        searchResultActive = true;
        activeQuery = state.query || activeQuery;
        input.value = activeQuery;
        searchReturnScroll = Number(state.searchScroll || 0);
        const savedAt = Date.now();
        window.localStorage.setItem(SEARCH_TARGET_KEY, JSON.stringify({ verseKey: state.key, query: activeQuery, page: state.page, savedAt } satisfies SearchTarget));
        close();
        window.dispatchEvent(new CustomEvent("wopt-quran-book-mode", { detail: { enabled: true, page: state.page } }));
        window.setTimeout(() => { void waitForPendingHighlight(); }, 60);
        return;
      }

      if (searchResultActive) {
        searchResultActive = false;
        window.localStorage.removeItem(SEARCH_TARGET_KEY);
        clearSearchHighlight();
        open(true);
      }
    };'''
replace_once(old_open, new_open, 'open/close block')

old_result = r'''      const result = target.closest<HTMLButtonElement>(".wopt-search-result[data-key]");
      if (result?.dataset.key) {
        const key = result.dataset.key;
        const chapterId = Number(key.split(":")[0]);
        const query = activeQuery || input.value.trim();
        const savedAt = Date.now();
        window.localStorage.setItem(LAST_READ_KEY, JSON.stringify({ chapterId, verseKey: key, savedAt }));
        window.localStorage.setItem(SEARCH_TARGET_KEY, JSON.stringify({ verseKey: key, query, savedAt } satisfies SearchTarget));
        close();
        const destination = `${window.location.pathname}?searchVerse=${encodeURIComponent(key)}`;
        window.location.assign(destination);
      }'''
new_result = r'''      const result = target.closest<HTMLButtonElement>(".wopt-search-result[data-key]");
      if (result?.dataset.key) {
        void navigateToResult(result.dataset.key);
      }'''
replace_once(old_result, new_result, 'result click block')

replace_once(
    '''    renderHistory();\n    let highlightAttempts = 0;''',
    '''    window.addEventListener("popstate", onPopState);\n\n    renderHistory();\n    let highlightAttempts = 0;''',
    'popstate registration',
)

replace_once(
    '''    return () => {\n      window.clearInterval(highlightTimer);\n      document.removeEventListener("click", capture, true);\n      overlay.remove();\n      style.remove();\n    };''',
    '''    return () => {\n      window.clearInterval(highlightTimer);\n      if (highlightClearTimer) window.clearTimeout(highlightClearTimer);\n      window.removeEventListener("popstate", onPopState);\n      document.removeEventListener("click", capture, true);\n      overlay.remove();\n      style.remove();\n    };''',
    'cleanup block',
)

path.write_text(text)
