import { readFileSync, writeFileSync } from 'node:fs';

for (const file of ['src/adminEmail.ts','src/emailDelivery.ts','migrations/0008_email_template_profiles.sql']) {
  const url = new URL(`../${file}`, import.meta.url);
  const before = readFileSync(url, 'utf8');
  let after = before.replaceAll('sponsor_logo_data', 'sponsor_logo_base64');

  // The Email Center stores the sponsor identity/details on the Announcement profile,
  // while each email type keeps its own include_sponsor on/off switch. Inherit the
  // configured sponsor details globally so prayer, verification, manage, reset,
  // campaign, and other enabled email types all render the same sponsor block.
  if (file === 'src/emailDelivery.ts') {
    const oldLoadProfile = `async function loadProfile(env: Env, row: OutboxRow) {
  return env.DB.prepare(
    \`SELECT template_key, enabled, include_islamic_occasion, include_daily_hadith,
            include_daily_surah, include_occasion_countdown, include_motivation,
            include_sadaqah_jariyah, include_sponsor, sponsor_name, sponsor_url,
            sponsor_message_en, sponsor_message_ar, sponsor_logo_base64, sponsor_logo_mime
     FROM email_template_profiles WHERE template_key = ? LIMIT 1\`
  ).bind(profileKey(row)).first<ProfileRow>();
}`;

    const newLoadProfile = `async function loadProfile(env: Env, row: OutboxRow) {
  const profile = await env.DB.prepare(
    \`SELECT template_key, enabled, include_islamic_occasion, include_daily_hadith,
            include_daily_surah, include_occasion_countdown, include_motivation,
            include_sadaqah_jariyah, include_sponsor, sponsor_name, sponsor_url,
            sponsor_message_en, sponsor_message_ar, sponsor_logo_base64, sponsor_logo_mime
     FROM email_template_profiles WHERE template_key = ? LIMIT 1\`
  ).bind(profileKey(row)).first<ProfileRow>();
  if (!profile) return null;

  const globalSponsor = await env.DB.prepare(
    \`SELECT sponsor_name, sponsor_url, sponsor_message_en, sponsor_message_ar,
            sponsor_logo_base64, sponsor_logo_mime
     FROM email_template_profiles WHERE template_key = 'announcement' LIMIT 1\`
  ).first<Pick<ProfileRow, 'sponsor_name' | 'sponsor_url' | 'sponsor_message_en' | 'sponsor_message_ar' | 'sponsor_logo_base64' | 'sponsor_logo_mime'>>();

  if (!globalSponsor) return profile;
  return {
    ...profile,
    sponsor_name: globalSponsor.sponsor_name ?? profile.sponsor_name,
    sponsor_url: globalSponsor.sponsor_url ?? profile.sponsor_url,
    sponsor_message_en: globalSponsor.sponsor_message_en ?? profile.sponsor_message_en,
    sponsor_message_ar: globalSponsor.sponsor_message_ar ?? profile.sponsor_message_ar,
    sponsor_logo_base64: globalSponsor.sponsor_logo_base64 ?? profile.sponsor_logo_base64,
    sponsor_logo_mime: globalSponsor.sponsor_logo_mime ?? profile.sponsor_logo_mime,
  };
}`;

    if (after.includes(oldLoadProfile)) after = after.replace(oldLoadProfile, newLoadProfile);
    else if (!after.includes("template_key = 'announcement' LIMIT 1")) {
      throw new Error('Unable to patch global sponsor inheritance in emailDelivery.ts');
    }
  }

  if (before !== after) writeFileSync(url, after);
}

console.log('Email sponsor schema aligned and global sponsor details applied to all enabled sponsor sections.');
