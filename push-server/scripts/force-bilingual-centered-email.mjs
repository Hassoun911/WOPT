// Final deployment pass for Hassoun emails.
// The schema patch builds the bilingual mixed email structure. This step only
// applies deterministic Arabic fallbacks and centering without rewriting blocks.
import './finalize-email-bilingual-center.mjs';

console.log('Applied safe bilingual centered email finalizer.');
