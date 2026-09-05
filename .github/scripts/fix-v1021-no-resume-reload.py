from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
CONFIG = ROOT / "mobile/app.config.ts"

app = APP.read_text(encoding="utf-8")

new = '''  useEffect(() => {\n    const subscription = AppState.addEventListener("change", (state) => {\n      if (state !== "active") return;\n      // Resume in-place. Do not force GPS/network refresh here because it makes\n      // Android appear to reload the app and can interrupt the user's current screen.\n      setNow(new Date());\n      void loadQuizStats().then(setQuizStats).catch(() => undefined);\n    });\n    return () => subscription.remove();\n  }, []);'''

pattern = re.compile(
    r'  useEffect\(\(\) => \{\n\s*const subscription = AppState\.addEventListener\("change", \(state\) => \{.*?\n\s*return \(\) => subscription\.remove\(\);\n\s*\}, \[[^\]]*\]\);',
    re.S,
)
app, count = pattern.subn(new, app, count=1)
if count != 1:
    raise SystemExit("Could not find AppState resume effect in reconstructed v1.0.20 app")
APP.write_text(app, encoding="utf-8")

cfg = CONFIG.read_text(encoding="utf-8")
cfg, n1 = re.subn(
    r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"',
    'version: process.env.EXPO_APP_VERSION || "1.0.21"',
    cfg,
    count=1,
)
cfg, n2 = re.subn(r'versionCode:\s*\d+', 'versionCode: 65', cfg, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit("Could not set v1.0.21/versionCode 65")
CONFIG.write_text(cfg, encoding="utf-8")

print("Applied v1.0.21 resume-in-place fix and versionCode 65")
