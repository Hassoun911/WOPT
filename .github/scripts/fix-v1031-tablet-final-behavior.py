from pathlib import Path
import re

PAGE = Path("mobile/src/MasjidDisplayPage.tsx")
EDITOR = Path("mobile/src/ConnectDisplayPage.tsx")
CFG = Path("mobile/app.config.ts")
page = PAGE.read_text(encoding="utf-8")
editor = EDITOR.read_text(encoding="utf-8")

# -----------------------------------------------------------------------------
# Native tablet: smart proportional layout. Every section gets a weight; increasing
# one section automatically gives it more room while the others yield. This means
# clock/card sizing actually changes the physical layout instead of only enlarging
# text inside a fixed box.
# -----------------------------------------------------------------------------
old_layout = re.compile(
    r'  const requestedClockBand = .*?\n'
    r'  const requestedMiniBand = .*?\n'
    r'  const clockBandHeight = .*?\n'
    r'  const miniBandHeight = .*?\n'
    r'  const fixedReserve = .*?\n'
    r'  const heroAvailableHeight = .*?\n',
    re.S,
)
new_layout = '''  const requestedClockBand = Math.max(.05, Number(remoteTheme.clockBandScale) || clockScale || 1);\n  const requestedMiniBand = Math.max(.05, Number(remoteTheme.lowerCardScale) || 1, ...PRAYER_KEYS.map(p => Number(remoteTheme[`mini_${p}_height`]) || 1));\n  const requestedHeroBand = Math.max(.05, (Number(remoteTheme.mainCardScale) || 1) * (Number(remoteTheme.mainCardHeightScale) || 1));\n  const contentHeight = Math.max(320, height - Math.round(height * .045));\n  const clockWeight = .12 * requestedClockBand;\n  const heroWeight = .76 * requestedHeroBand;\n  const miniWeight = .12 * requestedMiniBand;\n  const totalWeight = Math.max(.01, clockWeight + heroWeight + miniWeight);\n  const clockBandHeight = Math.max(42, Math.round(contentHeight * clockWeight / totalWeight));\n  const miniBandHeight = Math.max(42, Math.round(contentHeight * miniWeight / totalWeight));\n  const heroAvailableHeight = Math.max(120, contentHeight - clockBandHeight - miniBandHeight);\n'''
page, n = old_layout.subn(new_layout, page, count=1)
if n != 1:
    raise SystemExit("v1031: smart proportional layout block not found")

# Individual bottom card heights are real, not forced to 100% of the shared row.
page = page.replace(
    'height: "100%"',
    'height: Math.max(34, Math.round(miniBandHeight * (miniHeight / requestedMiniBand)))',
    1,
)

# The gallery height is the smartly allocated hero band. mainCardScale and the newer
# width/height controls all feed the weights above, so changing any card size is visible.
page = re.sub(
    r'fitFullScreen \? \{ flex:1, maxHeight:heroAvailableHeight \} : \{ flex:0, height:Math\.min\(heroAvailableHeight,Math\.max\(140,Math\.round\(mainCardHeight\*mainCardHeightScale\)\)\) \}',
    '{ flex:0, height:heroAvailableHeight }',
    page,
    count=1,
)
page = page.replace('minHeight:140', 'minHeight:100', 1)

# -----------------------------------------------------------------------------
# Text safety. Requested font sizes are honored as the desired size, but RN is allowed
# to auto-fit the line when physical screen space is exhausted. Explicit line heights
# and font padding prevent Arabic/English glyphs from being chopped vertically.
# -----------------------------------------------------------------------------
page = re.sub(
    r'<Text numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.01\} allowFontScaling=\{false\} style=\{\[styles\.arabic, \{.*?fontSize:\(landscape\?58:78\)\*arabicScale, color:arabicColor, fontFamily:arabicFont, flexShrink:1 \}\]\}>\{current\.ar\}</Text>',
    '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.01} allowFontScaling={false} style={[styles.arabic,{width:"96%",alignSelf:"center",textAlign:"center",paddingVertical:8,includeFontPadding:true,fontSize:(landscape?58:78)*arabicScale,lineHeight:(landscape?68:92)*arabicScale,color:arabicColor,fontFamily:arabicFont,flexShrink:1}]}>{current.ar}</Text>',
    page,
    count=1,
)
page = re.sub(
    r'<Text numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.01\} allowFontScaling=\{false\} style=\{\[styles\.english, \{.*?fontSize:\(landscape\?42:54\)\*englishScale, color:englishColor, fontFamily:englishFont, flexShrink:1 \}\]\}>\{current\.en\}</Text>',
    '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.01} allowFontScaling={false} style={[styles.english,{width:"96%",alignSelf:"center",textAlign:"center",paddingVertical:5,includeFontPadding:true,fontSize:(landscape?42:54)*englishScale,lineHeight:(landscape?50:64)*englishScale,color:englishColor,fontFamily:englishFont,flexShrink:1}]}>{current.en}</Text>',
    page,
    count=1,
)

# -----------------------------------------------------------------------------
# Countdown styling + 5-minute freeze/heartbeat.
# -----------------------------------------------------------------------------
anchor = '  const prayerTimeFont = typeof remoteTheme.prayerTimeFont === "string" ? remoteTheme.prayerTimeFont : undefined;\n'
if anchor not in page:
    raise SystemExit("v1031: prayerTimeFont anchor missing")
if 'const countdownScale =' not in page:
    page = page.replace(anchor, anchor + '''  const countdownScale = clampTextScale(remoteTheme.countdownSize);\n  const countdownColor = themeHex(remoteTheme.countdownColor, cardBorder);\n  const countdownFont = typeof remoteTheme.countdownFont === "string" ? remoteTheme.countdownFont : undefined;\n  const showCountdown = remoteTheme.showCountdown !== false;\n  const freezeBeforeMinutes = Math.max(1, Number(remoteTheme.freezeBeforeMinutes) || 5);\n  const beatEnabled = remoteTheme.beatBeforePrayer !== false;\n''', 1)

# Ensure animation primitives/hooks are imported.
m = re.search(r'import \{([^}]*)\} from "react-native";', page, flags=re.S)
if not m:
    raise SystemExit("v1031: react-native import missing")
rn_names = [x.strip() for x in m.group(1).split(',') if x.strip()]
for name in ('Animated','Alert'):
    if name not in rn_names:
        rn_names.insert(0, name)
page = page[:m.start()] + 'import { ' + ', '.join(rn_names) + ' } from "react-native";' + page[m.end():]

m = re.search(r'import \{([^}]*)\} from "react";', page, flags=re.S)
if not m:
    raise SystemExit("v1031: react import missing")
react_names = [x.strip() for x in m.group(1).split(',') if x.strip()]
if 'useRef' not in react_names:
    react_names.append('useRef')
page = page[:m.start()] + 'import { ' + ', '.join(react_names) + ' } from "react";' + page[m.end():]

# Add exact-alarm recovery to the tablet itself. The full-screen tablet modal can remain
# open for weeks, so do not rely only on the Home page to explain/recover permissions.
page = page.replace(
    'import { schedulePrayerNotifications } from "./notifications";',
    'import { schedulePrayerNotifications } from "./notifications";\nimport { openExactAlarmSettings } from "./prayerAudio";',
    1,
)

# State for one-time exact alarm prompt and heartbeat animation.
state_anchor = '  const [tabletPrayerRuntimeStatus, setTabletPrayerRuntimeStatus] = useState("arming");\n'
if state_anchor not in page:
    raise SystemExit("v1031: tablet runtime state missing")
if 'exactAlarmTabletPromptRef' not in page:
    page = page.replace(state_anchor, state_anchor + '  const exactAlarmTabletPromptRef = useRef(false);\n  const beatAnim = useRef(new Animated.Value(1)).current;\n', 1)

# Replace the runtime exact-alarm-missing status branch with a visible recovery prompt.
old_exact = 'else if (result.exactAlarmGranted === false) setTabletPrayerRuntimeStatus("exact-alarm-permission-needed");'
new_exact = '''else if (result.exactAlarmGranted === false) {\n            setTabletPrayerRuntimeStatus("exact-alarm-permission-needed");\n            if (!exactAlarmTabletPromptRef.current && AppState.currentState === "active") {\n              exactAlarmTabletPromptRef.current = true;\n              Alert.alert(\n                "Allow Alarms & reminders",\n                "Tablet mode needs Android Alarms & reminders access for the Adhan to play exactly at prayer time, even while this display stays open.",\n                [\n                  { text: "Not now", style: "cancel", onPress: () => { exactAlarmTabletPromptRef.current = false; } },\n                  { text: "Open settings", onPress: () => openExactAlarmSettings() },\n                ]\n              );\n            }\n          }'''
if old_exact not in page:
    raise SystemExit("v1031: exact alarm runtime branch missing")
page = page.replace(old_exact, new_exact, 1)

# Build the imminent prayer lock from real seconds, not minute-rounded time.
next_anchor = '  const prayerNow = useMemo(() => {'
pos = page.find(next_anchor)
if pos < 0:
    raise SystemExit("v1031: prayerNow block missing")
# Insert imminent computation before prayerNow.
if 'const imminentPrayer =' not in page:
    imminent = '''  const imminentSeconds = secondsUntilPrayer(now, location.timezone, day?.[next]);\n  const imminentPrayer = imminentSeconds > 0 && imminentSeconds <= freezeBeforeMinutes * 60 ? next : null;\n\n'''
    page = page[:pos] + imminent + page[pos:]

# Current gallery card: prayer-now wins, then imminent prayer, then slideshow.
page = page.replace(
    '  const current = prayerNow ? (PRAYERS.find(p => p.key === prayerNow) || PRAYERS[slide]) : PRAYERS[slide];',
    '  const lockedPrayer = prayerNow || imminentPrayer;\n  const current = lockedPrayer ? (PRAYERS.find(p => p.key === lockedPrayer) || PRAYERS[slide]) : PRAYERS[slide];',
    1,
)
page = page.replace(
    '  const isPrayerNow = prayerNow === current.key;\n  const isNext = !isPrayerNow && current.key === next;',
    '  const isPrayerNow = prayerNow === current.key;\n  const isImminent = imminentPrayer === current.key;\n  const isNext = !isPrayerNow && current.key === next;',
    1,
)

# Heartbeat animation runs only in the pre-prayer freeze window.
if 'HASSOUN_TABLET_5MIN_BEAT_V1' not in page:
    current_anchor = '  const isNext = !isPrayerNow && current.key === next;\n'
    if current_anchor not in page:
        raise SystemExit("v1031: isNext anchor missing")
    beat_effect = '''\n  // HASSOUN_TABLET_5MIN_BEAT_V1\n  useEffect(() => {\n    if (!isImminent || !beatEnabled) { beatAnim.stopAnimation(); beatAnim.setValue(1); return; }\n    const loop = Animated.loop(Animated.sequence([\n      Animated.timing(beatAnim,{toValue:1.025,duration:420,useNativeDriver:true}),\n      Animated.timing(beatAnim,{toValue:1,duration:420,useNativeDriver:true}),\n    ]));\n    loop.start();\n    return () => { loop.stop(); beatAnim.setValue(1); };\n  }, [isImminent, beatEnabled, beatAnim]);\n'''
    page = page.replace(current_anchor, current_anchor + beat_effect, 1)

# Label should tell the viewer why the card froze.
page = page.replace(
    '(isPrayerNow ? "PRAYER NOW" : isNext ? "NEXT PRAYER" : "PRAYER")',
    '(isPrayerNow ? "PRAYER NOW" : isImminent ? "PRAYER SOON" : isNext ? "NEXT PRAYER" : "PRAYER")',
)

# Bottom active card also follows the frozen imminent prayer.
page = page.replace(
    'const active = prayerNow ? p.key === prayerNow : p.key === next;',
    'const active = lockedPrayer ? p.key === lockedPrayer : p.key === next;',
    1,
)

# Wrap the main hero card in Animated.View. This makes the whole gallery card pulse,
# including border/background/text, without clipping individual text nodes.
hero_start = '<LinearGradient colors={[cardA, cardB]} style={[styles.hero,'
idx = page.find(hero_start)
if idx < 0:
    raise SystemExit("v1031: hero opening not found")
line_end = page.find('>', idx)
if line_end < 0:
    raise SystemExit("v1031: hero opening malformed")
page = page[:idx] + '<Animated.View style={{width:"100%",height:heroAvailableHeight,alignItems:"center",justifyContent:"center",transform:[{scale:beatAnim}]}}>' + page[idx:]
# Close wrapper immediately after the hero LinearGradient's closing tag, before miniRow.
mini_marker = '\n        <View style={[styles.miniRow'
mini_idx = page.find(mini_marker)
if mini_idx < 0:
    mini_marker = '\n        <View style={styles.miniRow'
    mini_idx = page.find(mini_marker)
if mini_idx < 0:
    raise SystemExit("v1031: mini row marker missing")
hero_close = page.rfind('</LinearGradient>', idx, mini_idx)
if hero_close < 0:
    raise SystemExit("v1031: hero close missing")
hero_close_end = hero_close + len('</LinearGradient>')
page = page[:hero_close_end] + '</Animated.View>' + page[hero_close_end:]

# Countdown display: current next-prayer card or imminent frozen card. Full styling is
# remote-editable. During 5-minute mode it updates every second and remains visible.
countdown_patterns = [
    r'\{isNext && !isPrayerNow \? <Text style=\{styles\.countdown\}>◉ \{humanLeft\(nextSeconds\)\}</Text> : null\}',
    r'\{isNext \? <Text style=\{styles\.countdown\}>◉ \{humanLeft\(nextSeconds\)\}</Text> : null\}',
]
countdown_repl = '{showCountdown && (isNext || isImminent) && !isPrayerNow ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.01} style={[styles.countdown,{color:countdownColor,fontSize:22*countdownScale,fontFamily:countdownFont}]}>◉ {humanLeft(isImminent ? imminentSeconds : nextSeconds)}</Text> : null}'
changed = False
for pat in countdown_patterns:
    page, cn = re.subn(pat, countdown_repl, page, count=1)
    if cn:
        changed = True
        break
if not changed:
    raise SystemExit("v1031: countdown render block missing")

# -----------------------------------------------------------------------------
# Admin: expose countdown + 5-minute mode controls. Existing sizeField has no max.
# -----------------------------------------------------------------------------
if 'COUNTDOWN / TIME LEFT' not in editor:
    card_case = 'case"card":return <>'
    if card_case not in editor:
        raise SystemExit("v1031: card editor case missing")
    controls = '''case"card":return <><Text style={styles.fieldLabel}>COUNTDOWN / TIME LEFT</Text>{bool("Show time left","showCountdown",th.showCountdown!==false)}{sizeField("TIME LEFT SIZE","countdownSize",Number(th.countdownSize)||1)}{fontField("countdownFont",String(th.countdownFont||"sans-serif"))}{colorField("TIME LEFT COLOR","countdownColor",String(th.countdownColor||th.cardBorder||"#e0b761"))}{bool("5-minute heartbeat + freeze","beatBeforePrayer",th.beatBeforePrayer!==false)}<Text style={styles.fieldLabel}>FREEZE / BEAT BEFORE PRAYER · MINUTES</Text><TextInput defaultValue={String(Number(th.freezeBeforeMinutes)||5)} keyboardType="number-pad" returnKeyType="done" onEndEditing={e=>{const n=Number(String(e.nativeEvent.text||"").replace(/[^0-9.]/g,""));if(Number.isFinite(n)&&n>0)mutate({freezeBeforeMinutes:n})}} style={styles.input}/><Text style={styles.help}>At this many minutes before prayer, the gallery freezes on that prayer and the whole card gently beats until prayer time.</Text>'''
    editor = editor.replace(card_case, controls, 1)

# Make the dedicated tablet Adhan state explicit in the editor copy so "Adhan On" is
# not confused with only a decorative badge.
if 'TABLET PRAYER ENGINE' not in editor:
    marker = '<Text style={styles.fieldLabel}>SMART EDIT · CHOOSE WHAT TO CHANGE</Text>'
    if marker in editor:
        editor = editor.replace(marker, '<Text style={styles.fieldLabel}>TABLET PRAYER ENGINE</Text><Text style={styles.help}>Tablet mode automatically arms notifications and native exact Adhan alarms. The tablet setup screen shows ARMED / permission status.</Text>' + marker, 1)

# -----------------------------------------------------------------------------
# Bump Android build identity so this installs over v1.0.30/code 74.
# -----------------------------------------------------------------------------
cfg = CFG.read_text(encoding="utf-8")
cfg, v1 = re.subn(r'(?m)^(\s*)version\s*:.*?,\s*$', r'\1version: "1.0.31",', cfg, count=1)
cfg, v2 = re.subn(r'(?m)^(\s*)versionCode\s*:\s*\d+\s*,?\s*$', r'\1versionCode: 75,', cfg, count=1)
if v1 != 1 or v2 != 1:
    raise SystemExit(f"v1031: config bump failed version={v1} code={v2}")

for marker in [
    'requestedHeroBand','requestedMiniBand','HASSOUN_TABLET_5MIN_BEAT_V1','imminentPrayer',
    'PRAYER SOON','countdownScale','countdownColor','countdownFont','exactAlarmTabletPromptRef',
    'openExactAlarmSettings','height:heroAvailableHeight','miniHeight / requestedMiniBand'
]:
    if marker not in page:
        raise SystemExit(f"v1031 native marker missing: {marker}")
for marker in ['COUNTDOWN / TIME LEFT','TIME LEFT SIZE','5-minute heartbeat + freeze','FREEZE / BEAT BEFORE PRAYER','TABLET PRAYER ENGINE']:
    if marker not in editor:
        raise SystemExit(f"v1031 editor marker missing: {marker}")
if 'version: "1.0.31"' not in cfg or 'versionCode: 75' not in cfg:
    raise SystemExit("v1031 config markers missing")

PAGE.write_text(page, encoding="utf-8")
EDITOR.write_text(editor, encoding="utf-8")
CFG.write_text(cfg, encoding="utf-8")
print("HASSOUN_TABLET_FINAL_BEHAVIOR_V1031 applied: real card resizing, unclipped auto-fit text, 5-minute beat/freeze, editable countdown, self-healing Adhan permission")
