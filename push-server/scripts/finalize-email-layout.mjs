import { readFileSync, writeFileSync } from 'node:fs';

const url = new URL('../src/emailDelivery.ts', import.meta.url);
let source = readFileSync(url, 'utf8');

// The prayer email must stay as the original single dashboard card. The prayer
// template itself is bilingual, so never render a second Arabic copy of the card.
source = source.replace(
  '  const activeProfile = profile && profile.enabled === 1 ? profile : null;\n\n  const english = await renderLocalizedCore(env, row, "en", rawData, profile);',
  '  const activeProfile = profile && profile.enabled === 1 ? profile : null;\n\n  if (row.kind === "prayer") {\n    const prayer = prayerDashboardEmail({ ...rawData, upcomingEvent: null }, "en");\n    const extra = activeProfile ? enhancementHtml(activeProfile, content, rawData, "en") : "";\n    return appendEnhancements(prayer, extra, activeProfile, content, "en", rawData);\n  }\n\n  const english = await renderLocalizedCore(env, row, "en", rawData, profile);'
);

// Keep the additional cards visually aligned with the original prayer dashboard.
// English and Arabic remain together inside each card, but all visible content is centered.
source = source.replaceAll('text-align:left', 'text-align:center').replaceAll('text-align:right', 'text-align:center');

writeFileSync(url, source);
console.log('Final email layout applied: single original prayer dashboard, bilingual mixed content, centered sections.');
