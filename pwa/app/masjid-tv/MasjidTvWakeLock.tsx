"use client";

import { useEffect } from "react";

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export default function MasjidTvWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinelLike | null = null;
    let stopped = false;

    const requestLock = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const nav = navigator as WakeLockNavigator;
      if (!nav.wakeLock?.request) return;
      if (sentinel && !sentinel.released) return;
      try {
        sentinel = await nav.wakeLock.request("screen");
        sentinel.addEventListener?.("release", () => {
          sentinel = null;
          if (!stopped && document.visibilityState === "visible") {
            window.setTimeout(requestLock, 250);
          }
        });
      } catch {
        // Some TV browsers require a user gesture before wake lock is granted.
        // Visibility/click listeners below will retry automatically.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") requestLock();
    };
    const onUserGesture = () => requestLock();

    requestLock();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", requestLock);
    document.addEventListener("pointerdown", onUserGesture, { passive: true });
    document.addEventListener("keydown", onUserGesture);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", requestLock);
      document.removeEventListener("pointerdown", onUserGesture);
      document.removeEventListener("keydown", onUserGesture);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, []);

  return null;
}
