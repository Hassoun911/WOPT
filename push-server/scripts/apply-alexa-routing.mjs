import fs from 'node:fs';

const path = 'src/index.ts';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('import { getAlexaContext } from "./alexaData";')) {
  source = 'import { getAlexaContext } from "./alexaData";\n' + source;
}

if (!source.includes('url.pathname==="/voice/alexa/context"')) {
  const health = 'if(request.method==="GET"&&url.pathname==="/health")response=json({ok:true,service:"wopt-prayer-push"});';
  if (!source.includes(health)) throw new Error('Worker health-route anchor not found');
  source = source.replace(
    health,
    'if(request.method==="GET"&&url.pathname==="/voice/alexa/context")response=await getAlexaContext(request,env);else ' + health
  );
}

for (const required of [
  'import { getAlexaContext } from "./alexaData";',
  'url.pathname==="/voice/alexa/context"',
  'getAlexaContext(request,env)'
]) {
  if (!source.includes(required)) throw new Error(`Alexa Worker routing missing: ${required}`);
}

fs.writeFileSync(path, source);
console.log('Applied final Hassoun Alexa Worker routing');
