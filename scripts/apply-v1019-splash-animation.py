from pathlib import Path

path = Path('mobile/App.tsx')
text = path.read_text(encoding='utf-8')

import_anchor = 'import Quran from "./src/quran/Quran";\n'
if 'import HassounSplashAnimation from "./src/HassounSplashAnimation";' not in text:
    if import_anchor not in text:
        raise SystemExit('Could not find Quran import anchor')
    text = text.replace(import_anchor, import_anchor + 'import HassounSplashAnimation from "./src/HassounSplashAnimation";\n', 1)

state_anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n'
if 'startupSplashVisible' not in text:
    if state_anchor not in text:
        raise SystemExit('Could not find App state anchor')
    text = text.replace(state_anchor, state_anchor + '  const [startupSplashVisible, setStartupSplashVisible] = useState(true);\n', 1)

return_anchor = '  if (busy && !today) {\n'
if 'return <HassounSplashAnimation' not in text:
    if return_anchor not in text:
        raise SystemExit('Could not find loading return anchor')
    text = text.replace(return_anchor, '  if (startupSplashVisible) {\n    return <HassounSplashAnimation onFinished={() => setStartupSplashVisible(false)} />;\n  }\n\n' + return_anchor, 1)

required = [
    'import HassounSplashAnimation from "./src/HassounSplashAnimation";',
    'const [startupSplashVisible, setStartupSplashVisible] = useState(true);',
    'return <HassounSplashAnimation onFinished={() => setStartupSplashVisible(false)} />;'
]
for marker in required:
    if marker not in text:
        raise SystemExit('Missing splash integration marker: ' + marker)

path.write_text(text, encoding='utf-8')
print('Applied Hassoun 2.4-second Quran Light Opening startup animation.')
