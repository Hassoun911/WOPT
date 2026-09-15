import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(lambdaPath, 'utf8');
const DASHBOARD_ARTWORK_URL = 'https://wopt-prayer-push.wopt-windsor.workers.dev/voice/alexa/dashboard.jpg';

const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

const T = (textValue, left, top, width, size, color = '#FFFFFF', weight = 700, extra = {}) => ({
  type: 'Text', position: 'absolute', left: `${left}dp`, top: `${top}dp`, width: `${width}dp`,
  text: textValue, fontSize: `${size}dp`, fontWeight: weight, color, maxLines: 1, ...extra
});
const F = (left, top, width, height, color, radius = 18, extra = {}) => ({
  type: 'Frame', position: 'absolute', left: `${left}dp`, top: `${top}dp`, width: `${width}dp`, height: `${height}dp`,
  backgroundColor: color, borderRadius: `${radius}dp`, ...extra
});

const arabic = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const english = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
const icons = { fajr: '☾', dhuhr: '☀', asr: '☀', maghrib: '◒', isha: '☾' };
const iconColors = { fajr: '#F4E09A', dhuhr: '#C79A3A', asr: '#C79A3A', maghrib: '#E9762B', isha: '#6557C7' };
const xs = { fajr: 40, dhuhr: 231, asr: 409, maghrib: 578, isha: 758 };
const ws = { fajr: 180, dhuhr: 168, asr: 159, maghrib: 169, isha: 162 };
const prayerItems = [];
for (const key of ['fajr','dhuhr','asr','maghrib','isha']) {
  const x = xs[key];
  const active = `\${hassounData.nextPrayer.prayer == '${key}'}`;
  prayerItems.push(F(x, 416, ws[key], 105, `${active} ? '#168878' : '#FFFDF8'`, 18, { borderWidth: '1dp', borderColor: `${active} ? '#168878' : '#E6DED3'` }));
  prayerItems.push(T(english[key], x + 26, 436, 105, 18, `${active} ? '#FFFFFF' : '#0D4550'`, 700));
  prayerItems.push(T(arabic[key], x + 26, 467, 105, 15, `${active} ? '#FFFFFF' : '#0D4550'`, 700));
  prayerItems.push(T(`\${hassounData.prayers.${key}.displayTime}`, x + 26, 494, 120, 20, `${active} ? '#FFFFFF' : '#0D4550'`, 700));
  prayerItems.push(T(icons[key], x + ws[key] - 54, 436, 32, 23, iconColors[key], 700, { textAlign: 'center' }));
}

const apl = {
  type: 'APL', version: '2024.3', theme: 'light',
  mainTemplate: {
    parameters: ['hassounData'],
    items: [{
      type: 'Container', width: '960dp', height: '600dp',
      items: [
        {
          type: 'Image', position: 'absolute', left: '0dp', top: '0dp', width: '960dp', height: '600dp',
          source: DASHBOARD_ARTWORK_URL, scale: 'best-fill', align: 'center'
        },

        // Header live values on the exact approved artwork.
        T('⌖', 631, 46, 20, 18, '#0B5F58', 700, { textAlign: 'center' }),
        T('${hassounData.location}', 655, 42, 185, 17, '#123F3C', 700),
        T('${hassounData.dateLabel}', 655, 66, 205, 13, '#7D8887', 500),
        T('${hassounData.hijriDate}', 655, 87, 205, 13, '#168878', 600),
        T('${hassounData.weatherTemp}', 866, 73, 58, 15, '#536B68', 700, { textAlign: 'center', when: "${hassounData.weatherTemp != ''}" }),
        T('${hassounData.weatherLabel}', 858, 92, 75, 11, '#8C9694', 500, { textAlign: 'center', when: "${hassounData.weatherLabel != ''}" }),

        // Main next-prayer live values.
        T('${hassounData.nextPrayer.name}', 82, 174, 305, 50, '#FFFFFF', 700),
        T('${hassounData.nextPrayer.arabicName}', 82, 235, 305, 31, '#FFFFFF', 700),
        T('${hassounData.nextPrayer.displayTime}', 82, 286, 270, 30, '#FFFFFF', 700),
        T('${hassounData.nextPrayer.timeUntil}', 150, 339, 220, 18, '#FFFFFF', 700),
        T('until Adhan', 150, 361, 160, 13, '#FFFFFF', 500),

        // Right cards live values.
        T('${hassounData.dateLabel}', 610, 166, 250, 18, '#123F3C', 700),
        T('${hassounData.hijriDate}', 610, 195, 250, 14, '#168878', 500),
        T('${hassounData.eventName}', 610, 294, 245, 19, '#123F3C', 700),
        T('${hassounData.eventWhen}', 610, 325, 220, 14, '#737D7B', 500),

        ...prayerItems
      ]
    }]
  }
};

const dashboardCode = `const HASSOUN_DASHBOARD = ${JSON.stringify(apl, null, 2)};\n`;
text = text.slice(0, start) + dashboardCode + text.slice(end + 1);

text = text.replace(
  'return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));',
  'return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));'
);
if (!text.includes('arabicName: ({ fajr: "الفجر"')) {
  text = text.replace('nextPrayer: {\n      ...next,', 'nextPrayer: {\n      ...next,\n      arabicName: ({ fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" })[next.prayer] || "الصلاة",');
}
if (!text.includes('weatherTemp:')) {
  text = text.replace('hijriDate: data.hijriDate || "",', 'hijriDate: data.hijriDate || "",\n    weatherTemp: data.weather?.temperature || data.weatherTemp || "",\n    weatherLabel: data.weather?.label || data.weatherLabel || "",');
}

fs.writeFileSync(lambdaPath, text);
console.log('Applied exact approved Alexa artwork from HTTPS endpoint with live overlays at 960x600dp.');
