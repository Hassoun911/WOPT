import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getInstallationId } from "./installation";

const DEVICE_KEY = "hassoun:wall-remote:device:v1";
const CONTROLLERS_KEY = "hassoun:wall-remote:controllers:v1";

export type WallRemoteDisplayState = {
  id: number;
  name: string;
  settings: Record<string, any>;
  settingsVersion: number;
  status: Record<string, any>;
  lastSeenAt?: string | null;
  updatedAt?: string | null;
};

export type WallDeviceIdentity = {
  displayId: number;
  deviceToken: string;
  pairingCode: string;
  pairingExpiresAt?: string | null;
};

export type WallControllerLink = {
  controllerToken: string;
  displayId: number;
  displayName: string;
  lastSeenAt?: string | null;
};

function apiBase() {
  const value = Constants.expoConfig?.extra?.pushApiUrl as string | undefined;
  return (value || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase()}${path}`, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data?.error || `Wall remote request failed (${response.status})`);
  return data;
}

function jsonInit(body: unknown, token?: string, method = "POST"): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  };
}

export async function loadWallDeviceIdentity(): Promise<WallDeviceIdentity | null> {
  const raw = await AsyncStorage.getItem(DEVICE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as WallDeviceIdentity; } catch { return null; }
}

async function saveWallDeviceIdentity(identity: WallDeviceIdentity) {
  await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(identity));
}

export async function ensureWallDisplayRegistered(name: string, settings: Record<string, any>) {
  const installationId = await getInstallationId();
  const previous = await loadWallDeviceIdentity();
  const data = await request(
    "/wall/display/register",
    jsonInit({
      installationId,
      name,
      settings,
      deviceToken: previous?.deviceToken
    })
  );
  const identity: WallDeviceIdentity = {
    displayId: Number(data.display.id),
    deviceToken: String(data.deviceToken),
    pairingCode: String(data.pairingCode || ""),
    pairingExpiresAt: data.pairingExpiresAt ?? null
  };
  await saveWallDeviceIdentity(identity);
  return { identity, display: data.display as WallRemoteDisplayState };
}

export async function refreshWallPairingCode() {
  const identity = await loadWallDeviceIdentity();
  if (!identity) throw new Error("Wall display is not registered yet");
  const data = await request("/wall/display/pairing", jsonInit({}, identity.deviceToken));
  const next = { ...identity, pairingCode: String(data.pairingCode || "") };
  await saveWallDeviceIdentity(next);
  return next;
}

export async function publishWallDeviceSettings(settings: Record<string, any>) {
  const identity = await loadWallDeviceIdentity();
  if (!identity) return false;
  await request("/wall/display/settings", jsonInit({ settings }, identity.deviceToken));
  return true;
}

export async function postWallDeviceStatus(status: Record<string, any>) {
  const identity = await loadWallDeviceIdentity();
  if (!identity) return false;
  await request("/wall/display/status", jsonInit({ status }, identity.deviceToken));
  return true;
}

export function startWallDeviceSync(options: {
  identity: WallDeviceIdentity;
  onSettings: (settings: Record<string, any>, version: number) => void;
  onCommand: (command: Record<string, any>, version: number) => void | Promise<void>;
  getStatus: () => Record<string, any>;
  initialSettingsVersion?: number;
  initialCommandVersion?: number;
}) {
  let stopped = false;
  let settingsVersion = options.initialSettingsVersion ?? 0;
  let commandVersion = options.initialCommandVersion ?? 0;
  let syncing = false;
  let lastStatusAt = 0;

  const tick = async () => {
    if (stopped || syncing) return;
    syncing = true;
    try {
      const data = await request("/wall/display/sync", {
        method: "GET",
        headers: { Authorization: `Bearer ${options.identity.deviceToken}` }
      });
      const nextSettingsVersion = Number(data.settingsVersion ?? 0);
      if (nextSettingsVersion > settingsVersion && data.settings && typeof data.settings === "object") {
        settingsVersion = nextSettingsVersion;
        options.onSettings(data.settings, settingsVersion);
      }
      const nextCommandVersion = Number(data.commandVersion ?? 0);
      if (nextCommandVersion > commandVersion && data.command && typeof data.command === "object") {
        commandVersion = nextCommandVersion;
        await options.onCommand(data.command, commandVersion);
      }
      if (typeof data.pairingCode === "string" && data.pairingCode) {
        const current = await loadWallDeviceIdentity();
        if (current && current.pairingCode !== data.pairingCode) {
          await saveWallDeviceIdentity({ ...current, pairingCode: data.pairingCode, pairingExpiresAt: data.pairingExpiresAt ?? null });
        }
      }
      if (Date.now() - lastStatusAt >= 15_000) {
        lastStatusAt = Date.now();
        await postWallDeviceStatus(options.getStatus()).catch(() => undefined);
      }
    } catch {
      // Remote control must never take the wall display down if the network is offline.
    } finally {
      syncing = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), 3_000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function loadControllerLinks(): Promise<WallControllerLink[]> {
  const raw = await AsyncStorage.getItem(CONTROLLERS_KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

async function saveControllerLinks(links: WallControllerLink[]) {
  await AsyncStorage.setItem(CONTROLLERS_KEY, JSON.stringify(links));
}

export async function listPairedWallDisplays() {
  return loadControllerLinks();
}

export async function pairWallDisplay(pairingCode: string, controllerName = "My Hassoun") {
  const controllerInstallationId = await getInstallationId();
  const data = await request(
    "/wall/controller/pair",
    jsonInit({
      pairingCode: pairingCode.trim().toUpperCase(),
      controllerInstallationId,
      controllerName
    })
  );
  const display = data.display as WallRemoteDisplayState;
  const link: WallControllerLink = {
    controllerToken: String(data.controllerToken),
    displayId: Number(display.id),
    displayName: display.name,
    lastSeenAt: display.lastSeenAt ?? null
  };
  const links = await loadControllerLinks();
  const next = [link, ...links.filter((item) => item.displayId !== link.displayId)];
  await saveControllerLinks(next);
  return { link, display };
}

export async function getWallControllerState(link: WallControllerLink) {
  const data = await request("/wall/controller/state", {
    method: "GET",
    headers: { Authorization: `Bearer ${link.controllerToken}` }
  });
  return data.display as WallRemoteDisplayState;
}

export async function updateRemoteWallSettings(link: WallControllerLink, settings: Record<string, any>) {
  await request("/wall/controller/settings", jsonInit({ settings }, link.controllerToken));
}

export async function sendRemoteWallCommand(link: WallControllerLink, command: string, payload: Record<string, any> = {}) {
  await request("/wall/controller/command", jsonInit({ command, payload }, link.controllerToken));
}

export async function revokeRemoteWallLink(link: WallControllerLink) {
  await request("/wall/controller", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${link.controllerToken}` }
  }).catch(() => undefined);
  const links = await loadControllerLinks();
  await saveControllerLinks(links.filter((item) => item.displayId !== link.displayId));
}
