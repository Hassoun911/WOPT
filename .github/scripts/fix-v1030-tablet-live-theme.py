from pathlib import Path
import re

page_path = Path("mobile/src/MasjidDisplayPage.tsx")
page = page_path.read_text(encoding="utf-8")

# Make the native tablet consume the paired editor theme, not hard-coded CLASSIC colors/fonts.
anchor = '  const prayerTimeScale = clampTextScale(remoteTheme.prayerTimeSize);\n'
insert = '''  const themeHex = (value: any, fallback: string) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;\n  const metaColor = themeHex(remoteTheme.metaColor, CLASSIC.meta);\n  const clockColor = themeHex(remoteTheme.clockColor, CLASSIC.clock);\n  const cardA = themeHex(remoteTheme.cardGradientA, CLASSIC.cardA);\n  const cardB = themeHex(remoteTheme.cardGradientB, CLASSIC.cardB);\n  const cardBorder = themeHex(remoteTheme.cardBorder, CLASSIC.gold);\n  const arabicColor = themeHex(remoteTheme.arabicColor, CLASSIC.gold);\n  const englishColor = themeHex(remoteTheme.englishColor, CLASSIC.white);\n  const prayerTimeColor = themeHex(remoteTheme.prayerTimeColor, CLASSIC.white);\n  const clockFont = typeof remoteTheme.clockFont === "string" ? remoteTheme.clockFont : undefined;\n  const arabicFont = typeof remoteTheme.arabicFont === "string" ? remoteTheme.arabicFont : undefined;\n  const englishFont = typeof remoteTheme.englishFont === "string" ? remoteTheme.englishFont : undefined;\n  const prayerTimeFont = typeof remoteTheme.prayerTimeFont === "string" ? remoteTheme.prayerTimeFont : undefined;\n'''
if anchor not in page:
    raise SystemExit("Could not find tablet theme insertion anchor")
page = page.replace(anchor, anchor + insert, 1)

replacements = [
    ('<Text style={[styles.metaText, { fontSize: 16 * metaScale }]}>✦ {location.label}</Text>', '<Text style={[styles.metaText, { fontSize: 16 * metaScale, color: metaColor }]}>✦ {location.label}</Text>'),
    ('<Text style={[styles.metaText, { fontSize: 16 * metaScale }]}>▣ {date}</Text>', '<Text style={[styles.metaText, { fontSize: 16 * metaScale, color: metaColor }]}>▣ {date}</Text>'),
    ('<Pressable onPress={() => setSetup(true)} style={styles.clockButton}>', '<Pressable onPress={() => setSetup(true)} style={[styles.clockButton,{width:"100%",alignSelf:"stretch",justifyContent:"center",overflow:"visible",paddingHorizontal:4}]}>'),
    ('<Text style={[styles.clock, { fontSize: (landscape ? 78 : 112) * clockScale }]}>{clock}</Text>', '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.2} allowFontScaling={false} style={[styles.clock, { width:"100%", textAlign:"center", fontSize: (landscape ? 78 : 112) * clockScale, color: clockColor, fontFamily: clockFont }]}>{clock}</Text>'),
    ('<LinearGradient colors={[CLASSIC.cardA, CLASSIC.cardB]} style={[styles.hero, fitFullScreen ? { flex: 1 } : { flex: 0, height: mainCardHeight }]}>', '<LinearGradient colors={[cardA, cardB]} style={[styles.hero, { borderColor: cardBorder }, fitFullScreen ? { flex: 1 } : { flex: 0, height: mainCardHeight }]}>'),
    ('<Text style={[styles.arabic, { fontSize: (landscape ? 58 : 78) * arabicScale }]}>{current.ar}</Text>', '<Text style={[styles.arabic, { fontSize: (landscape ? 58 : 78) * arabicScale, color: arabicColor, fontFamily: arabicFont }]}>{current.ar}</Text>'),
    ('<Text style={[styles.english, { fontSize: (landscape ? 42 : 54) * englishScale }]}>{current.en}</Text>', '<Text style={[styles.english, { fontSize: (landscape ? 42 : 54) * englishScale, color: englishColor, fontFamily: englishFont }]}>{current.en}</Text>'),
    ('<View style={styles.timeRow}><Text style={[styles.prayerTime, { fontSize: (landscape ? 62 : 82) * prayerTimeScale }]}>{currentTime.main}</Text><Text style={[styles.prayerPeriod, { fontSize: 26 * prayerTimeScale }]}>{currentTime.period}</Text></View>', '<View style={styles.timeRow}><Text style={[styles.prayerTime, { fontSize: (landscape ? 62 : 82) * prayerTimeScale, color: prayerTimeColor, fontFamily: prayerTimeFont }]}>{currentTime.main}</Text><Text style={[styles.prayerPeriod, { fontSize: 26 * prayerTimeScale, color: prayerTimeColor, fontFamily: prayerTimeFont }]}>{currentTime.period}</Text></View>'),
]
for old, new in replacements:
    if old not in page:
        raise SystemExit(f"Could not apply native live theme replacement: {old[:80]}")
    page = page.replace(old, new, 1)

for marker in ["clockColor", "clockFont", "arabicColor", "englishColor", "prayerTimeColor", "cardBorder", "adjustsFontSizeToFit", 'width:"100%"']:
    if marker not in page:
        raise SystemExit(f"Missing native live theme marker: {marker}")
page_path.write_text(page, encoding="utf-8")

controller_path = Path("mobile/src/ConnectDisplayPage.tsx")
controller = controller_path.read_text(encoding="utf-8")

fonts = 'const FONTS=["sans-serif","serif","monospace","sans-serif-condensed"];'
palette = 'const COLOR_PALETTE=["#ffffff","#f8f3e8","#f4cb77","#e0b761","#ffb300","#ff6b35","#ef4444","#be123c","#ec4899","#a855f7","#6366f1","#2563eb","#06b6d4","#14b8a6","#10b981","#22c55e","#84cc16","#0d8e77","#087a67","#075d52","#111827","#374151","#6b7280","#000000"];'
if fonts not in controller:
    raise SystemExit("Could not find FONTS constant")
if 'const COLOR_PALETTE=' not in controller:
    controller = controller.replace(fonts, fonts + '\n' + palette, 1)

# Add color-picker state robustly regardless of how the long compressed state declaration is reconstructed.
if '[colorPicker,setColorPicker]' not in controller:
    saving_pattern = r'(\[saving\s*,\s*setSaving\]\s*=\s*useState\(false\))'
    controller, n = re.subn(
        saving_pattern,
        r'\1,[colorPicker,setColorPicker]=useState<{label:string;key:string;value:string}|null>(null)',
        controller,
        count=1,
    )
    if n != 1:
        marker = '  const ar=locale==="ar",t=(en:string,a:string)=>ar?a:en;\n'
        if marker not in controller:
            raise SystemExit("Could not find a safe insertion point for color picker state")
        controller = controller.replace(
            marker,
            marker + '  const [colorPicker,setColorPicker]=useState<{label:string;key:string;value:string}|null>(null);\n',
            1,
        )

old_color = '  const colorField=(label:string,key:string,value:string)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.colorRow}><View style={[styles.swatch,{backgroundColor:hex(value,"#ffffff")}]} /><TextInput value={value} onChangeText={v=>mutate({[key]:v})} autoCapitalize="none" style={styles.input}/></View></View>;'
new_color = '''  const colorField=(label:string,key:string,value:string)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.colorRow}><Pressable onPress={()=>setColorPicker({label,key,value})} style={[styles.swatch,{backgroundColor:hex(value,"#ffffff")}]}><Text style={{color:"#fff",fontWeight:"900",textAlign:"center"}}>◉</Text></Pressable><TextInput value={value} onChangeText={v=>mutate({[key]:v})} autoCapitalize="none" style={styles.input}/></View><Text style={styles.help}>Tap the color swatch to open the color picker.</Text><Modal visible={colorPicker?.key===key} transparent animationType="fade" onRequestClose={()=>setColorPicker(null)}><View style={{flex:1,backgroundColor:"rgba(0,0,0,.55)",justifyContent:"center",padding:22}}><View style={{backgroundColor:"#fff",borderRadius:24,padding:18,maxHeight:"82%"}}><Text style={[styles.title,{fontSize:22}]}>COLOR PICKER · {label}</Text><Text style={styles.help}>Choose a color below or mix your own with a HEX value.</Text><View style={{flexDirection:"row",flexWrap:"wrap",gap:10,marginVertical:16}}>{COLOR_PALETTE.map(c=><Pressable key={c} onPress={()=>{mutate({[key]:c});setColorPicker(null)}} style={{width:42,height:42,borderRadius:21,backgroundColor:c,borderWidth:2,borderColor:c.toLowerCase()===String(value||"").toLowerCase()?"#111":"#ddd"}} />)}</View><Text style={styles.fieldLabel}>CUSTOM / MIXED HEX COLOR</Text><TextInput defaultValue={value} autoCapitalize="none" placeholder="#12aa91" onEndEditing={e=>{const v=String(e.nativeEvent.text||"").trim();if(/^#[0-9a-f]{6}$/i.test(v)){mutate({[key]:v});setColorPicker(null)}}} style={styles.input}/><Pressable onPress={()=>setColorPicker(null)} style={[styles.step,{marginTop:14,alignSelf:"flex-end"}]}><Text style={styles.stepText}>CLOSE</Text></Pressable></View></View></Modal></View>;'''
if old_color not in controller:
    raise SystemExit("Could not find controller color field helper")
controller = controller.replace(old_color, new_color, 1)

for marker in ["COLOR PICKER", "COLOR_PALETTE", "Tap the color swatch", "CUSTOM / MIXED HEX COLOR", "colorPicker"]:
    if marker not in controller:
        raise SystemExit(f"Missing color picker marker: {marker}")
controller_path.write_text(controller, encoding="utf-8")

print("HASSOUN_TABLET_LIVE_THEME_V3 applied: full-width auto-fit local clock + live theme + color picker")

smart = Path(".github/scripts/fix-v1030-tablet-smart-editor.py")
if not smart.exists():
    raise SystemExit("Smart tablet editor patch is missing")
exec(compile(smart.read_text(encoding="utf-8"), str(smart), "exec"))
