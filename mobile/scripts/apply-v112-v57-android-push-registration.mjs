import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}

const pushPath = 'src/push.ts';
let push = fs.readFileSync(pushPath, 'utf8');

const oldFunction = `export async function registerDeviceForServerPush(locale: "en" | "ar") {\n  if (!Device.isDevice) return null;\n  const projectId = expoProjectId();\n  const pushApiUrl = Constants.expoConfig?.extra?.pushApiUrl as string | undefined;\n  if (!projectId || !pushApiUrl) return null;\n\n  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;\n  const installationId = await getInstallationId();\n\n  // Always refresh the server registration. This is intentionally not skipped\n  // when the token matches local storage because subscriber/device links and\n  // server-side preferences can change after the token was first created.\n  const response = await fetch(\`${pushApiUrl.replace(/\\\/$/, "")}/subscriptions/expo\`, {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({\n      installationId,\n      token,\n      platform: Platform.OS,\n      locale,\n      scheduleTimeZone: WINDSOR_TIME_ZONE,\n      appVersion: Constants.expoConfig?.version ?? "unknown"\n    })\n  });\n  if (!response.ok) throw new Error(\`Push registration failed: \${response.status}\`);\n  await AsyncStorage.setItem(STORAGE_KEYS.pushToken, token);\n  return token;\n}`;

const newFunction = `export async function registerDeviceForServerPush(locale: "en" | "ar") {\n  if (!Device.isDevice) return null;\n  const projectId = expoProjectId();\n  const pushApiUrl = Constants.expoConfig?.extra?.pushApiUrl as string | undefined;\n  if (!projectId || !pushApiUrl) throw new Error("Push configuration is incomplete");\n\n  // On Android, force Firebase/FCM registration first. This gives\n  // expo-notifications a real native device token before requesting the Expo token.\n  let nativeToken: string | null = null;\n  let nativeTokenType: string | null = null;\n  if (Platform.OS === "android") {\n    const native = await Notifications.getDevicePushTokenAsync();\n    nativeToken = typeof native.data === "string" ? native.data : String(native.data ?? "");\n    nativeTokenType = native.type;\n    if (!nativeToken) throw new Error("Android FCM token was empty");\n  }\n\n  const expoTokenResult = await Notifications.getExpoPushTokenAsync({ projectId });\n  const token = expoTokenResult.data;\n  if (!token) throw new Error("Expo push token was empty");\n  const installationId = await getInstallationId();\n\n  const response = await fetch(\`${pushApiUrl.replace(/\\\/$/, "")}/subscriptions/expo\`, {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({\n      installationId,\n      token,\n      nativeToken,\n      nativeTokenType,\n      platform: Platform.OS,\n      locale,\n      scheduleTimeZone: WINDSOR_TIME_ZONE,\n      appVersion: Constants.expoConfig?.version ?? "unknown"\n    })\n  });\n  if (!response.ok) {\n    const detail = await response.text().catch(() => "");\n    throw new Error(\`Push registration failed: \${response.status} \${detail.slice(0, 180)}\`);\n  }\n\n  await Promise.all([\n    AsyncStorage.setItem(STORAGE_KEYS.pushToken, token),\n    AsyncStorage.setItem("hassoun:push:last-success:v1", JSON.stringify({\n      at: new Date().toISOString(),\n      platform: Platform.OS,\n      expoTokenPrefix: token.slice(0, 24),\n      nativeTokenPresent: Boolean(nativeToken),\n      nativeTokenType\n    }))\n  ]);\n  return token;\n}`;

push = replaceOnce(push, oldFunction, newFunction, 'Android native-first push registration');
fs.writeFileSync(pushPath, push);

const configPath = 'app.config.ts';
let config = fs.readFileSync(configPath, 'utf8');
config = replaceOnce(config, 'versionCode: 56', 'versionCode: 57', 'Android versionCode');
fs.writeFileSync(configPath, config);

console.log('Applied v57 Android native-first push registration and versionCode 57');
