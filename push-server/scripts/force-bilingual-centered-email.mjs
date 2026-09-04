// Final deployment pass for Hassoun emails.
// First create the mixed bilingual centered enhancement blocks, then replace
// the fragile split-language renderer with one stable production render path.
import fs from 'node:fs';
import './finalize-email-bilingual-center.mjs';
import './stabilize-email-render.mjs';

// Keep email preference/manage links on the final destination. The older
// root-page redirect could lose the secure query string in some mobile and
// in-app browser flows, leaving /email/manage/ without id/token and showing
// "This manage link is incomplete." Patch the production Worker source before
// typecheck/deploy so every newly generated link goes directly to the page.
const subscribersPath = new URL('../src/subscribers.ts', import.meta.url);
let subscribersSource = fs.readFileSync(subscribersPath, 'utf8');
const oldManageLink = 'return `${publicAppUrl(env)}/?emailManage=${encodeURIComponent(publicId)}&token=${encodeURIComponent(token)}`;';
const directManageLink = 'return `${publicAppUrl(env)}/email/manage/?id=${encodeURIComponent(publicId)}&token=${encodeURIComponent(token)}`;';
if (subscribersSource.includes(oldManageLink)) {
  subscribersSource = subscribersSource.replace(oldManageLink, directManageLink);
  fs.writeFileSync(subscribersPath, subscribersSource);
  console.log('Patched subscriber manage links to direct secure URLs.');
} else if (!subscribersSource.includes(directManageLink)) {
  throw new Error('Could not verify subscriber manage-link renderer.');
}

console.log('Applied stable production bilingual centered email renderer.');
