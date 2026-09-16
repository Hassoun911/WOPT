import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(lambdaPath, 'utf8');

const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

const BACKGROUND_URL = 'https://raw.githubusercontent.com/Hassoun911/WOPT/main/integrations/alexa/assets/dashboard-template-960x600.jpg?v=approved-20260916-1';

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

const F = (left, top, width, height, color, radius = 18, extra = {}) => ({
  type: 'Frame',
  position: 'absolute',
  left: `${left}dp`,
  top: `${top}dp`,
  width: `${width}dp`,
  height: `${height}dp`,
  backgroundColor: color,
  borderRadius: `${radius}dp`,
  ...extra,
});

const prayers = {
  fajr:    { en: 'Fajr',    ar: 'الفجر',   x: 40,  w: 181, icon: '☾', iconColor: '#F2E7A4' },
  dhuhr:   { en: 'Dhuhr',   ar: 'الظهر',   x: 232, w: 166, icon: '☀', iconColor: '#D3A13A' },
  asr:     { en: 'Asr',     ar: 'العصر',   x: 408, w: 159, icon: '☀', iconColor: '#D3A13A' },
  maghrib: { en: 'Maghrib', ar: 'المغرب',  x: 578, w: 170, icon: '◒', iconColor: '#E7782D' },
  isha:    { en: 'Isha',    ar: 'العشاء',  x: 758, w: 162, icon: '☾', iconColor: '#6659D4' },
};

const prayerItems = [];
for (const [key, p] of Object.entries(prayers)) {
  const activeWhen = `\${hassounData.nextPrayer.prayer == '${key}'}`;
  const inactiveWhen = `\${hassounData.nextPrayer.prayer != '${key}'}`;

  for (const state of [
    { when: inactiveWhen, bg: '#FFFDF8', fg: '#0A5157', border: '#E7DED2' },
    { when: activeWhen,   bg: '#168878', fg: '#FFFFFF', border: '#168878' },
  ]) {
    prayerItems.push(F(p.x, 414, p.w, 110, state.bg, 18, {
      when: state.when,
      borderWidth: '1dp',
      borderColor: state.border,
    }));
    prayerItems.push(T(p.en, p.x + 27, 430, 100, 18, state.fg, 700, { when: state.when }));
    prayerItems.push(T(p.ar, p.x + 27, 459, 100, 15, state.fg, 700, { when: state.when }));
    prayerItems.push(T(`\${hassounData.prayers.${key}.displayTime}`, p.x + 27, 487, 120, 20, state.fg, 700, { when: state.when }));
    prayerItems.push(T(p.icon, p.x + p.w - 48, 429, 28, 23, p.iconColor, 700, {
      when: state.when,
      textAlign: 'center',
    }));
  }
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
          {
            type: 'Image',
            position: 'absolute',
            left: '0dp',
            top: '0dp',
            width: '960dp',
            height: '600dp',
            source: BACKGROUND_URL,
            scale: 'best-fill',
            align: 'center',
          },

          // Header live values. Branding, mosque artwork and location label remain in the approved image.
          T('${hassounData.dateLabel}', 645, 45, 190, 13, '#7B8785', 500),
          T('${hassounData.hijriDate}', 645, 66, 190, 13, '#0B8E7E', 600),
          T('${hassounData.weatherTemp}', 872, 48, 62, 15, '#566361', 700, {
            textAlign: 'center', when: "${hassounData.weatherTemp != ''}",
          }),
          T('${hassounData.weatherLabel}', 872, 68, 62, 11, '#7B8785', 500, {
            textAlign: 'center', when: "${hassounData.weatherLabel != ''}",
          }),

          // Main next-prayer values over the exact approved green card artwork.
          T('${hassounData.nextPrayer.name}', 82, 154, 300, 48, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.arabicName}', 82, 228, 300, 31, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.displayTime}', 82, 285, 250, 29, '#FFFFFF', 700),
          T('${hassounData.nextPrayer.timeUntil}', 122, 337, 225, 17, '#FFFFFF', 700),

          // Today card live values.
          T('${hassounData.dateLabel}', 607, 151, 245, 18, '#0B5157', 700),
          T('${hassounData.hijriDate}', 607, 183, 220, 14, '#0B8E7E', 500),

          // Next Islamic event live values.
          T('${hassounData.eventName}', 607, 283, 220, 19, '#0B5157', 700),
          T('${hassounData.eventWhen}', 607, 312, 190, 14, '#717B78', 500),

          // Five prayer tiles are redrawn over the approved image so active state and times stay live.
          ...prayerItems,
        ],
      },
    }],
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
console.log('Applied approved Hassoun sunrise artwork as Alexa background with live overlays.');
