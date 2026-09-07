from pathlib import Path
import re

page_path = Path("mobile/src/MasjidDisplayPage.tsx")
page = page_path.read_text(encoding="utf-8")

# Native tablet consumes the paired editor's tabletTheme payload, including card sizing.
page = page.replace(
    '  const [slideSeconds, setSlideSeconds] = useState(8);',
    '  const [slideSeconds, setSlideSeconds] = useState(8);\n  const [remoteTheme, setRemoteTheme] = useState<Record<string, any>>({ fitFullScreen: true, mainCardScale: 1, lowerCardScale: 1 });'
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
insert = '''  const clampScale = (value: any, fallback = 1) => { const n = Number(value); return Number.isFinite(n) ? Math.max(.8, Math.min(1.1, n)) : fallback; };\n  const clampTextScale = (value: any, fallback = 1) => { const n = Number(value); return Number.isFinite(n) ? Math.max(.5, Math.min(4, n)) : fallback; };\n  const fitFullScreen = remoteTheme.fitFullScreen !== false;\n  const mainCardScale = clampScale(remoteTheme.mainCardScale);\n  const lowerCardScale = clampScale(remoteTheme.lowerCardScale);\n  const metaScale = clampTextScale(remoteTheme.metaSize);\n  const clockScale = clampTextScale(remoteTheme.clockSize);\n  const arabicScale = clampTextScale(remoteTheme.arabicSize);\n  const englishScale = clampTextScale(remoteTheme.englishSize);\n  const prayerTimeScale = clampTextScale(remoteTheme.prayerTimeSize);\n  const mainCardHeight = Math.round((landscape ? height * .48 : height * .57) * mainCardScale);\n  const lowerCardHeight = Math.round(104 * lowerCardScale);\n'''
if anchor not in page:
    raise SystemExit("Could not find native tablet sizing insertion point")
page = page.replace(anchor, insert + anchor)

page = page.replace(
    '<Text style={styles.metaText}>✦ {location.label}</Text>',
    '<Text style={[styles.metaText, { fontSize: 16 * metaScale }]}>✦ {location.label}</Text>',
    1
)
page = page.replace(
    '<Text style={styles.metaText}>▣ {date}</Text>',
    '<Text style={[styles.metaText, { fontSize: 16 * metaScale }]}>▣ {date}</Text>',
    1
)
page = page.replace(
    '<Text style={[styles.clock, { fontSize: landscape ? 78 : 112 }]}>{clock}</Text>',
    '<Text style={[styles.clock, { fontSize: (landscape ? 78 : 112) * clockScale }]}>{clock}</Text>',
    1
)
page = page.replace(
    '<LinearGradient colors={[CLASSIC.cardA, CLASSIC.cardB]} style={styles.hero}>',
    '<LinearGradient colors={[CLASSIC.cardA, CLASSIC.cardB]} style={[styles.hero, fitFullScreen ? { flex: 1 } : { flex: 0, height: mainCardHeight }]}>',
    1
)
page = page.replace(
    '<Text style={[styles.arabic, { fontSize: landscape ? 58 : 78 }]}>{current.ar}</Text>',
    '<Text style={[styles.arabic, { fontSize: (landscape ? 58 : 78) * arabicScale }]}>{current.ar}</Text>',
    1
)
page = page.replace(
    '<Text style={[styles.english, { fontSize: landscape ? 42 : 54 }]}>{current.en}</Text>',
    '<Text style={[styles.english, { fontSize: (landscape ? 42 : 54) * englishScale }]}>{current.en}</Text>',
    1
)
page = page.replace(
    '<View style={styles.timeRow}><Text style={[styles.prayerTime, { fontSize: landscape ? 62 : 82 }]}>{currentTime.main}</Text><Text style={styles.prayerPeriod}>{currentTime.period}</Text></View>',
    '<View style={styles.timeRow}><Text style={[styles.prayerTime, { fontSize: (landscape ? 62 : 82) * prayerTimeScale }]}>{currentTime.main}</Text><Text style={[styles.prayerPeriod, { fontSize: 26 * prayerTimeScale }]}>{currentTime.period}</Text></View>',
    1
)
page = page.replace(
    '<View style={styles.miniRow}>',
    '<View style={[styles.miniRow, { height: lowerCardHeight }]}>',
    1
)

for marker in ['fitFullScreen', 'mainCardHeight', 'lowerCardHeight', 'clockScale', 'arabicScale', 'englishScale', 'prayerTimeScale', 'metaScale']:
    if marker not in page:
        raise SystemExit(f"Native full-screen/text sizing patch did not apply: {marker}")
page_path.write_text(page, encoding="utf-8")

controller_path = Path("mobile/src/ConnectDisplayPage.tsx")
controller = controller_path.read_text(encoding="utf-8")

controller = controller.replace(
    'showMiniPeriod:false,sliderSeconds:8',
    'showMiniPeriod:false,fitFullScreen:true,mainCardScale:1,lowerCardScale:1,sliderSeconds:8'
)

# Replace the limited text size preset helper with presets plus a manual percentage field.
old_size = '  const sizeField=(label:string,key:string,value:number)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.stepRow}>{[0.75,0.9,1,1.15,1.3,1.5].map(n=><Pressable key={n} onPress={()=>mutate({[key]:n})} style={[styles.step,Math.abs(value-n)<.01&&styles.stepOn]}><Text style={styles.stepText}>{Math.round(n*100)}%</Text></Pressable>)}</View></View>;'
new_size = '  const sizeField=(label:string,key:string,value:number)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.stepRow}>{[0.75,1,1.25,1.5,2,2.5,3].map(n=><Pressable key={n} onPress={()=>mutate({[key]:n})} style={[styles.step,Math.abs(value-n)<.01&&styles.stepOn]}><Text style={styles.stepText}>{Math.round(n*100)}%</Text></Pressable>)}</View><View style={styles.colorRow}><TextInput key={`${key}-${Math.round((Number(value)||1)*100)}`} defaultValue={String(Math.round((Number(value)||1)*100))} keyboardType="number-pad" returnKeyType="done" onEndEditing={e=>{const pct=Number(String(e.nativeEvent.text||"").replace(/[^0-9.]/g,""));if(Number.isFinite(pct)&&pct>0)mutate({[key]:Math.max(.5,Math.min(4,pct/100))})}} style={styles.input}/><Text style={styles.fieldLabel}>%</Text></View><Text style={styles.help}>Enter any size from 50% to 400%.</Text></View>;'
if old_size not in controller:
    raise SystemExit("Could not find existing text size helper")
controller = controller.replace(old_size, new_size)

size_anchor = '  const fontField=(key:string,value:string)=><View style={styles.field}><Text style={styles.fieldLabel}>FONT TYPE</Text>'
if size_anchor not in controller:
    raise SystemExit("Could not find paired editor size helper insertion point")
controller = controller.replace(
    size_anchor,
    '  const cardSizeField=(label:string,key:string,value:number)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.stepRow}>{[0.8,0.9,1,1.05,1.1].map(n=><Pressable key={n} onPress={()=>mutate({[key]:n})} style={[styles.step,Math.abs(value-n)<.01&&styles.stepOn]}><Text style={styles.stepText}>{Math.round(n*100)}%</Text></Pressable>)}</View></View>;\n' + size_anchor
)

card_old = 'case"card":return <>{colorField("CARD COLOR 1","cardGradientA",th.cardGradientA)}'
card_new = 'case"card":return <>{bool("Fill tablet screen","fitFullScreen",th.fitFullScreen!==false)}{cardSizeField("MAIN GALLERY PRAYER CARD SIZE","mainCardScale",Number(th.mainCardScale)||1)}{colorField("CARD COLOR 1","cardGradientA",th.cardGradientA)}'
if card_old not in controller:
    raise SystemExit("Could not find main card editor controls")
controller = controller.replace(card_old, card_new)

mini_old = 'default:return <>{bool("Show mini-card AM / PM","showMiniPeriod",th.showMiniPeriod===true)}'
mini_new = 'default:return <>{cardSizeField("LOWER PRAYER CARDS SIZE","lowerCardScale",Number(th.lowerCardScale)||1)}{bool("Show mini-card AM / PM","showMiniPeriod",th.showMiniPeriod===true)}'
if mini_old not in controller:
    raise SystemExit("Could not find lower card editor controls")
controller = controller.replace(mini_old, mini_new)

for marker in ["Fill tablet screen", "MAIN GALLERY PRAYER CARD SIZE", "LOWER PRAYER CARDS SIZE", "Enter any size from 50% to 400%", "fitFullScreen", "mainCardScale", "lowerCardScale"]:
    if marker not in controller:
        raise SystemExit(f"Missing controller sizing marker: {marker}")
controller_path.write_text(controller, encoding="utf-8")

# The canonical stack can express version either as a literal or as an env fallback.
# Replace the complete config lines instead of assuming the value starts with a quote.
cfg_path = Path("mobile/app.config.ts")
cfg = cfg_path.read_text(encoding="utf-8")
cfg, n1 = re.subn(r'(?m)^(\s*)version\s*:.*?,\s*$', r'\1version: "1.0.30",', cfg, count=1)
cfg, n2 = re.subn(r'(?m)^(\s*)versionCode\s*:\s*\d+\s*,?\s*$', r'\1versionCode: 74,', cfg, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"Could not set app version robustly: version={n1}, versionCode={n2}")
if 'version: "1.0.30"' not in cfg or 'versionCode: 74' not in cfg:
    raise SystemExit("v1.0.30 config verification failed after replacement")
cfg_path.write_text(cfg, encoding="utf-8")

print("HASSOUN_TABLET_REMOTE_SIZING_V5 applied: admin full-screen fit, main/lower card sizing, manual 50-400% text sizing, v1.0.30/74")
