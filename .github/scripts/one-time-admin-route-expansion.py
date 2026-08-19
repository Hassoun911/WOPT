from pathlib import Path

root = Path('.')
path = root / 'push-server/src/index.ts'
text = path.read_text()

anchor = '} from "./adminControl";\n'
imports = '''} from "./adminControl";\nimport {\n  createAdminUser,\n  listAdminUsers,\n  resetAdminUserPassword,\n  revokeAdminUserSessions,\n  updateAdminUser\n} from "./adminUsers";\nimport {\n  closeAdminGameRoom,\n  deleteAdminGameRoom,\n  inspectAdminGameRoom,\n  listAdminGameRooms\n} from "./adminGames";\n'''
if text.count(anchor) != 1:
    raise SystemExit('adminControl import anchor changed')
text = text.replace(anchor, imports, 1)

route_anchor = '''      } else if (request.method === "GET" && url.pathname === "/admin/subscribers") {\n        response = await listAdminSubscribers(request, env, url);\n'''
route_replacement = '''      } else if (request.method === "GET" && url.pathname === "/admin/subscribers") {\n        response = await listAdminSubscribers(request, env, url);\n      } else if (request.method === "GET" && url.pathname === "/admin/users") {\n        response = await listAdminUsers(request, env);\n      } else if (request.method === "POST" && url.pathname === "/admin/users") {\n        response = await createAdminUser(request, env);\n      } else if (request.method === "PATCH" && url.pathname === "/admin/users") {\n        response = await updateAdminUser(request, env);\n      } else if (request.method === "POST" && url.pathname === "/admin/users/password") {\n        response = await resetAdminUserPassword(request, env);\n      } else if (request.method === "POST" && url.pathname === "/admin/users/revoke-sessions") {\n        response = await revokeAdminUserSessions(request, env);\n      } else if (request.method === "GET" && url.pathname === "/admin/games/rooms") {\n        response = await listAdminGameRooms(request, env, url);\n      } else if (request.method === "GET" && url.pathname === "/admin/games/room") {\n        response = await inspectAdminGameRoom(request, env, url);\n      } else if (request.method === "POST" && url.pathname === "/admin/games/rooms/close") {\n        response = await closeAdminGameRoom(request, env);\n      } else if (request.method === "DELETE" && url.pathname === "/admin/games/rooms") {\n        response = await deleteAdminGameRoom(request, env, url);\n'''
if text.count(route_anchor) != 1:
    raise SystemExit('admin subscriber route anchor changed')
text = text.replace(route_anchor, route_replacement, 1)
path.write_text(text)

(root / '.github/workflows/one-time-admin-route-expansion.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
