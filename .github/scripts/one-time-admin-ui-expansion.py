from pathlib import Path

root = Path('.')
path = root / 'pwa/app/admin/AdminControlCenter.tsx'
text = path.read_text()

import_anchor = 'import { useCallback, useEffect, useMemo, useState } from "react";\n'
imports = import_anchor + 'import AdminUsersPanel from "./AdminUsersPanel";\nimport AdminGamesPanel from "./AdminGamesPanel";\n'
if text.count(import_anchor) != 1:
    raise SystemExit('React import anchor changed')
text = text.replace(import_anchor, imports, 1)

old_view = 'type ViewName = "overview" | "control" | "content" | "prayer" | "subscribers" | "support" | "push" | "email" | "release" | "audit";'
new_view = 'type ViewName = "overview" | "control" | "content" | "prayer" | "subscribers" | "users" | "games" | "support" | "push" | "email" | "release" | "audit";'
if text.count(old_view) != 1:
    raise SystemExit('ViewName anchor changed')
text = text.replace(old_view, new_view, 1)

old_nav = '''    ["overview", "Overview", "⌂"], ["control", "App Control", "⚙"], ["content", "Content", "✎"], ["prayer", "Prayer Times", "◷"],\n    ["subscribers", "Subscribers", "◎"], ["support", "Support", "✉"], ["push", "Push", "↗"], ["email", "Email", "@"], ["release", "Store Release", "✓"], ["audit", "Audit", "≡"]'''
new_nav = '''    ["overview", "Overview", "⌂"], ["control", "App Control", "⚙"], ["content", "Content", "✎"], ["prayer", "Prayer Times", "◷"],\n    ["subscribers", "Subscribers", "◎"], ["users", "Administrators", "♙"], ["games", "Game Rooms", "◉"], ["support", "Support", "✉"],\n    ["push", "Push", "↗"], ["email", "Email", "@"], ["release", "Store Release", "✓"], ["audit", "Audit", "≡"]'''
if text.count(old_nav) != 1:
    raise SystemExit('Navigation anchor changed')
text = text.replace(old_nav, new_nav, 1)

support_anchor = '      {view === "support" ? <Card title="Support CRM"'
if text.count(support_anchor) != 1:
    raise SystemExit('Support render anchor changed')
insert = '''      {view === "users" ? <AdminUsersPanel token={token} /> : null}\n\n      {view === "games" ? <AdminGamesPanel token={token} /> : null}\n\n'''
text = text.replace(support_anchor, insert + support_anchor, 1)
path.write_text(text)

(root / '.github/workflows/one-time-admin-ui-expansion.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
