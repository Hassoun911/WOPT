import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}

const pushPath = 'src/push.ts';
let push = fs.readFileSync(pushPath, 'utf8');
const start = push.indexOf('export async function registerDeviceForServerPush(locale: "en" | "ar") {');
if (start < 0) throw new Error('Missing registerDeviceForServerPush function');

const newFunction = [
  'export async function registerDeviceForServerPush(locale: "en" | "ar") {',
  '  if (!Device.isDevice) return null;',
  '  const projectId = expoProjectId();',
  '  const pushApiUrl = Constants.expoConfig?.extra?.pushApiUrl as string | undefined;',
  '  if (!projectId || !pushApiUrl) throw new Error("Push configuration is incomplete");',
  '',
  '  // Force native Firebase registration first on Android so an FCM token exists',
  '  // before Expo creates the project-scoped push token.',
  '  let nativeToken: string | null = null;',
  '  let nativeTokenType: string | null = null;',
  '  if (Platform.OS === "android") {',
  '    const native = await Notifications.getDevicePushTokenAsync();',
  '    nativeToken = typeof native.data === "string" ? native.data : String(native.data ?? "");',
  '    nativeTokenType = native.type;',
  '    if (!nativeToken) throw new Error("Android FCM token was empty");',
  '  }',
  '',
  '  const expoTokenResult = await Notifications.getExpoPushTokenAsync({ projectId });',
  '  const token = expoTokenResult.data;',
  '  if (!token) throw new Error("Expo push token was empty");',
  '  const installationId = await getInstallationId();',
  '',
  '  const response = await fetch(`${pushApiUrl.replace(/\\\/$/, "")}/subscriptions/expo`, {',
  '    method: "POST",',
  '    headers: { "Content-Type": "application/json" },',
  '    body: JSON.stringify({',
  '      installationId,',
  '      token,',
  '      nativeToken,',
  '      nativeTokenType,',
  '      platform: Platform.OS,',
  '      locale,',
  '      scheduleTimeZone: WINDSOR_TIME_ZONE,',
  '      appVersion: Constants.expoConfig?.version ?? "unknown"',
  '    })',
  '  });',
  '  if (!response.ok) {',
  '    const detail = await response.text().catch(() => "");',
  '    throw new Error(`Push registration failed: ${response.status} ${detail.slice(0, 180)}`);',
  '  }',
  '',
  '  await Promise.all([',
  '    AsyncStorage.setItem(STORAGE_KEYS.pushToken, token),',
  '    AsyncStorage.setItem("hassoun:push:last-success:v1", JSON.stringify({',
  '      at: new Date().toISOString(),',
  '      platform: Platform.OS,',
  '      expoTokenPrefix: token.slice(0, 24),',
  '      nativeTokenPresent: Boolean(nativeToken),',
  '      nativeTokenType',
  '    }))',
  '  ]);',
  '  return token;',
  '}',
  ''
].join('\n');

push = push.slice(0, start) + newFunction;
fs.writeFileSync(pushPath, push);

const configPath = 'app.config.ts';
let config = fs.readFileSync(configPath, 'utf8');
config = replaceOnce(config, 'versionCode: 56', 'versionCode: 57', 'Android versionCode');
fs.writeFileSync(configPath, config);

console.log('Applied v57 Android native-first push registration and versionCode 57');
