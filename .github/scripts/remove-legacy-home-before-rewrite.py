from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

# Remove every legacy HomePrayerPanel import form.
app = re.sub(r'^.*HomePrayerPanel.*\n', '', app, flags=re.M)

# Remove the entire old homeScreen top-level declaration without depending on the
# name of the following screen. Top-level declarations use exactly two-space indent.
marker = '  const homeScreen ='
start = app.find(marker)
if start >= 0:
    next_decl = app.find('\n  const ', start + len(marker))
    if next_decl < 0:
        raise SystemExit('Could not find declaration after legacy homeScreen')
    app = app[:start] + app[next_decl + 1:]

# Also remove any stray legacy self-closing panel left by transformed source.
app = re.sub(r'\s*<HomePrayerPanel\b.*?/>\s*', '\n', app, flags=re.S)

APP.write_text(app, encoding='utf-8')
print('Removed legacy Home renderer and HomePrayerPanel before ground-zero rewrite')
