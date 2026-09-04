// Final deployment pass for Hassoun emails.
// The schema patch builds the bilingual email structure; this script only applies
// deterministic Arabic fallbacks and centering without fragile regex block rewrites.
import './finalize-email-bilingual-center.mjs';

console.log('Applied safe bilingual centered email finalizer.');
