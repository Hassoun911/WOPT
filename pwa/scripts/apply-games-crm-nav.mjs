import fs from 'node:fs';
const path='app/admin/layout.tsx';
let s=fs.readFileSync(path,'utf8');
if(!s.includes('["/admin/games/", "🎮", "Games"]')){
  s=s.replace('["/admin/control/", "🎛️", "App Control"],','["/admin/control/", "🎛️", "App Control"],\n      ["/admin/games/", "🎮", "Games"],');
}
fs.writeFileSync(path,s);
console.log('Added Games to CRM navigation');
