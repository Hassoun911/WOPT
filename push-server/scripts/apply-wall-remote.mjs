import fs from "node:fs";

const path = new URL("../src/index.ts", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const importAnchor = 'import { submitSupportContact } from "./support";\n';
const wallImport = `import {\n  getWallControllerState,\n  getWallDeviceSync,\n  pairWallController,\n  publishWallDeviceSettings,\n  refreshWallPairing,\n  registerWallDisplay,\n  revokeWallController,\n  sendWallControllerCommand,\n  updateWallControllerSettings,\n  updateWallDeviceStatus\n} from "./wallRemote";\n`;
if (!source.includes(wallImport)) {
  if (!source.includes(importAnchor)) throw new Error("Unable to locate wall remote import anchor");
  source = source.replace(importAnchor, importAnchor + wallImport);
}

const routeAnchor = '      } else if (request.method === "POST" && url.pathname === "/subscriptions/expo") {\n        response = await registerExpo(request, env);\n';
const routes = `      } else if (request.method === "POST" && url.pathname === "/wall/display/register") {\n        response = await registerWallDisplay(request, env);\n      } else if (request.method === "POST" && url.pathname === "/wall/display/pairing") {\n        response = await refreshWallPairing(request, env);\n      } else if (request.method === "GET" && url.pathname === "/wall/display/sync") {\n        response = await getWallDeviceSync(request, env);\n      } else if (request.method === "POST" && url.pathname === "/wall/display/status") {\n        response = await updateWallDeviceStatus(request, env);\n      } else if (request.method === "POST" && url.pathname === "/wall/display/settings") {\n        response = await publishWallDeviceSettings(request, env);\n      } else if (request.method === "POST" && url.pathname === "/wall/controller/pair") {\n        response = await pairWallController(request, env);\n      } else if (request.method === "GET" && url.pathname === "/wall/controller/state") {\n        response = await getWallControllerState(request, env);\n      } else if (request.method === "POST" && url.pathname === "/wall/controller/settings") {\n        response = await updateWallControllerSettings(request, env);\n      } else if (request.method === "POST" && url.pathname === "/wall/controller/command") {\n        response = await sendWallControllerCommand(request, env);\n      } else if (request.method === "DELETE" && url.pathname === "/wall/controller") {\n        response = await revokeWallController(request, env);\n`;
if (!source.includes('/wall/display/register')) {
  if (!source.includes(routeAnchor)) throw new Error("Unable to locate wall remote route anchor");
  source = source.replace(routeAnchor, routes + routeAnchor);
}

fs.writeFileSync(path, source);
console.log("Applied Hassoun smart wall remote routes");
