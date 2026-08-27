import { readFileSync, writeFileSync } from 'node:fs';

for (const file of ['src/adminEmail.ts','src/emailDelivery.ts','migrations/0008_email_template_profiles.sql']) {
  const before = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const after = before.replaceAll('sponsor_logo_data', 'sponsor_logo_base64');
  if (before !== after) writeFileSync(new URL(`../${file}`, import.meta.url), after);
}

console.log('Email sponsor-logo schema aligned to production column sponsor_logo_base64.');
