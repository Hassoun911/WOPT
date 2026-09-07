from pathlib import Path
import re

page_path = Path("mobile/src/MasjidDisplayPage.tsx")
page = page_path.read_text(encoding="utf-8")

# Native tablet consumes the paired editor's tabletTheme payload, including card sizing.
page = page.replace(
    '  const [slideSeconds, setSlideSeconds] = useState(8);',
    '  const [slideSeconds, setSlideSeconds] = useState(8);\n  const [remoteTheme, setRemoteTheme] = useState<Record<string, any>>({ mainCardScale: 1, lowerCardScale: 1 });'
)

page = page.replace(
    '          if (Number(parsed?.slideSeconds) >= 4) setSlideSeconds(Number(parsed.slideSeconds));',
    '          const storedTheme = parsed?.tabletTheme && typeof parsed.tabletTheme === "object" ? parsed.tabletTheme : parsed;\n          setRemoteTheme(storedTheme || {});\n          const storedSlide = Number(storedTheme?.sliderSeconds ?? parsed?.slideSeconds);\n          if (storedSlide >= 4) setSlideSeconds(storedSlide);'
)

old_poll = '''          const remoteSlide = Number(data.settings?.sliderSeconds);\n          if (remoteSlide >= 4 && remoteSlide <= 60) {\n            setSlideSeconds(remoteSlide);\n            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ slideSeconds: remoteSlide }));\n          }'''
new_poll = '''          const incomingSettings = data.settings && typeof data.settings === "object" ? data.settings : {};\n          const incomingTheme = incomingSettings.tabletTheme && typeof incomingSettings.tabletTheme === "object" ? incomingSettings.tabletTheme : {};\n          setRemoteTheme(incomingTheme);\n          const remoteSlide = Number(incomingTheme.sliderSeconds ?? incomingSettings.sliderSeconds);\n          if (remoteSlide >= 4 && remoteSlide <= 60) setSlideSeconds(remoteSlide);\n          await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...incomingSettings, tabletTheme: incomingTheme }));'''
if old_poll not in page:
    raise SystemExit("Could not find native tablet remote poll block")
page = page.replace(old_poll, new_poll)

anchor = '  const pairUrl = device ? `https://hassoun.app/masjid-tv/pair/?device=${encodeURIComponent(device.id)}&code=${device.code}` : "";'
insert = '''  const clampScale = (value: any, fallback = 1) => { const n = Number(value); return Number.isFinite(n) ? Math.max(.8, Math.min(1.1, n)) : fallback; };\n  const mainCardScale = clampScale(remoteTheme.mainCardScale);\n  const lowerCardScale = clampScale(remoteTheme.lowerCardScale);\n  const mainCardHeight = Math.round((landscape ? height * .48 : height * .57) * mainCardScale);\n  const lowerCardHeight = Math.round(104 * lowerCardScale);\n'''
if anchor not in page:
    raise SystemExit("Could not find native tablet sizing insertion point")
page = page.replace(anchor, insert + anchor)

page = page.replace(
    '<LinearGradient colors={[CLASSIC.cardA, CLASSIC.cardB]} style={styles.hero}>',
    '<LinearGradient colors={[CLASSIC.cardA, CLASSIC.cardB]} style={[styles.hero, { flex: 0, height: mainCardHeight }]}>',
    1
)
page = page.replace(
    '<View style={styles.miniRow}>',
    '<View style={[styles.miniRow, { height: lowerCardHeight }]}>',
    1
)

if 'mainCardHeight' not in page or 'lowerCardHeight' not in page:
    raise SystemExit("Native card sizing patch did not apply")
page_path.write_text(page, encoding="utf-8")

controller_path = Path("mobile/src/ConnectDisplayPage.tsx")
controller = controller_path.read_text(encoding="utf-8")

controller = controller.replace(
    'showMiniPeriod:false,sliderSeconds:8',
    'showMiniPeriod:false,mainCardScale:1,lowerCardScale:1,sliderSeconds:8'
)

size_anchor = '  const fontField=(key:string,value:string)=><View style={styles.field}><Text style={styles.fieldLabel}>FONT TYPE</Text>'
if size_anchor not in controller:
    raise SystemExit("Could not find paired editor size helper insertion point")
controller = controller.replace(
    size_anchor,
    '  const cardSizeField=(label:string,key:string,value:number)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.stepRow}>{[0.8,0.9,1,1.05,1.1].map(n=><Pressable key={n} onPress={()=>mutate({[key]:n})} style={[styles.step,Math.abs(value-n)<.01&&styles.stepOn]}><Text style={styles.stepText}>{Math.round(n*100)}%</Text></Pressable>)}</View></View>;\n' + size_anchor
)

card_old = 'case"card":return <>{colorField("CARD COLOR 1","cardGradientA",th.cardGradientA)}'
card_new = 'case"card":return <>{cardSizeField("MAIN GALLERY PRAYER CARD SIZE","mainCardScale",Number(th.mainCardScale)||1)}{colorField("CARD COLOR 1","cardGradientA",th.cardGradientA)}'
if card_old not in controller:
    raise SystemExit("Could not find main card editor controls")
controller = controller.replace(card_old, card_new)

mini_old = 'default:return <>{bool("Show mini-card AM / PM","showMiniPeriod",th.showMiniPeriod===true)}'
mini_new = 'default:return <>{cardSizeField("LOWER PRAYER CARDS SIZE","lowerCardScale",Number(th.lowerCardScale)||1)}{bool("Show mini-card AM / PM","showMiniPeriod",th.showMiniPeriod===true)}'
if mini_old not in controller:
    raise SystemExit("Could not find lower card editor controls")
controller = controller.replace(mini_old, mini_new)

for marker in ["MAIN GALLERY PRAYER CARD SIZE", "LOWER PRAYER CARDS SIZE", "mainCardScale", "lowerCardScale"]:
    if marker not in controller:
        raise SystemExit(f"Missing controller sizing marker: {marker}")
controller_path.write_text(controller, encoding="utf-8")

# The reconstructed app config can come from an older version string. Set v1.0.30 robustly.
cfg_path = Path("mobile/app.config.ts")
cfg = cfg_path.read_text(encoding="utf-8")
cfg, n1 = re.subn(r'\bversion\s*:\s*["\'][^"\']+["\']', 'version: "1.0.30"', cfg, count=1)
cfg, n2 = re.subn(r'\bversionCode\s*:\s*\d+', 'versionCode: 74', cfg, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"Could not set app version robustly: version={n1}, versionCode={n2}")
cfg_path.write_text(cfg, encoding="utf-8")

print("HASSOUN_TABLET_REMOTE_SIZING_V2 applied: main + lower prayer card sizing, full tabletTheme receive, v1.0.30/74")
