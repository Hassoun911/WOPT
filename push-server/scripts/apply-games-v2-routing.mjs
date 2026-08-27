import fs from 'node:fs';
const path='src/index.ts';
let s=fs.readFileSync(path,'utf8');
if(!s.includes('from "./adminGames"')){
  s=s.replace('import { handleAdminSchool } from "./adminSchool";','import { handleAdminSchool } from "./adminSchool";\nimport { closeAdminGameRoom, getAdminGames, updateAdminGameSetting } from "./adminGames";');
}
s=s.replace('import { handleGames } from "./games";','import { expireDueGameRooms, handleGames } from "./games";');
if(!s.includes('await expireDueGameRooms(env);')){
  s=s.replace('await dispatchDueAdminPushCampaigns(env);','await dispatchDueAdminPushCampaigns(env);await expireDueGameRooms(env);');
}
if(!s.includes('url.pathname==="/admin/games"')){
  s=s.replace('else if(request.method==="GET"&&url.pathname==="/admin/dashboard")response=await getAdminDashboard(request,env);',
    'else if(request.method==="GET"&&url.pathname==="/admin/dashboard")response=await getAdminDashboard(request,env);else if(request.method==="GET"&&url.pathname==="/admin/games")response=await getAdminGames(request,env);else if(request.method==="POST"&&url.pathname.startsWith("/admin/games/settings/"))response=await updateAdminGameSetting(request,env,decodeURIComponent(url.pathname.slice("/admin/games/settings/".length)));else if(request.method==="POST"&&/^\\/admin\\/games\\/rooms\\/[A-Z2-9]{6}\\/close$/.test(url.pathname))response=await closeAdminGameRoom(request,env,url.pathname.split("/")[4]??"");');
}
fs.writeFileSync(path,s);
console.log('Applied games v2 Worker + CRM routing');
