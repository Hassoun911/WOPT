import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(lambdaPath, 'utf8');

const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

const T = (textValue, left, top, width, size, color = '#FFFFFF', weight = 700, extra = {}) => ({
  type: 'Text', position: 'absolute', left: `${left}dp`, top: `${top}dp`, width: `${width}dp`,
  text: textValue, fontSize: `${size}dp`, fontWeight: weight, color, maxLines: 1, ...extra
});

const F = (left, top, width, height, color, radius = 20, extra = {}) => ({
  type: 'Frame', position: 'absolute', left: `${left}dp`, top: `${top}dp`, width: `${width}dp`, height: `${height}dp`,
  backgroundColor: color, borderRadius: `${radius}dp`, ...extra
});

const arabic = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const english = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
const icon = { fajr: '☾', dhuhr: '☀', asr: '☀', maghrib: '◒', isha: '☾' };
const iconColor = { fajr: '#F0DE8A', dhuhr: '#C89A35', asr: '#C89A35', maghrib: '#E8782D', isha: '#6556C8' };

const prayerItems = [];
const xs = { fajr: 40, dhuhr: 218, asr: 396, maghrib: 574, isha: 752 };
for (const key of ['fajr','dhuhr','asr','maghrib','isha']) {
  const x = xs[key];
  const active = `\${hassounData.nextPrayer.prayer == '${key}'}`;
  prayerItems.push({
    type: 'Frame', position: 'absolute', left: `${x}dp`, top: '414dp', width: '168dp', height: '104dp', borderRadius: '18dp',
    backgroundColor: `${active} ? '#168878' : '#FFFDF8'`,
    borderWidth: '1dp', borderColor: `${active} ? '#168878' : '#E7DED0'`,
    item: {
      type: 'Container', width: '100%', height: '100%', paddingLeft: '18dp', paddingTop: '12dp', paddingRight: '14dp',
      items: [
        { type: 'Text', text: english[key], fontSize: '18dp', fontWeight: 700, color: `${active} ? '#FFFFFF' : '#0D4550'` },
        { type: 'Text', text: arabic[key], fontSize: '15dp', fontWeight: 700, color: `${active} ? '#FFFFFF' : '#0D4550'`, paddingTop: '1dp' },
        { type: 'Text', text: `\${hassounData.prayers.${key}.displayTime}`, fontSize: '21dp', fontWeight: 700, color: `${active} ? '#FFFFFF' : '#0D4550'`, paddingTop: '4dp' }
      ]
    }
  });
  prayerItems.push(T(icon[key], x + 122, 429, 30, 22, iconColor[key], 700, { textAlign: 'center' }));
}

const apl = {
  type: 'APL', version: '2024.3', theme: 'light',
  mainTemplate: {
    parameters: ['hassounData'],
    items: [{
      type: 'Frame', width: '100vw', height: '100vh', backgroundColor: '#F6EFE5',
      item: {
        type: 'Container', width: '960dp', height: '600dp',
        items: [
          // Soft sunrise backdrop accents.
          F(0, 0, 960, 600, '#F6EFE5', 0),
          F(610, -60, 360, 240, '#F9E7D2', 120, { opacity: 0.42 }),
          F(-90, 420, 390, 250, '#F3DDBF', 120, { opacity: 0.28 }),

          // Header/logo — exact approved composition.
          F(44, 29, 54, 54, '#0B776C', 27),
          T('H', 44, 37, 54, 31, '#FFFFFF', 700, { textAlign: 'center' }),
          T('HASSOUN', 116, 34, 260, 31, '#0B5F58', 700),
          T('Prayer Dashboard', 116, 70, 220, 16, '#7D8887', 500),

          T('⌖', 623, 44, 18, 18, '#0B5F58', 700, { textAlign: 'center' }),
          T('${hassounData.location}', 646, 43, 190, 17, '#123F3C', 700),
          T('${hassounData.dateLabel}', 646, 67, 205, 13, '#7D8887', 500),
          T('${hassounData.hijriDate}', 646, 87, 205, 13, '#168878', 600),
          T('☾', 874, 36, 42, 30, '#D8B65D', 700, { textAlign: 'center' }),
          T('${hassounData.weatherTemp}', 866, 73, 58, 15, '#536B68', 700, { textAlign: 'center', when: "${hassounData.weatherTemp != ''}" }),
          T('${hassounData.weatherLabel}', 857, 92, 76, 11, '#8C9694', 500, { textAlign: 'center', when: "${hassounData.weatherLabel != ''}" }),

          // Main next-prayer panel.
          F(40, 109, 522, 286, '#0D746A', 22),
          F(355, 110, 207, 285, '#126C64', 0, { opacity: 0.34 }),
          T('NEXT PRAYER', 82, 145, 190, 14, '#F1F6F4', 700, { letterSpacing: 2.2 }),
          T('☾', 494, 144, 36, 30, '#F0D77D', 700, { textAlign: 'center' }),
          T('${hassounData.nextPrayer.name}', 82, 181, 300, 50, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.arabicName}', 82, 240, 300, 31, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.displayTime}', 82, 286, 260, 30, '#FFFFFF', 700),
          F(64, 336, 304, 46, '#075F57', 23),
          T('◷', 78, 346, 30, 24, '#F3C950', 700, { textAlign: 'center' }),
          T('${hassounData.nextPrayer.timeUntil}', 119, 340, 220, 18, '#FFFFFF', 700),
          T('until Adhan', 119, 361, 150, 13, '#FFFFFF', 500),

          // Subtle mosque silhouette matching approved reference, not emoji.
          F(426, 262, 58, 92, '#0A5E57', 12, { opacity: 0.38 }),
          F(404, 294, 22, 60, '#0A5E57', 7, { opacity: 0.38 }),
          F(484, 294, 22, 60, '#0A5E57', 7, { opacity: 0.38 }),
          F(438, 243, 34, 34, '#0A5E57', 17, { opacity: 0.38 }),
          F(447, 232, 16, 18, '#0A5E57', 8, { opacity: 0.38 }),

          // Right-side approved white cards.
          F(585, 121, 335, 109, '#FFFDF8', 20, { borderWidth: '1dp', borderColor: '#E8DED1' }),
          T('TODAY', 609, 146, 120, 13, '#586663', 700, { letterSpacing: 2.2 }),
          T('${hassounData.dateLabel}', 609, 174, 260, 18, '#123F3C', 700),
          T('${hassounData.hijriDate}', 609, 202, 260, 14, '#168878', 500),
          T('▣', 872, 145, 28, 22, '#9AA09E', 700, { textAlign: 'center' }),

          F(585, 246, 335, 109, '#FFFDF8', 20, { borderWidth: '1dp', borderColor: '#E8DED1' }),
          T('NEXT ISLAMIC EVENT', 609, 270, 210, 13, '#586663', 700, { letterSpacing: 2.2 }),
          T('${hassounData.eventName}', 609, 300, 240, 19, '#123F3C', 700),
          T('${hassounData.eventWhen}', 609, 329, 220, 14, '#737D7B', 500),
          T('♜', 870, 274, 30, 27, '#D3A13D', 700, { textAlign: 'center' }),

          ...prayerItems,

          // Footer exactly under prayer row.
          T('Closer to what matters.', 40, 545, 310, 24, '#0B5F58', 400, { fontStyle: 'italic' }),
          T('—  FAITH   |   FAMILY   |   COMMUNITY', 655, 557, 265, 11, '#99A2A0', 500, { textAlign: 'right', letterSpacing: 1.5 })
        ]
      }
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
console.log('Applied Alexa dashboard matching approved sunrise reference layout at 960x600dp.');
