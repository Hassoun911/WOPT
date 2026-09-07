from pathlib import Path
import re

page_path = Path("mobile/src/MasjidDisplayPage.tsx")
page = page_path.read_text(encoding="utf-8")

# Add video/image background support to the native tablet screen.
if 'from "expo-video"' not in page:
    page = page.replace('import * as ScreenOrientation from "expo-screen-orientation";\n', 'import * as ScreenOrientation from "expo-screen-orientation";\nimport { useVideoPlayer, VideoView } from "expo-video";\n', 1)

# The reconstructed MasjidDisplayPage may already import Image from react-native.
# Add it only when Image is not already present in a react-native import.
rn_imports = re.findall(r'import\s*\{([^}]*)\}\s*from\s*["\']react-native["\'];', page, flags=re.S)
has_image = any(re.search(r'(^|,)\s*Image\s*(,|$)', names) for names in rn_imports)
if not has_image:
    m = re.search(r'import\s*\{([^}]*)\}\s*from\s*["\']react-native["\'];', page, flags=re.S)
    if not m:
        raise SystemExit("Could not find react-native import to add Image")
    names = m.group(1).strip()
    replacement = 'import { Image, ' + names + '} from "react-native";'
    page = page[:m.start()] + replacement + page[m.end():]

anchor = '  const prayerTimeFont = typeof remoteTheme.prayerTimeFont === "string" ? remoteTheme.prayerTimeFont : undefined;\n'
insert = '''  const backgroundMode = remoteTheme.backgroundMode === "image" || remoteTheme.backgroundMode === "video" ? remoteTheme.backgroundMode : "color";\n  const backgroundImageUrl = typeof remoteTheme.backgroundImageUrl === "string" ? remoteTheme.backgroundImageUrl.trim() : "";\n  const backgroundVideoUrl = typeof remoteTheme.backgroundVideoUrl === "string" ? remoteTheme.backgroundVideoUrl.trim() : "";\n  const pageA = themeHex(remoteTheme.pageGradientA, CLASSIC.pageA);\n  const pageB = themeHex(remoteTheme.pageGradientB, CLASSIC.pageB);\n  const mainCardWidthScale = Math.max(.5, Math.min(1, Number(remoteTheme.mainCardWidthScale) || 1));\n  const mainCardHeightScale = Math.max(.5, Math.min(1.6, Number(remoteTheme.mainCardHeightScale) || 1));\n  const backgroundPlayer = useVideoPlayer(backgroundMode === "video" && backgroundVideoUrl ? backgroundVideoUrl : null, player => { player.loop = true; player.muted = true; if (backgroundVideoUrl) player.play(); });\n'''
if anchor not in page:
    raise SystemExit("Could not find live-theme anchor for smart editor")
if 'const backgroundMode =' not in page:
    page = page.replace(anchor, anchor + insert, 1)

page = page.replace('<LinearGradient colors={[CLASSIC.pageA, CLASSIC.pageB]} style={styles.root}>', '<LinearGradient colors={[pageA, pageB]} style={styles.root}>', 1)
status_anchor = '        <StatusBar hidden />\n'
background_layers = '''        {backgroundMode === "video" && backgroundVideoUrl ? <VideoView player={backgroundPlayer} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} /> : null}\n        {backgroundMode === "image" && backgroundImageUrl ? <Image source={{ uri: backgroundImageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}\n'''
if status_anchor not in page:
    raise SystemExit("Could not find tablet StatusBar insertion point")
if 'backgroundMode === "video"' not in page:
    page = page.replace(status_anchor, status_anchor + background_layers, 1)

hero_old = '<LinearGradient colors={[cardA, cardB]} style={[styles.hero, { borderColor: cardBorder }, fitFullScreen ? { flex: 1 } : { flex: 0, height: mainCardHeight }]}> '
if hero_old not in page:
    hero_old = '<LinearGradient colors={[cardA, cardB]} style={[styles.hero, { borderColor: cardBorder }, fitFullScreen ? { flex: 1 } : { flex: 0, height: mainCardHeight }]}>'
hero_new = '<LinearGradient colors={[cardA, cardB]} style={[styles.hero, { borderColor: cardBorder, width: `${Math.round(mainCardWidthScale * 100)}%`, alignSelf: "center" }, fitFullScreen ? { flex: 1 } : { flex: 0, height: Math.round(mainCardHeight * mainCardHeightScale) }]}>'
if hero_old not in page:
    raise SystemExit("Could not find main card style for width/height controls")
page = page.replace(hero_old, hero_new, 1)

mini_anchor = '            const m = prayerParts(day?.[p.key]);\n'
mini_insert = '''            const miniPrefix = `mini_${p.key}_`;\n            const miniWidth = Math.max(.55, Math.min(1.7, Number(remoteTheme[`${miniPrefix}width`]) || 1));\n            const miniHeight = Math.max(.55, Math.min(1.7, Number(remoteTheme[`${miniPrefix}height`]) || 1));\n            const miniArabicScale = clampTextScale(remoteTheme[`${miniPrefix}arabicSize`]);\n            const miniEnglishScale = clampTextScale(remoteTheme[`${miniPrefix}englishSize`]);\n            const miniTimeScale = clampTextScale(remoteTheme[`${miniPrefix}timeSize`]);\n            const miniTextColor = themeHex(remoteTheme[`${miniPrefix}textColor`], active ? CLASSIC.white : CLASSIC.miniText);\n            const miniA = themeHex(remoteTheme[`${miniPrefix}bgA`], active ? CLASSIC.nextA : CLASSIC.mini);\n            const miniB = themeHex(remoteTheme[`${miniPrefix}bgB`], active ? CLASSIC.nextB : "#f3f0f4");\n            const miniFont = typeof remoteTheme[`${miniPrefix}font`] === "string" ? remoteTheme[`${miniPrefix}font`] : undefined;\n'''
if mini_anchor not in page:
    raise SystemExit("Could not find lower card map anchor")
if 'const miniPrefix =' not in page:
    page = page.replace(mini_anchor, mini_anchor + mini_insert, 1)

page = page.replace('style={styles.miniWrap}>', 'style={[styles.miniWrap, { flex: miniWidth, height: Math.round(lowerCardHeight * miniHeight), alignSelf: "flex-end" }]}>', 1)
page = page.replace('colors={active ? [CLASSIC.nextA, CLASSIC.nextB] : [CLASSIC.mini, "#f3f0f4"]}', 'colors={[miniA, miniB]}', 1)
page = page.replace('<Text style={[styles.miniAr, active && styles.miniTextActive]}>{p.ar}</Text>', '<Text style={[styles.miniAr, { color: miniTextColor, fontSize: 13 * miniArabicScale, fontFamily: miniFont }]}>{p.ar}</Text>', 1)
page = page.replace('<Text style={[styles.miniEn, active && styles.miniTextActive]}>{p.en}</Text>', '<Text style={[styles.miniEn, { color: miniTextColor, fontSize: 14 * miniEnglishScale, fontFamily: miniFont }]}>{p.en}</Text>', 1)
page = page.replace('<Text style={[styles.miniIcon, active && styles.miniTextActive]}>{p.icon}</Text>', '<Text style={[styles.miniIcon, { color: miniTextColor, fontFamily: miniFont }]}>{p.icon}</Text>', 1)
page = page.replace('<Text style={[styles.miniTime, active && styles.miniTextActive]}>{m.main}</Text>', '<Text style={[styles.miniTime, { color: miniTextColor, fontSize: 16 * miniTimeScale, fontFamily: miniFont }]}>{m.main}</Text>', 1)

for marker in ['backgroundMode', 'backgroundImageUrl', 'backgroundVideoUrl', 'VideoView', 'mainCardWidthScale', 'mainCardHeightScale', 'miniPrefix', 'miniArabicScale', 'miniEnglishScale', 'miniTimeScale']:
    if marker not in page:
        raise SystemExit(f"Missing native smart-editor marker: {marker}")
page_path.write_text(page, encoding="utf-8")

controller_path = Path("mobile/src/ConnectDisplayPage.tsx")
controller = controller_path.read_text(encoding="utf-8")
controller = controller.replace('pageGradientA:"#11aa91",pageGradientB:"#078f79",', 'backgroundMode:"color",backgroundImageUrl:"",backgroundVideoUrl:"",pageGradientA:"#11aa91",pageGradientB:"#078f79",mainCardWidthScale:1,mainCardHeightScale:1,', 1)

if '[selectedMini,setSelectedMini]' not in controller:
    pat = r'(\[selected\s*,\s*setSelected\]\s*=\s*useState<Part>\("clock"\))'
    controller, n = re.subn(pat, r'\1,[selectedMini,setSelectedMini]=useState("fajr")', controller, count=1)
    if n != 1:
        raise SystemExit("Could not add selected lower-card state")

font_anchor = '  const fontField=(key:string,value:string)=><View style={styles.field}><Text style={styles.fieldLabel}>FONT TYPE</Text>'
if font_anchor not in controller:
    raise SystemExit("Could not find font helper anchor")
if 'const percentField=' not in controller:
    percent_helper = '  const percentField=(label:string,key:string,value:number,min=50,max=170)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.colorRow}><TextInput key={`${key}-${Math.round((Number(value)||1)*100)}`} defaultValue={String(Math.round((Number(value)||1)*100))} keyboardType="number-pad" returnKeyType="done" onEndEditing={e=>{const pct=Number(String(e.nativeEvent.text||"").replace(/[^0-9.]/g,""));if(Number.isFinite(pct))mutate({[key]:Math.max(min,Math.min(max,pct))/100})}} style={styles.input}/><Text style={styles.fieldLabel}>%</Text></View><Text style={styles.help}>Enter {min}%–{max}%.</Text></View>;\n'
    controller = controller.replace(font_anchor, percent_helper + font_anchor, 1)

page_case_pattern = re.compile(r'case"page":return <>.*?</>;case"meta":', re.S)
page_case = '''case"page":return <><Text style={styles.fieldLabel}>WHOLE DISPLAY BACKGROUND</Text><View style={styles.stepRow}>{["color","image","video"].map(mode=><Pressable key={mode} onPress={()=>mutate({backgroundMode:mode})} style={[styles.step,String(th.backgroundMode||"color")===mode&&styles.stepOn]}><Text style={styles.stepText}>{mode.toUpperCase()}</Text></Pressable>)}</View>{String(th.backgroundMode||"color")==="image"?<><Text style={styles.fieldLabel}>IMAGE URL</Text><TextInput value={String(th.backgroundImageUrl||"")} onChangeText={v=>mutate({backgroundImageUrl:v})} placeholder="https://.../background.jpg" autoCapitalize="none" style={styles.input}/></>:null}{String(th.backgroundMode||"color")==="video"?<><Text style={styles.fieldLabel}>VIDEO URL</Text><TextInput value={String(th.backgroundVideoUrl||"")} onChangeText={v=>mutate({backgroundVideoUrl:v})} placeholder="https://.../background.mp4" autoCapitalize="none" style={styles.input}/><Text style={styles.help}>Use a direct MP4/video URL. The tablet loops it silently behind the prayer display.</Text></>:null}{colorField("APP BACKGROUND COLOR 1","pageGradientA",th.pageGradientA)}{colorField("APP BACKGROUND COLOR 2","pageGradientB",th.pageGradientB)}<Text style={styles.fieldLabel}>GRADIENT MIX POINTER</Text><View style={styles.stepRow}>{[0,25,50,75,100].map(n=><Pressable key={n} onPress={()=>mutate({gradientMix:n})} style={[styles.step,Number(th.gradientMix)===n&&styles.stepOn]}><Text style={styles.stepText}>{n}%</Text></Pressable>)}</View></>;case"meta":'''
controller, n = page_case_pattern.subn(page_case, controller, count=1)
if n != 1:
    raise SystemExit("Could not replace whole-page editor controls")

card_marker = 'case"card":return <>{bool("Fill tablet screen","fitFullScreen",th.fitFullScreen!==false)}'
if card_marker not in controller:
    raise SystemExit("Could not find main card editor case")
controller = controller.replace(card_marker, 'case"card":return <>{bool("Fill tablet screen","fitFullScreen",th.fitFullScreen!==false)}{percentField("MAIN CARD WIDTH","mainCardWidthScale",Number(th.mainCardWidthScale)||1,50,100)}{percentField("MAIN CARD HEIGHT","mainCardHeightScale",Number(th.mainCardHeightScale)||1,50,160)}', 1)

mini_pattern = re.compile(r'default:return <>.*?</>}};', re.S)
mini_case = '''default:{const k=String(selectedMini||"fajr");const pref=`mini_${k}_`;return <><Text style={styles.fieldLabel}>LOWER PRAYER CARDS SIZE · EDIT LOWER PRAYER CARD</Text><View style={styles.stepRow}>{[["fajr","Fajr"],["dhuhr","Dhuhr"],["asr","Asr"],["maghrib","Maghrib"],["isha","Isha"]].map(([key,label])=><Pressable key={key} onPress={()=>setSelectedMini(key)} style={[styles.step,k===key&&styles.stepOn]}><Text style={styles.stepText}>{label}</Text></Pressable>)}</View>{percentField("CARD WIDTH",`${pref}width`,Number(th[`${pref}width`])||1,55,170)}{percentField("CARD HEIGHT",`${pref}height`,Number(th[`${pref}height`])||1,55,170)}{sizeField("ARABIC TEXT SIZE",`${pref}arabicSize`,Number(th[`${pref}arabicSize`])||1)}{sizeField("ENGLISH TEXT SIZE",`${pref}englishSize`,Number(th[`${pref}englishSize`])||1)}{sizeField("PRAYER TIME SIZE",`${pref}timeSize`,Number(th[`${pref}timeSize`])||1)}{fontField(`${pref}font`,String(th[`${pref}font`]||"sans-serif"))}{colorField("CARD COLOR 1",`${pref}bgA`,String(th[`${pref}bgA`]||th.miniGradientA))}{colorField("CARD COLOR 2",`${pref}bgB`,String(th[`${pref}bgB`]||th.miniGradientB))}{colorField("ALL TEXT COLOR",`${pref}textColor`,String(th[`${pref}textColor`]||th.miniTextColor))}{bool("Show mini-card AM / PM","showMiniPeriod",th.showMiniPeriod===true)}</>;}}};'''
controller, n = mini_pattern.subn(mini_case, controller, count=1)
if n != 1:
    raise SystemExit("Could not replace lower-card editor")

for marker in ['WHOLE DISPLAY BACKGROUND', 'IMAGE URL', 'VIDEO URL', 'APP BACKGROUND COLOR 1', 'MAIN CARD WIDTH', 'MAIN CARD HEIGHT', 'LOWER PRAYER CARDS SIZE', 'EDIT LOWER PRAYER CARD', 'ARABIC TEXT SIZE', 'ENGLISH TEXT SIZE', 'PRAYER TIME SIZE', 'selectedMini']:
    if marker not in controller:
        raise SystemExit(f"Missing smart editor control: {marker}")
controller_path.write_text(controller, encoding="utf-8")

print("HASSOUN_TABLET_SMART_EDITOR_V4 applied: duplicate-safe Image import + fixed TypeScript syntax + whole-screen color/image/video backgrounds + independent main/lower card sizing/text/font/colors")
