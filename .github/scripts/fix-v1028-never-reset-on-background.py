from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

# The normal background -> foreground path must be side-effect free. It may update
# the clock, but it must never refresh GPS/prayer data, reset navigation, rebuild
# startup state, or remount the current page.
marker = "HASSOUN_BACKGROUND_RESUME_NO_RESET_V4"
if marker not in app:
    # Replace the lightweight resume effect created earlier with the strongest form.
    pattern = re.compile(
        r'  useEffect\(\(\) => \{\n\s*const subscription = AppState\.addEventListener\("change", \(state\) => \{\n\s*if \(state !== "active"\) return;\n\s*// Resume in-place\..*?\n\s*\}\);\n\s*return \(\) => subscription\.remove\(\);\n\s*\}, \[\]\);',
        re.S,
    )
    replacement = '''  // HASSOUN_BACKGROUND_RESUME_NO_RESET_V4
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      // NORMAL RESUME: preserve the mounted React tree exactly as-is.
      // Do not reload GPS/prayers, do not run startup, and do not change tabs/pages.
      setNow(new Date());
    });
    return () => subscription.remove();
  }, []);'''
    app, count = pattern.subn(replacement, app, count=1)
    if count != 1:
        # Ground-zero builds can have a listener without the old comment. Find the
        # listener whose active branch updates now/quiz and replace that whole effect.
        pattern2 = re.compile(
            r'  useEffect\(\(\) => \{\n\s*const subscription = AppState\.addEventListener\("change", \(state\) => \{\n\s*if \(state !== "active"\) return;\n\s*setNow\(new Date\(\)\);.*?\n\s*\}\);\n\s*return \(\) => subscription\.remove\(\);\n\s*\}, \[[^\]]*\]\);',
            re.S,
        )
        app, count = pattern2.subn(replacement, app, count=1)
    if count != 1:
        raise SystemExit("Could not isolate the normal AppState resume effect")

# Navigation must be persisted continuously, not only when Android has already
# backgrounded the process. This means Activity recreation restores the last screen
# even if the OS suspends quickly before an async background callback completes.
if "HASSOUN_CONTINUOUS_SCREEN_CHECKPOINT_V4" not in app:
    anchor = '  useEffect(() => {\n    if (!resumeStateReady) return;\n    activeTabRef.current = activeTab;'
    pos = app.find(anchor)
    if pos < 0:
        raise SystemExit("Exact-screen persistence effect missing")
    app = app[:pos] + '  // HASSOUN_CONTINUOUS_SCREEN_CHECKPOINT_V4\n' + app[pos:]

# Prohibit lifecycle-driven navigation resets in the final generated runtime.
for bad in [
    'if (state === "active") setActiveTab("home")',
    'if (state !== "active") setActiveTab("home")',
    'AppState.currentState === "active" && setActiveTab("home")',
]:
    if bad in app:
        raise SystemExit(f"Background navigation reset remains: {bad}")

APP.write_text(app, encoding="utf-8")

# Static invariants: no prayer/location refresh may occur inside any active-resume
# listener in the generated App. Permission pages can re-check permissions separately.
text = APP.read_text(encoding="utf-8")
for needle in [marker, "HASSOUN_CONTINUOUS_SCREEN_CHECKPOINT_V4", "hassoun:resume-exact-screen:v1", "activeTabRef.current = activeTab"]:
    if needle not in text:
        raise SystemExit(f"Missing background-resume invariant: {needle}")

for match in re.finditer(r'AppState\.addEventListener\("change", \(state\) => \{(.*?)\n\s*\}\);', text, re.S):
    body = match.group(1)
    if 'state !== "active"' in body or 'state === "active"' in body:
        forbidden = ["refreshPrayerLocation(", "loadPrayerTimes(", "loadInitialPrayerTimes(", "loadLocationPrayerContext(", 'setActiveTab("home")']
        for token in forbidden:
            if token in body:
                raise SystemExit(f"Resume listener still performs forbidden action: {token}")

print("Hardened normal background resume: mounted screen remains in-place; no GPS/prayer/startup/navigation reset on foreground")
