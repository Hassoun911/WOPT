import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}

const configPath = 'app.config.ts';
let config = fs.readFileSync(configPath, 'utf8');

if (!config.includes('googleServicesFile: "./google-services.json"')) {
  config = replaceOnce(
    config,
    '  android: {\n    package: "ca.wopt.windsorprayertimes",',
    '  android: {\n    googleServicesFile: "./google-services.json",\n    package: "ca.wopt.windsorprayertimes",',
    'Android googleServicesFile'
  );
}

config = replaceOnce(config, 'versionCode: 55', 'versionCode: 56', 'Android versionCode');
fs.writeFileSync(configPath, config);

const googleServices = JSON.parse(fs.readFileSync('google-services.json', 'utf8'));
const clients = Array.isArray(googleServices.client) ? googleServices.client : [];
const matchingClient = clients.find((client) => client?.client_info?.android_client_info?.package_name === 'ca.wopt.windsorprayertimes');
if (!matchingClient) throw new Error('google-services.json does not contain ca.wopt.windsorprayertimes');

console.log('Applied Firebase native push config and versionCode 56');
