import crypto from 'node:crypto';
import fs from 'node:fs';

const apiKey = process.env.RESEND_API_KEY;
const secret = process.env.EMAIL_LINK_SECRET || process.env.VAPID_PRIVATE_KEY;
if (!apiKey) throw new Error('Missing RESEND_API_KEY');
if (!secret) throw new Error('Missing EMAIL_LINK_SECRET/VAPID_PRIVATE_KEY');

const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
async function get(path) {
  const response = await fetch(`https://api.resend.com${path}`, { headers });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const people = new Map();
function add(email, blocked = false, source = 'history') {
  if (typeof email !== 'string') return;
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const previous = people.get(email);
  people.set(email, { email, blocked: Boolean(blocked || previous?.blocked), source });
}

try {
  let after = '';
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ limit: '100' });
    if (after) qs.set('after', after);
    const payload = await get(`/emails?${qs}`);
    const rows = payload.data || [];
    if (!rows.length) break;
    for (const row of rows) {
      const subject = String(row.subject || '');
      if (!/(fajr|dhuhr|zuhr|asr|maghrib|isha|prayer time|athan|adhan|وقت الصلاة|الفجر|الظهر|العصر|المغرب|العشاء)/i.test(subject)) continue;
      for (const email of (Array.isArray(row.to) ? row.to : [row.to])) {
        add(email, row.last_event === 'suppressed', 'prayer-history');
      }
    }
    if (rows.length < 100 || !rows.at(-1)?.id) break;
    after = rows.at(-1).id;
  }
} catch (error) {
  console.warn('Resend history scan unavailable:', error.message);
}

try {
  let after = '';
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ limit: '100' });
    if (after) qs.set('after', after);
    const payload = await get(`/contacts?${qs}`);
    const rows = payload.data || [];
    if (!rows.length) break;
    for (const contact of rows) add(contact.email, contact.unsubscribed === true, 'contact');
    if (rows.length < 100 || !rows.at(-1)?.id) break;
    after = rows.at(-1).id;
  }
} catch (error) {
  console.warn('Resend contacts scan unavailable:', error.message);
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statements = [];
let active = 0;
let blocked = 0;
for (const person of people.values()) {
  const status = person.blocked ? 'unsubscribed' : 'active';
  status === 'active' ? active++ : blocked++;
  const publicId = crypto.randomUUID();
  const manageToken = crypto.createHmac('sha256', secret).update(`manage|${publicId}|${person.email}`).digest('base64url');
  const manageHash = crypto.createHash('sha256').update(manageToken).digest('hex');
  statements.push(`INSERT INTO email_subscribers (public_id,email,locale,latitude,longitude,timezone,country_code,country_name,region,city,calculation_method,madhab,status,manage_token_hash,verified_at,unsubscribed_at) SELECT ${quote(publicId)},${quote(person.email)},'en',42.3149,-83.0364,'America/Toronto','CA','Canada','Ontario','Windsor',3,'standard',${quote(status)},${quote(manageHash)},${status === 'active' ? 'CURRENT_TIMESTAMP' : 'NULL'},${status === 'active' ? 'NULL' : 'CURRENT_TIMESTAMP'} WHERE NOT EXISTS (SELECT 1 FROM email_subscribers WHERE email=${quote(person.email)} COLLATE NOCASE);`);
  statements.push(`INSERT OR IGNORE INTO subscriber_email_preferences (subscriber_id,prayer_alerts,daily_prayer_schedule,religious_occasions,daily_content,announcements,community_events,marketing) SELECT id,${status === 'active' ? 1 : 0},0,1,0,1,1,0 FROM email_subscribers WHERE email=${quote(person.email)} COLLATE NOCASE;`);
  for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    statements.push(`INSERT OR IGNORE INTO subscriber_prayer_preferences (subscriber_id,prayer,email_twenty,email_ten,email_athan) SELECT id,${quote(prayer)},0,0,${status === 'active' ? 1 : 0} FROM email_subscribers WHERE email=${quote(person.email)} COLLATE NOCASE;`);
  }
}

fs.writeFileSync('/tmp/hassoun-legacy-users.sql', statements.join('\n'));
fs.writeFileSync('/tmp/hassoun-legacy-discovery.json', JSON.stringify({ discovered: people.size, active, blocked }, null, 2));
console.log(`Discovered ${people.size} legacy recipient(s): ${active} active, ${blocked} blocked.`);
