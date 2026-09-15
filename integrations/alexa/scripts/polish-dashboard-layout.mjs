import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(lambdaPath, 'utf8');

const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

// The approved artwork was designed at 1280x800. Alexa's Hub Landscape
// Medium viewport is 960x600dp, so render the exact same composition at
// 75% rather than allowing Alexa to crop a fixed 1280dp canvas.
const SCALE = 0.75;
const dp = (value) => `${Math.round(value * SCALE * 100) / 100}dp`;

const T = (textValue, left, top, width, size, color = '#FFFFFF', weight = 700, extra = {}) => ({
  type: 'Text',
  position: 'absolute',
  left: dp(left),
  top: dp(top),
  width: dp(width),
  text: textValue,
  fontSize: dp(size),
  fontWeight: weight,
  color,
  maxLines: 1,
  ...extra,
});

const frame = (left, top, width, height, color, radius = 22, extra = {}) => ({
  type: 'Frame',
  position: 'absolute',
  left: dp(left),
  top: dp(top),
  width: dp(width),
  height: dp(height),
  borderRadius: dp(radius),
  backgroundColor: color,
  ...extra,
});

const arabic = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const english = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
const icon = { fajr: '☾', dhuhr: '☀', asr: '☀', maghrib: '◒', isha: '☾' };
const iconColor = { fajr: '#F6E08C', dhuhr: '#C99A32', asr: '#C99A32', maghrib: '#E7742D', isha: '#6756C7' };
const tileLeft = { fajr: 52, dhuhr: 300, asr: 548, maghrib: 796, isha: 1044 };

const tileItems = [];
for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
  const left = tileLeft[key];
  tileItems.push({
    type: 'Frame',
    position: 'absolute',
    left: dp(left),
    top: dp(554),
    width: dp(218),
    height: dp(145),
    borderRadius: dp(22),
    backgroundColor: `\${hassounData.nextPrayer.prayer == '${key}' ? '#168878' : '#FFFDF8'}`,
    item: {
      type: 'Container',
      width: '100%',
      height: '100%',
      paddingLeft: dp(22),
      paddingRight: dp(18),
      paddingTop: dp(16),
      paddingBottom: dp(14),
      items: [
        { type: 'Text', text: english[key], fontSize: dp(23), fontWeight: 700, color: `\${hassounData.nextPrayer.prayer == '${key}' ? '#FFFFFF' : '#0D4550'}` },
        { type: 'Text', text: arabic[key], fontSize: dp(21), fontWeight: 700, color: `\${hassounData.nextPrayer.prayer == '${key}' ? '#FFFFFF' : '#0D4550'}`, paddingTop: dp(2) },
        { type: 'Text', text: `\${hassounData.prayers.${key}.displayTime}`, fontSize: dp(26), fontWeight: 700, color: `\${hassounData.nextPrayer.prayer == '${key}' ? '#FFFFFF' : '#0D4550'}`, paddingTop: dp(6) }
      ]
    }
  });
  tileItems.push(T(icon[key], left + 158, 574, 38, 28, iconColor[key], 700, { textAlign: 'center' }));
}

const apl = {
  type: 'APL',
  version: '2024.3',
  theme: 'light',
  mainTemplate: {
    parameters: ['hassounData'],
    items: [{
      type: 'Frame',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#F7F2E8',
      item: {
        type: 'Container',
        width: '960dp',
        height: '600dp',
        items: [
          frame(58, 34, 66, 66, '#168878', 33),
          T('H', 58, 47, 66, 38, '#FFFFFF', 700, { textAlign: 'center' }),
          T('HASSOUN', 141, 34, 360, 41, '#0D5C57', 700),
          T('Prayer Dashboard', 141, 79, 320, 21, '#7C8988', 500),

          T('⌖', 824, 49, 28, 26, '#0D5C57', 700, { textAlign: 'center' }),
          T('${hassounData.location}', 858, 49, 285, 22, '#0D4550', 700),
          T('${hassounData.dateLabel}', 858, 79, 300, 17, '#7C8988', 500),
          T('${hassounData.hijriDate}', 858, 105, 300, 17, '#168878', 600),
          T('☾', 1168, 40, 50, 38, '#D7B35C', 700, { textAlign: 'center' }),
          T('${hassounData.weatherTemp}', 1157, 91, 72, 18, '#526B69', 700, { textAlign: 'center', when: "${hassounData.weatherTemp != ''}" }),
          T('${hassounData.weatherLabel}', 1148, 116, 90, 14, '#8A9695', 500, { textAlign: 'center', when: "${hassounData.weatherLabel != ''}" }),

          frame(52, 128, 698, 405, '#117D70', 24),
          T('⌒', 484, 128, 265, 200, '#2D9287', 300, 400, { opacity: 0.25, textAlign: 'center' }),
          T('🕌', 515, 320, 210, 180, '#0B625A', 145, 400, { opacity: 0.22, textAlign: 'center' }),
          T('NEXT PRAYER', 104, 171, 260, 16, '#EFF7F3', 700, { letterSpacing: 2 }),
          T('☾', 652, 168, 48, 38, '#F5E28B', 700, { textAlign: 'center' }),
          T('${hassounData.nextPrayer.name}', 104, 220, 430, 64, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.arabicName}', 104, 300, 430, 42, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.displayTime}', 104, 360, 360, 38, '#FFFFFF', 700),
          frame(84, 447, 405, 64, '#0A6057', 32),
          T('◷', 106, 462, 36, 28, '#F0C94F', 700, { textAlign: 'center' }),
          T('${hassounData.nextPrayer.timeUntil}', 154, 454, 300, 23, '#FFFFFF', 700),
          T('until Adhan', 154, 484, 220, 17, '#FFFFFF', 500),

          frame(780, 144, 447, 154, '#FFFDF8', 22),
          T('TODAY', 810, 177, 190, 15, '#5B6665', 700, { letterSpacing: 2 }),
          T('${hassounData.dateLabel}', 810, 216, 340, 23, '#0D4550', 700),
          T('${hassounData.hijriDate}', 810, 254, 340, 19, '#168878', 500),
          T('▣', 1162, 175, 35, 28, '#98A09E', 700, { textAlign: 'center' }),

          frame(780, 320, 447, 155, '#FFFDF8', 22),
          T('NEXT ISLAMIC EVENT', 810, 352, 270, 15, '#5B6665', 700, { letterSpacing: 2 }),
          T('${hassounData.eventName}', 810, 394, 325, 25, '#0D4550', 700),
          T('${hassounData.eventWhen}', 810, 433, 300, 18, '#6F7977', 500),
          T('♜', 1156, 356, 44, 38, '#D7A738', 700, { textAlign: 'center' }),

          ...tileItems,

          T('Closer to what matters.', 52, 729, 420, 28, '#0D5C57', 400, { fontStyle: 'italic' }),
          T('—  FAITH   |   FAMILY   |   COMMUNITY', 871, 742, 350, 15, '#9AA2A1', 500, { textAlign: 'right', letterSpacing: 1.5 })
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
console.log('Applied approved Alexa dashboard fitted to Hub Landscape Medium (960x600dp).');
