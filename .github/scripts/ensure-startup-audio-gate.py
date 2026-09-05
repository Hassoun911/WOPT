from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

marker = 'const [savedLocale, savedAlerts'
pos = app.find(marker)
if pos < 0:
    raise SystemExit('main initialization marker missing')
start = app.rfind('  useEffect(() => {', 0, pos)
if start < 0:
    raise SystemExit('main initialization effect start missing')
end = app.find('\n  },', pos)
if end < 0:
    raise SystemExit('main initialization effect end missing')
end_line = app.find('\n', end + 1)
if end_line < 0:
    end_line = len(app)
block = app[start:end_line]

if 'if (!startupAudioCleared) return;' not in block:
    block = block.replace('  useEffect(() => {', '  useEffect(() => {\n    if (!startupAudioCleared) return;', 1)

# Ensure the effect reruns exactly once when startup cleanup completes.
close = block.rfind(']);')
if close >= 0:
    dep_start = block.rfind('[', 0, close)
    if dep_start >= 0:
        deps = block[dep_start + 1:close].strip()
        if 'startupAudioCleared' not in deps:
            deps = ', '.join([d for d in (deps, 'startupAudioCleared') if d])
            block = block[:dep_start + 1] + deps + block[close:]
elif '}, []);' in block:
    block = block.replace('}, []);', '}, [startupAudioCleared]);', 1)

app = app[:start] + block + app[end_line:]
if 'if (!startupAudioCleared) return;' not in app:
    raise SystemExit('startup audio gate could not be installed')
APP.write_text(app, encoding='utf-8')
print('Restored startup audio cleanup gate after ground-zero Home rewrite')
