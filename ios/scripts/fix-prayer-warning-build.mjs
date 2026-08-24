import fs from 'node:fs';

const path = 'src/HomePrayerPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

// Keep the 5-minute red warning, but pulse only opacity. Animated color/shadow
// interpolations can fail React Native TypeScript style checking.
s = s.replace(/const warningBorder = warningPulse\.interpolate\([\s\S]*?\);\n  const warningShadow = warningPulse\.interpolate\([\s\S]*?\);\n/, `const warningOpacity = warningPulse.interpolate({\n    inputRange: [0, 1],\n    outputRange: [1, 0.58]\n  });\n`);

s = s.replace('useNativeDriver: false', 'useNativeDriver: true');
s = s.replace('useNativeDriver: false', 'useNativeDriver: true');

s = s.replace(/urgent && \{ borderColor: warningBorder, shadowOpacity: warningShadow \}/g, 'urgent && { opacity: warningOpacity }');
s = s.replace(/\[rowStyle, \{ borderColor: warningBorder, shadowOpacity: warningShadow \}\]/g, '[rowStyle, { opacity: warningOpacity }]');

if (!s.includes('LESS THAN 5 MINUTES')) throw new Error('five-minute warning text missing');
if (!s.includes('countNumberUrgent')) throw new Error('red countdown style missing');
if (!s.includes('warningOpacity')) throw new Error('safe warning opacity patch did not apply');
if (s.includes('warningBorder') || s.includes('warningShadow')) throw new Error('unsafe animated warning style remains');

fs.writeFileSync(path, s);
console.log('Prayer warning now uses type-safe opacity pulse with static red border and timer text');
