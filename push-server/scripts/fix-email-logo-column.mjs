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

    // Sponsor content is intentionally bilingual in every email. The subscriber's
    // locale still controls the rest of the email, but the sponsor/support block
    // always shows both the configured English and Arabic messages together.
    const oldSponsorMessage = `    const sponsorMessage = ar ? (profile.sponsor_message_ar || "يمكنك دعم هذه الصدقة الجارية والمساهمة في استمرارها.") : (profile.sponsor_message_en || "Support this Sadaqah Jariyah and help keep Hassoun available and growing.");`;
    const newSponsorMessage = `    const sponsorMessageEn = profile.sponsor_message_en || "Support this Sadaqah Jariyah and help keep Hassoun available and growing.";\n    const sponsorMessageAr = profile.sponsor_message_ar || "يمكنك دعم هذه الصدقة الجارية والمساهمة في استمرارها.";`;
    if (after.includes(oldSponsorMessage)) after = after.replace(oldSponsorMessage, newSponsorMessage);

    const oldSponsorBlock = `    blocks.push(\`<tr><td style="padding:0 22px 18px"><table role="presentation" width="100%" style="background:#f8f3e9;border:1px solid #e5dac6;border-radius:16px"><tr><td dir="\${ar ? "rtl" : "ltr"}" style="padding:14px;text-align:\${ar ? "right" : "left"}">\${logo}<div style="font-size:10px;letter-spacing:1.2px;color:#9a772c;font-weight:900">\${escapeHtml(sponsorName)}</div><div style="font-size:13px;line-height:1.55;color:#53655f;margin-top:5px">\${escapeHtml(sponsorMessage)}</div>\${link}</td></tr></table></td></tr>\`);`;
    const newSponsorBlock = `    blocks.push(\`<tr><td style="padding:0 22px 18px"><table role="presentation" width="100%" style="background:#f8f3e9;border:1px solid #e5dac6;border-radius:16px"><tr><td style="padding:14px">\${logo}<div dir="ltr" style="text-align:left;font-size:10px;letter-spacing:1.2px;color:#9a772c;font-weight:900">\${escapeHtml(sponsorName)}</div><div dir="ltr" style="text-align:left;font-size:13px;line-height:1.55;color:#53655f;margin-top:5px">\${escapeHtml(sponsorMessageEn)}</div><div style="height:1px;background:#e5dac6;margin:12px 0"></div><div dir="rtl" style="text-align:right;font-size:13px;line-height:1.8;color:#53655f">\${escapeHtml(sponsorMessageAr)}</div>\${link}</td></tr></table></td></tr>\`);`;
    if (after.includes(oldSponsorBlock)) after = after.replace(oldSponsorBlock, newSponsorBlock);
    else if (!after.includes('sponsorMessageEn') || !after.includes('sponsorMessageAr')) {
      throw new Error('Unable to patch bilingual sponsor HTML in emailDelivery.ts');
    }

    const oldSponsorText = `    if (profile.include_sponsor === 1) textParts.push(profile.sponsor_message_en || "Support this Sadaqah Jariyah and help keep Hassoun available and growing.");`;
    const newSponsorText = `    if (profile.include_sponsor === 1) textParts.push(\`\${profile.sponsor_message_en || "Support this Sadaqah Jariyah and help keep Hassoun available and growing."}\\n\${profile.sponsor_message_ar || "يمكنك دعم هذه الصدقة الجارية والمساهمة في استمرارها."}\`);`;
    if (after.includes(oldSponsorText)) after = after.replace(oldSponsorText, newSponsorText);
  }

  if (before !== after) writeFileSync(url, after);
}

console.log('Email sponsor schema aligned, global sponsor details applied, and sponsor content rendered bilingually.');
