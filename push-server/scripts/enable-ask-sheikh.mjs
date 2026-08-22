import fs from 'node:fs';

const path = new URL('../src/index.ts', import.meta.url);
let src = fs.readFileSync(path, 'utf8');

const importLine = 'import { listAskSheikhQuestions, recordAskSheikhQuestion } from "./askSheikh";\n';
if (!src.includes(importLine.trim())) {
  const anchor = 'import { handleGames } from "./games";\n';
  if (!src.includes(anchor)) throw new Error('Could not find games import anchor in index.ts');
  src = src.replace(anchor, anchor + importLine);
}

if (!src.includes('url.pathname === "/ask-sheikh/questions"')) {
  const anchor = '      } else if (request.method === "POST" && url.pathname === "/support/contact") {\n';
  if (!src.includes(anchor)) throw new Error('Could not find route anchor in index.ts');
  const routes = `      } else if (request.method === "POST" && url.pathname === "/ask-sheikh/questions") {\n        response = await recordAskSheikhQuestion(request, env);\n      } else if (request.method === "GET" && url.pathname === "/ask-sheikh/questions") {\n        response = await listAskSheikhQuestions(url, env);\n`;
  src = src.replace(anchor, routes + anchor);
}

fs.writeFileSync(path, src);
console.log('Ask the Sheikh routes enabled.');
