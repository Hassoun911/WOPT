import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
const bgPath = 'integrations/alexa/assets/dashboard-bg.b64';
let text = fs.readFileSync(lambdaPath, 'utf8');
const bg = fs.readFileSync(bgPath, 'utf8').trim();

const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

const T = (textValue, left, top, width, size, color = '#FFFFFF', weight = 700, extra = {}) => ({
  type: 'Text',
  position: 'absolute',
  left: `${left}dp`,
  top: `${top}dp`,
  width: `${width}dp`,
  text: textValue,
  fontSize: `${size}dp`,
  fontWeight: weight,
  color,
  maxLines: 1,
  ...extra,
});

const prayerCard = (key, english, arabic, icon, left) => [
  T(english, left, 622, 155, 20, '#FFFFFF', 700),
  T(arabic, left, 650, 155, 18, '#FFFFFF', 700),
  T(icon, left + 145, 622, 34, 25, '#FFE25F', 700, { textAlign: 'right' }),
  T(`\${hassounData.prayers.${key}.displayTime}`, left, 688, 165, 22, '#FFFFFF', 700),
];

const apl = {
  type: 'APL',
  version: '2024.3',
  theme: 'light',
  mainTemplate: {
    parameters: ['hassounData'],
    items: [
      {
        type: 'Container',
        width: '100vw',
        height: '100vh',
        items: [
          {
            type: 'Image',
            position: 'absolute',
            left: '0dp',
            top: '0dp',
            width: '100vw',
            height: '100vh',
            scale: 'fill',
            source: `data:image/jpeg;base64,${bg}`,
          },

          T('${hassounData.location}', 748, 91, 290, 18, '#0D4F58', 700),
          T('${hassounData.dateLabel}', 748, 121, 300, 14, '#8EA7AD', 500),
          T('${hassounData.hijriDate}', 748, 145, 300, 14, '#00B6AA', 600),
          T('${hassounData.weatherTemp}', 1110, 116, 95, 18, '#365D68', 700, { textAlign: 'center' }),
          T('${hassounData.weatherLabel}', 1110, 143, 95, 13, '#8EA7AD', 500, { textAlign: 'center' }),

          T('${hassounData.dateLabel}', 750, 268, 365, 24, '#0D4550', 700),
          T('${hassounData.hijriDate}', 750, 306, 365, 17, '#00B6AA', 500),
          T('${hassounData.eventName}', 750, 428, 345, 25, '#0D4550', 700),
          T('${hassounData.eventWhen}', 750, 467, 345, 17, '#78939A', 500),

          T('${hassounData.nextPrayer.name}', 145, 246, 420, 58, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.arabicName}', 145, 322, 420, 35, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.displayTime}', 145, 380, 300, 31, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.timeUntil}', 206, 493, 300, 18, '#FFFFFF', 700),
          T('until Adhan', 206, 520, 220, 14, '#FFFFFF', 500),

          ...prayerCard('fajr', 'Fajr', 'الفجر', '☾', 111),
          ...prayerCard('dhuhr', 'Dhuhr', 'الظهر', '☀', 350),
          ...prayerCard('asr', 'Asr', 'العصر', '☀', 586),
          ...prayerCard('maghrib', 'Maghrib', 'المغرب', '◓', 820),
          ...prayerCard('isha', 'Isha', 'العشاء', '☾', 1058),
        ],
      },
    ],
  },
};

const dashboardCode = `const HASSOUN_DASHBOARD = ${JSON.stringify(apl, null, 2)};\n`;
text = text.slice(0, start) + dashboardCode + text.slice(end + 1);

text = text.replace(
  'return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));',
  'return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));'
);

if (!text.includes('arabicName: ({ fajr: "الفجر"')) {
  text = text.replace(
    'nextPrayer: {\n      ...next,',
    'nextPrayer: {\n      ...next,\n      arabicName: ({ fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" })[next.prayer] || "الصلاة",'
  );
}

if (!text.includes('weatherTemp:')) {
  text = text.replace(
    'hijriDate: data.hijriDate || "",',
    'hijriDate: data.hijriDate || "",\n    weatherTemp: data.weather?.temperature || data.weatherTemp || "",\n    weatherLabel: data.weather?.label || data.weatherLabel || "",'
  );
}

fs.writeFileSync(lambdaPath, text);
console.log('Applied approved image-backed Alexa dashboard with live data overlays.');
