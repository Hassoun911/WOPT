import { useEffect, useState } from "react";
import { DEFAULT_REMOTE_CONTROL, type RemoteControlConfig } from "./remoteConfig";

let currentRemoteControl: RemoteControlConfig = DEFAULT_REMOTE_CONTROL;
const listeners = new Set<(config: RemoteControlConfig) => void>();

export function setRemoteControlConfig(config: RemoteControlConfig) {
  currentRemoteControl = config;
  for (const listener of listeners) listener(config);
}

export function getRemoteControlConfig() {
  return currentRemoteControl;
}

export function useRemoteControl() {
  const [config, setConfig] = useState(currentRemoteControl);
  useEffect(() => {
    listeners.add(setConfig);
    setConfig(currentRemoteControl);
    return () => { listeners.delete(setConfig); };
  }, []);
  return config;
}
