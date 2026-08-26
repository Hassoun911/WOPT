import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}

const appPath = 'AppWithEmail.tsx';
let app = fs.readFileSync(appPath, 'utf8');

app = replaceOnce(
  app,
  '    <View style={styles.root}>\n      <SystemMessageTicker locale={locale} />\n      <App onOpenEmailAlerts={runtime.emailEnabled ? () => void open() : undefined} />',
  '    <View style={styles.root}>\n      <App onOpenEmailAlerts={runtime.emailEnabled ? () => void open() : undefined} />\n      <View pointerEvents="none" style={[styles.systemTickerOverlay, { top: Math.max(insets.top, 0) }]}>\n        <SystemMessageTicker locale={locale} />\n      </View>',
  'ticker overlay placement'
);

app = replaceOnce(
  app,
  '  root: { flex: 1 },',
  '  root: { flex: 1 },\n  systemTickerOverlay: { position: "absolute", left: 0, right: 0, zIndex: 95, elevation: 15 },',
  'ticker overlay style'
);

fs.writeFileSync(appPath, app);

const configPath = 'app.config.ts';
let config = fs.readFileSync(configPath, 'utf8');
config = replaceOnce(config, 'versionCode: 54', 'versionCode: 55', 'Android versionCode');
fs.writeFileSync(configPath, config);

console.log('Applied v1.0.12 ticker placement fix and versionCode 55');
