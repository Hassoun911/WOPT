"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isQuranMedia(media: HTMLMediaElement) {
  const src = media.currentSrc || media.src || "";
  return /verses\.quran\.com|quranicaudio|qurancdn\.com|everyayah|quran\.com/i.test(src);
}

export default function QuranBackgroundMediaEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;
    if (!("mediaSession" in navigator)) return;

    const mediaSession = navigator.mediaSession;
    const basePath = pathname.replace(/\/quran\/?$/, "");
    const artwork = `${window.location.origin}${basePath}/icon-512.png`;
    const originalPlay = HTMLMediaElement.prototype.play;

    let activeMedia: HTMLMediaElement | null = null;
    let unbindActive: (() => void) | null = null;
    let lastTitle = "Qur’an audio";
    let lastArtist = "Windsor Qur’an";
    let lastAlbum = "Windsor Prayer Times";

    const safeAction = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { mediaSession.setActionHandler(action, handler); } catch { /* unsupported by this browser */ }
    };

    const updateMetadata = () => {
      if (!("MediaMetadata" in window)) return;

      const printedStatus = document.querySelector<HTMLElement>(".wopt-book-audio-status")?.textContent?.trim() || "";
      const printedDetail = document.querySelector<HTMLElement>(".wopt-book-audio-now [data-audio-detail]")?.textContent?.trim() || "";
      const printedMatch = printedStatus.match(/(?:Playing|Resumed)\s+(\d+):(\d+)(?:\s*·\s*(.+))?/i);

      if (printedMatch) {
        const [, surah, ayah, reciter] = printedMatch;
        lastTitle = `Surah ${surah} · Ayah ${ayah}`;
        lastArtist = reciter?.trim() || "Qur’an reciter";
        lastAlbum = printedDetail ? `WOPT Qur’an · ${printedDetail}` : "WOPT Qur’an";
      } else {
        const legacyTitle = document.querySelector<HTMLElement>(".wopt-now-playing strong")?.textContent?.trim();
        const legacyDetail = document.querySelector<HTMLElement>(".wopt-now-playing span")?.textContent?.trim();
        if (legacyTitle) lastTitle = legacyTitle;
        if (legacyDetail) {
          const parts = legacyDetail.split("·").map((part) => part.trim()).filter(Boolean);
          lastArtist = parts[0] || lastArtist;
          lastAlbum = parts.length > 1 ? `WOPT Qur’an · ${parts.slice(1).join(" · ")}` : "WOPT Qur’an";
        }
      }

      mediaSession.metadata = new MediaMetadata({
        title: lastTitle,
        artist: lastArtist,
        album: lastAlbum,
        artwork: [{ src: artwork, sizes: "512x512", type: "image/png" }],
      });
    };

    const updatePosition = () => {
      const media = activeMedia;
      if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return;
      const position = Math.max(0, Math.min(media.currentTime || 0, media.duration));
      try {
        mediaSession.setPositionState({
          duration: media.duration,
          playbackRate: media.playbackRate || 1,
          position,
        });
      } catch { /* unsupported or transient metadata state */ }
    };

    const stopActive = () => {
      const printedStatus = document.querySelector<HTMLElement>(".wopt-book-audio-status")?.textContent || "";
      const printedStop = document.querySelector<HTMLButtonElement>(".wopt-book-audio-backdrop [data-audio-action='stop']");
      if (printedStop && !/Stopped\.|Finished\./i.test(printedStatus)) {
        printedStop.click();
      } else {
        const legacyStop = document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='stop']");
        if (legacyStop) legacyStop.click();
        else if (activeMedia) {
          activeMedia.pause();
          try { activeMedia.currentTime = 0; } catch { /* ignore */ }
        }
      }
      mediaSession.playbackState = "none";
      try { mediaSession.setPositionState(); } catch { /* ignore */ }
    };

    const installHandlers = () => {
      safeAction("play", () => { if (activeMedia) void activeMedia.play(); });
      safeAction("pause", () => activeMedia?.pause());
      safeAction("stop", () => stopActive());
      safeAction("seekbackward", (details) => {
        if (!activeMedia) return;
        activeMedia.currentTime = Math.max(0, activeMedia.currentTime - (details.seekOffset || 10));
        updatePosition();
      });
      safeAction("seekforward", (details) => {
        if (!activeMedia || !Number.isFinite(activeMedia.duration)) return;
        activeMedia.currentTime = Math.min(activeMedia.duration, activeMedia.currentTime + (details.seekOffset || 10));
        updatePosition();
      });
      safeAction("seekto", (details) => {
        if (!activeMedia || typeof details.seekTime !== "number" || !Number.isFinite(activeMedia.duration)) return;
        activeMedia.currentTime = Math.max(0, Math.min(activeMedia.duration, details.seekTime));
        updatePosition();
      });

      // Do not leave the older player's track handlers attached to a different Audio() object.
      safeAction("previoustrack", null);
      safeAction("nexttrack", null);
    };

    const bindMedia = (media: HTMLMediaElement) => {
      if (activeMedia === media) {
        updateMetadata();
        updatePosition();
        return;
      }

      unbindActive?.();
      activeMedia = media;
      media.preload = "auto";

      const onPlaying = () => {
        mediaSession.playbackState = "playing";
        updateMetadata();
        updatePosition();
      };
      const onPause = () => {
        if (!media.ended) mediaSession.playbackState = "paused";
        updatePosition();
      };
      const onEnded = () => {
        mediaSession.playbackState = "none";
        updatePosition();
      };
      const onPosition = () => updatePosition();

      media.addEventListener("playing", onPlaying);
      media.addEventListener("play", onPlaying);
      media.addEventListener("pause", onPause);
      media.addEventListener("ended", onEnded);
      media.addEventListener("loadedmetadata", onPosition);
      media.addEventListener("durationchange", onPosition);
      media.addEventListener("timeupdate", onPosition);
      media.addEventListener("ratechange", onPosition);

      unbindActive = () => {
        media.removeEventListener("playing", onPlaying);
        media.removeEventListener("play", onPlaying);
        media.removeEventListener("pause", onPause);
        media.removeEventListener("ended", onEnded);
        media.removeEventListener("loadedmetadata", onPosition);
        media.removeEventListener("durationchange", onPosition);
        media.removeEventListener("timeupdate", onPosition);
        media.removeEventListener("ratechange", onPosition);
      };

      installHandlers();
      updateMetadata();
      if (!media.paused) mediaSession.playbackState = "playing";
      updatePosition();
    };

    const patchedPlay = function(this: HTMLMediaElement) {
      const result = originalPlay.call(this);
      Promise.resolve(result).then(() => {
        if (isQuranMedia(this)) bindMedia(this);
      }).catch(() => undefined);
      return result;
    };

    HTMLMediaElement.prototype.play = patchedPlay;

    const observer = new MutationObserver(() => {
      if (activeMedia && !activeMedia.paused) updateMetadata();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    return () => {
      observer.disconnect();
      unbindActive?.();
      if (HTMLMediaElement.prototype.play === patchedPlay) HTMLMediaElement.prototype.play = originalPlay;
      (["play", "pause", "stop", "seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack"] as MediaSessionAction[])
        .forEach((action) => safeAction(action, null));
      mediaSession.playbackState = "none";
      try { mediaSession.setPositionState(); } catch { /* ignore */ }
    };
  }, [pathname]);

  return null;
}
