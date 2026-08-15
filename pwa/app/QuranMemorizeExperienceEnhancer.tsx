"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HISTORY_KEY = "wopt-quran-memorize-history-v1";
const SELECTION_KEY = "wopt-quran-memorize-selection";
const REOPEN_KEY = "wopt-quran-memorize-reopen";

type HistoryItem = {
  id: string;
  savedAt: number;
  title: string;
  verseKeys: string[];
  arabic: string;
  score?: number;
  heard?: string;
};

function readHistory(): HistoryItem[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]") as unknown;
    return Array.isArray(value) ? value.slice(0, 30) as HistoryItem[] : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
}

function readSelection(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(SELECTION_KEY) || "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeArabic(value: string) {
  return value
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreRecitation(target: string, heard: string) {
  const expected = normalizeArabic(target).split(" ").filter(Boolean);
  const spoken = normalizeArabic(heard).split(" ").filter(Boolean);
  if (!expected.length) return { score: 0, matched: 0, total: 0, missed: [] as string[] };
  let cursor = 0;
  let matched = 0;
  const missed: string[] = [];
  for (const word of expected) {
    let found = -1;
    for (let i = cursor; i < Math.min(spoken.length, cursor + 6); i += 1) {
      if (spoken[i] === word) { found = i; break; }
    }
    if (found >= 0) { matched += 1; cursor = found + 1; }
    else missed.push(word);
  }
  return { score: Math.round((matched / expected.length) * 100), matched, total: expected.length, missed: missed.slice(0, 18) };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function QuranMemorizeExperienceEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptMemorizeExperience = "true";
    style.textContent = `
      .memorize-overlay .memory-audio.wopt-memory-audio-ready{grid-template-columns:minmax(150px,1.45fr) minmax(105px,.8fr) auto auto auto!important;align-items:center!important}
      .wopt-memory-pause,.wopt-memory-stop{min-height:48px;border:1px solid #0d6857;border-radius:13px;padding:0 16px;background:#fff;color:#0c5d4f;font-weight:800;white-space:nowrap}.wopt-memory-stop{border-color:#d9dfdc;color:#555}.wopt-memory-pause:disabled,.wopt-memory-stop:disabled{opacity:.42}
      .wopt-memory-now{grid-column:1/-1;display:none;align-items:center;gap:9px;padding:9px 12px;border-radius:12px;background:#edf8f5;color:#0d6655;font:700 12px/1.35 Arial,sans-serif}.wopt-memory-now.show{display:flex}.wopt-memory-now i{width:8px;height:8px;border-radius:50%;background:#13a780;animation:woptMemoryPulse 1.2s infinite}
      @keyframes woptMemoryPulse{50%{opacity:.3;transform:scale(.72)}}
      .recitation-coach .coach-score,.recitation-coach .coach-feedback{display:none!important}.wopt-coach-live{margin-top:18px;display:grid;gap:12px}.wopt-coach-state{padding:12px 14px;border-radius:13px;background:rgba(255,255,255,.1);color:#e9f5f1;font:700 13px/1.4 Arial,sans-serif}.wopt-coach-state.listening{background:rgba(90,235,189,.16)}.wopt-coach-result{display:none;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:15px;border-radius:14px;background:#fff;color:#153b32}.wopt-coach-result.show{display:grid}.wopt-coach-score{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:#e7f6f1;color:#0d6655;font:900 19px Arial,sans-serif}.wopt-coach-detail strong{display:block;margin-bottom:4px}.wopt-coach-detail p{margin:4px 0;font-size:12px;line-height:1.5}.wopt-coach-heard{direction:rtl;text-align:right;font-family:"Noto Naskh Arabic","Amiri",serif;font-size:17px!important}
      .wopt-memory-history{margin-top:26px;padding:22px;border:1px solid #dfe7e4;border-radius:20px;background:#fff}.wopt-memory-history-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.wopt-memory-history-head h3{margin:0;color:#123f34;font-size:20px}.wopt-memory-history-head button{border:0;background:transparent;color:#0c6a57;font-weight:800}.wopt-memory-history-list{display:grid;gap:10px}.wopt-memory-history-empty{padding:18px;border-radius:13px;background:#f5f8f7;color:#7a8581;text-align:center;font-size:13px}.wopt-memory-history-item{display:grid;grid-template-columns:1fr auto;gap:10px;padding:13px 14px;border:1px solid #e5e9e7;border-radius:14px;background:#fbfcfc}.wopt-memory-history-item strong{display:block;color:#173f35}.wopt-memory-history-item small{display:block;margin-top:3px;color:#7a8380}.wopt-memory-history-item p{margin:7px 0 0;max-height:3.2em;overflow:hidden;direction:rtl;text-align:right;font-family:"Noto Naskh Arabic","Amiri",serif;font-size:16px;line-height:1.6;color:#245347}.wopt-memory-history-item button{align-self:center;border:1px solid #cfe2dc;border-radius:10px;background:#edf8f5;color:#0b6653;padding:9px 11px;font-weight:800;font-size:11px}
      @media(max-width:760px){.memorize-overlay .memory-audio.wopt-memory-audio-ready{grid-template-columns:1fr 1fr!important}.memorize-overlay .memory-audio.wopt-memory-audio-ready>button:first-of-type{grid-column:1/-1}.wopt-memory-pause,.wopt-memory-stop{min-height:46px}.wopt-memory-now{grid-column:1/-1}.wopt-memory-history{padding:16px;border-radius:16px}.wopt-memory-history-item{grid-template-columns:1fr}.wopt-memory-history-item button{justify-self:start}}
    `;
    document.head.appendChild(style);

    let activeAudio: HTMLMediaElement | null = null;
    let recognition: any = null;
    let finalHeard = "";
    let lastHistorySignature = "";

    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args: Parameters<HTMLMediaElement["play"]>) {
      const result = originalPlay.apply(this, args as []);
      if (document.querySelector(".memorize-overlay")) {
        activeAudio = this;
        window.setTimeout(syncAudioControls, 0);
      }
      return result;
    };

    const getWorkspace = () => document.querySelector<HTMLElement>(".memorize-workspace");
    const selectedArabic = () => Array.from(document.querySelectorAll<HTMLElement>(".memorize-text .memory-arabic"))
      .map((node) => node.textContent || "")
      .join(" ")
      .replace(/Tap to reveal\s+\d+:\d+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const selectionTitle = () => getWorkspace()?.querySelector("header span")?.textContent?.trim() || "Memorization selection";

    const ensureHistoryEntry = () => {
      const workspace = getWorkspace();
      if (!workspace) return;
      const arabic = selectedArabic();
      if (!arabic) return;
      const keys = readSelection();
      const signature = `${keys.join(",")}|${arabic.slice(0, 100)}`;
      if (signature === lastHistorySignature) return;
      lastHistorySignature = signature;
      const current = readHistory();
      const existing = current.find((item) => item.verseKeys.join(",") === keys.join(",") && item.arabic === arabic);
      if (!existing) {
        current.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, savedAt: Date.now(), title: selectionTitle(), verseKeys: keys, arabic });
        saveHistory(current);
      } else {
        existing.savedAt = Date.now();
        saveHistory([existing, ...current.filter((item) => item.id !== existing.id)]);
      }
      renderHistory();
    };

    const renderHistory = () => {
      const workspace = getWorkspace();
      if (!workspace) return;
      let section = workspace.querySelector<HTMLElement>(".wopt-memory-history");
      if (!section) {
        section = document.createElement("section");
        section.className = "wopt-memory-history";
        section.innerHTML = `<div class="wopt-memory-history-head"><h3>Previous practice</h3><button type="button" data-history-clear>Clear history</button></div><div class="wopt-memory-history-list"></div>`;
        workspace.appendChild(section);
      }
      const list = section.querySelector<HTMLElement>(".wopt-memory-history-list")!;
      const history = readHistory();
      if (!history.length) {
        list.innerHTML = `<div class="wopt-memory-history-empty">Your previous memorization selections and recitation results will stay here on this device.</div>`;
        return;
      }
      list.innerHTML = history.slice(0, 12).map((item) => {
        const when = new Date(item.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        const score = typeof item.score === "number" ? ` · ${item.score}% recitation match` : "";
        return `<article class="wopt-memory-history-item"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(when)}${score}</small><p>${escapeHtml(item.arabic)}</p></div><button type="button" data-history-practice="${escapeHtml(item.id)}">Practice again</button></article>`;
      }).join("");
    };

    const ensureAudioControls = () => {
      const row = document.querySelector<HTMLElement>(".memorize-overlay .memory-audio");
      if (!row || row.classList.contains("wopt-memory-audio-ready")) return;
      row.classList.add("wopt-memory-audio-ready");
      const pause = document.createElement("button");
      pause.type = "button";
      pause.className = "wopt-memory-pause";
      pause.dataset.memoryPause = "true";
      pause.textContent = "❚❚ Pause";
      pause.disabled = true;
      const stop = document.createElement("button");
      stop.type = "button";
      stop.className = "wopt-memory-stop";
      stop.dataset.memoryStop = "true";
      stop.textContent = "■ Stop";
      stop.disabled = true;
      row.appendChild(pause);
      row.appendChild(stop);
      const now = document.createElement("div");
      now.className = "wopt-memory-now";
      now.innerHTML = `<i></i><span>Selection audio ready</span>`;
      row.appendChild(now);
    };

    const syncAudioControls = () => {
      ensureAudioControls();
      const pause = document.querySelector<HTMLButtonElement>("[data-memory-pause]");
      const stop = document.querySelector<HTMLButtonElement>("[data-memory-stop]");
      const now = document.querySelector<HTMLElement>(".wopt-memory-now");
      if (!pause || !stop || !now) return;
      const available = Boolean(activeAudio && activeAudio.src);
      pause.disabled = !available;
      stop.disabled = !available;
      if (!available) {
        pause.textContent = "❚❚ Pause";
        now.classList.remove("show");
        return;
      }
      const playing = Boolean(activeAudio && !activeAudio.paused && !activeAudio.ended);
      pause.textContent = playing ? "❚❚ Pause" : "▶ Resume";
      now.classList.add("show");
      now.querySelector("span")!.textContent = playing ? "Playing selected ayah…" : "Selection audio paused";
    };

    const stopSelectionAudio = () => {
      if (!activeAudio) return;
      activeAudio.pause();
      try { activeAudio.currentTime = 0; } catch { /* ignore */ }
      activeAudio.onended = null;
      activeAudio.removeAttribute("src");
      activeAudio.load();
      activeAudio = null;
      syncAudioControls();
    };

    const ensureCoachUi = () => {
      const coach = document.querySelector<HTMLElement>(".memorize-overlay .recitation-coach");
      if (!coach) return;
      if (!coach.querySelector(".wopt-coach-live")) {
        const live = document.createElement("div");
        live.className = "wopt-coach-live";
        live.innerHTML = `<div class="wopt-coach-state">Ready. Tap Start reciting and allow microphone access.</div><div class="wopt-coach-result"><div class="wopt-coach-score">—</div><div class="wopt-coach-detail"><strong>Recitation comparison</strong><p data-coach-summary>No result yet.</p><p class="wopt-coach-heard" data-coach-heard></p><p data-coach-missed></p></div></div>`;
        coach.appendChild(live);
      }
    };

    const setCoachState = (text: string, listening = false) => {
      ensureCoachUi();
      const state = document.querySelector<HTMLElement>(".wopt-coach-state");
      if (state) { state.textContent = text; state.classList.toggle("listening", listening); }
      const button = document.querySelector<HTMLButtonElement>(".memorize-overlay .coach-action-row button");
      if (button) {
        button.textContent = listening ? "■ Stop listening" : "● Start reciting";
        button.classList.toggle("recording", listening);
      }
    };

    const renderCoachResult = (heard: string) => {
      const target = selectedArabic();
      const result = scoreRecitation(target, heard);
      ensureCoachUi();
      const panel = document.querySelector<HTMLElement>(".wopt-coach-result");
      if (!panel) return;
      panel.classList.add("show");
      const score = panel.querySelector<HTMLElement>(".wopt-coach-score");
      const summary = panel.querySelector<HTMLElement>("[data-coach-summary]");
      const heardNode = panel.querySelector<HTMLElement>("[data-coach-heard]");
      const missed = panel.querySelector<HTMLElement>("[data-coach-missed]");
      if (score) score.textContent = `${result.score}%`;
      if (summary) summary.textContent = `${result.matched} of ${result.total} words matched.`;
      if (heardNode) heardNode.textContent = heard || "No clear Arabic speech was recognized.";
      if (missed) missed.textContent = result.missed.length ? `Review: ${result.missed.join(" · ")}` : "Excellent sequence match.";

      const keys = readSelection();
      const arabic = target;
      const history = readHistory();
      let item = history.find((entry) => entry.verseKeys.join(",") === keys.join(",") && entry.arabic === arabic);
      if (!item) {
        item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, savedAt: Date.now(), title: selectionTitle(), verseKeys: keys, arabic };
        history.unshift(item);
      }
      item.savedAt = Date.now();
      item.score = result.score;
      item.heard = heard;
      saveHistory([item, ...history.filter((entry) => entry.id !== item!.id)]);
      renderHistory();
    };

    const stopRecognition = () => {
      try { recognition?.stop?.(); } catch { /* ignore */ }
      recognition = null;
      setCoachState("Stopped. Your latest recognized recitation is shown below.", false);
      if (finalHeard.trim()) renderCoachResult(finalHeard.trim());
    };

    const startRecognition = () => {
      const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!Recognition) {
        setCoachState("Arabic speech recognition is not available in this browser. Use Chrome on Android and allow microphone access.", false);
        return;
      }
      if (recognition) { stopRecognition(); return; }
      finalHeard = "";
      const instance = new Recognition();
      recognition = instance;
      instance.lang = "ar-SA";
      instance.interimResults = true;
      instance.continuous = true;
      instance.onstart = () => setCoachState("Listening… recite the selected passage now.", true);
      instance.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) finalHeard += ` ${text}`;
          else interim += ` ${text}`;
        }
        const heard = `${finalHeard} ${interim}`.trim();
        setCoachState(heard ? `Listening… heard: ${heard}` : "Listening… recite the selected passage now.", true);
        if (heard) renderCoachResult(heard);
      };
      instance.onerror = (event: any) => {
        recognition = null;
        const message = event?.error === "not-allowed" ? "Microphone permission was denied. Allow microphone access and try again." : `Listening stopped${event?.error ? `: ${event.error}` : "."}`;
        setCoachState(message, false);
      };
      instance.onend = () => {
        recognition = null;
        setCoachState(finalHeard.trim() ? "Finished listening. Review your result below." : "Listening ended. Tap Start reciting to try again.", false);
        if (finalHeard.trim()) renderCoachResult(finalHeard.trim());
      };
      const existingResult = document.querySelector<HTMLElement>(".wopt-coach-result");
      existingResult?.classList.remove("show");
      try { instance.start(); } catch { recognition = null; setCoachState("Could not start microphone listening. Try again.", false); }
    };

    const ensureWorkspace = () => {
      const workspace = getWorkspace();
      if (!workspace) return;
      ensureAudioControls();
      ensureCoachUi();
      renderHistory();
      ensureHistoryEntry();
    };

    const capture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!document.querySelector(".memorize-overlay")) return;
      if (target.closest("[data-memory-pause]")) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        if (!activeAudio) return;
        if (activeAudio.paused) void activeAudio.play(); else activeAudio.pause();
        window.setTimeout(syncAudioControls, 20);
        return;
      }
      if (target.closest("[data-memory-stop]")) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); stopSelectionAudio(); return;
      }
      if (target.closest(".coach-action-row button")) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        if (recognition) stopRecognition(); else startRecognition();
        return;
      }
      if (target.closest("[data-history-clear]")) {
        event.preventDefault(); window.localStorage.removeItem(HISTORY_KEY); renderHistory(); return;
      }
      const practice = target.closest<HTMLButtonElement>("[data-history-practice]");
      if (practice?.dataset.historyPractice) {
        const item = readHistory().find((entry) => entry.id === practice.dataset.historyPractice);
        if (item?.verseKeys.length) {
          window.localStorage.setItem(SELECTION_KEY, JSON.stringify(item.verseKeys));
          window.localStorage.setItem(REOPEN_KEY, "1");
          window.location.reload();
        }
      }
    };

    document.addEventListener("click", capture, true);

    const observer = new MutationObserver(() => ensureWorkspace());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => {
      ensureWorkspace();
      syncAudioControls();
      if (window.localStorage.getItem(REOPEN_KEY) === "1" && !document.querySelector(".memorize-overlay")) {
        const launch = document.querySelector<HTMLButtonElement>(".memorize-launch");
        if (launch) { window.localStorage.removeItem(REOPEN_KEY); launch.click(); }
      }
    }, 350);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("click", capture, true);
      stopSelectionAudio();
      try { recognition?.stop?.(); } catch { /* ignore */ }
      HTMLMediaElement.prototype.play = originalPlay;
      style.remove();
    };
  }, [pathname]);

  return null;
}
