import { useEffect, useState } from "react";
import { AppState } from "react-native";
import AppExperience from "./AppExperience";

export default function AppRoot() {
  const [locationEpoch, setLocationEpoch] = useState(0);

  useEffect(() => {
    let lastActiveAt = Date.now();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const now = Date.now();
      // Recreate the app after returning from the background so prayer data is
      // fetched from the phone's current GPS position rather than a stale city.
      if (now - lastActiveAt > 30_000) setLocationEpoch((value) => value + 1);
      lastActiveAt = now;
    });
    return () => subscription.remove();
  }, []);

  return <AppExperience key={locationEpoch} />;
}
