from pathlib import Path
import re

page_path = Path("mobile/src/MasjidDisplayPage.tsx")
page = page_path.read_text(encoding="utf-8")

# --- Remove artificial size limits. Positive values are accepted with no upper cap. ---
page = page.replace(
    '  const clampScale = (value: any, fallback = 1) => { const n = Number(value); return Number.isFinite(n) ? Math.max(.8, Math.min(1.1, n)) : fallback; };',
    '  const clampScale = (value: any, fallback = 1) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; };',
    1,
)
page = page.replace(
    '  const clampTextScale = (value: any, fallback = 1) => { const n = Number(value); return Number.isFinite(n) ? Math.max(.5, Math.min(4, n)) : fallback; };',
    '  const clampTextScale = (value: any, fallback = 1) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; };',
    1,
)
page = re.sub(r'const mainCardWidthScale = Math\.max\(\.5, Math\.min\(1, Number\(remoteTheme\.mainCardWidthScale\) \|\| 1\)\);', 'const mainCardWidthScale = Number(remoteTheme.mainCardWidthScale) > 0 ? Number(remoteTheme.mainCardWidthScale) : 1;', page, count=1)
page = re.sub(r'const mainCardHeightScale = Math\.max\(\.5, Math\.min\(1\.6, Number\(remoteTheme\.mainCardHeightScale\) \|\| 1\)\);', 'const mainCardHeightScale = Number(remoteTheme.mainCardHeightScale) > 0 ? Number(remoteTheme.mainCardHeightScale) : 1;', page, count=1)
page = page.replace('const miniWidth = Math.max(.55, Math.min(1.7, Number(remoteTheme[`${miniPrefix}width`]) || 1));', 'const miniWidth = Number(remoteTheme[`${miniPrefix}width`]) > 0 ? Number(remoteTheme[`${miniPrefix}width`]) : 1;', 1)
page = page.replace('const miniHeight = Math.max(.55, Math.min(1.7, Number(remoteTheme[`${miniPrefix}height`]) || 1));', 'const miniHeight = Number(remoteTheme[`${miniPrefix}height`]) > 0 ? Number(remoteTheme[`${miniPrefix}height`]) : 1;', 1)

anchor = '  const prayerTimeFont = typeof remoteTheme.prayerTimeFont === "string" ? remoteTheme.prayerTimeFont : undefined;\n'
if anchor not in page:
    raise SystemExit("smart ux: live-theme anchor missing")
extra = '''  const displayClock = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "2-digit", minute: "2-digit", second: remoteTheme.showSeconds !== false ? "2-digit" : undefined, hour12: remoteTheme.showClockPeriod !== false }).format(now);\n  const prayerLabelText = typeof remoteTheme.prayerLabelText === "string" && remoteTheme.prayerLabelText.trim() ? remoteTheme.prayerLabelText.trim() : (isNext ? "NEXT PRAYER" : "PRAYER");\n  const prayerLabelEmoji = typeof remoteTheme.prayerLabelEmoji === "string" ? remoteTheme.prayerLabelEmoji.trim() : "";\n  const showPrayerLabel = remoteTheme.showPrayerLabel !== false;\n  const adhanText = typeof remoteTheme.adhanText === "string" && remoteTheme.adhanText.trim() ? remoteTheme.adhanText.trim() : "Adhan On";\n  const adhanEmoji = typeof remoteTheme.adhanEmoji === "string" && remoteTheme.adhanEmoji.trim() ? remoteTheme.adhanEmoji.trim() : "🔊";\n  const showAdhan = remoteTheme.showAdhan !== false;\n  const requestedClockBand = Math.max(1, Number(remoteTheme.clockBandScale) || clockScale);\n  const requestedMiniBand = Math.max(1, Number(remoteTheme.lowerCardScale) || 1);\n  const clockBandHeight = Math.max(78, Math.round(height * .09 * requestedClockBand));\n  const miniBandHeight = Math.max(76, Math.round(104 * requestedMiniBand));\n  const fixedReserve = Math.round(height * .045) + clockBandHeight + miniBandHeight;\n  const heroAvailableHeight = Math.max(160, height - fixedReserve);\n'''
if 'const displayClock =' not in page:
    page = page.replace(anchor, anchor + extra, 1)

# Clock gets the space the admin requests; main gallery yields space automatically.
page = page.replace(
    '<Pressable onPress={() => setSetup(true)} style={[styles.clockButton,{width:"100%",alignSelf:"stretch",justifyContent:"center",overflow:"visible",paddingHorizontal:4}]}>',
    '<Pressable onPress={() => setSetup(true)} style={[styles.clockButton,{width:"100%",alignSelf:"stretch",justifyContent:"center",alignItems:"center",overflow:"hidden",paddingHorizontal:2,height:clockBandHeight,flexShrink:0}]}>',
    1,
)
clock_pattern = re.compile(r'<Text numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.2\} allowFontScaling=\{false\} style=\{\[styles\.clock, \{ width:"100%", textAlign:"center", fontSize: \(landscape \? 78 : 112\) \* clockScale, color: clockColor, fontFamily: clockFont \}\]\}>\{clock\}</Text>')
clock_repl = '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.01} allowFontScaling={false} style={[styles.clock, { width:"100%", maxWidth:"100%", height:"100%", textAlign:"center", textAlignVertical:"center", alignSelf:"stretch", fontSize: Math.max(72,width*.19*clockScale), color: clockColor, fontFamily: clockFont, includeFontPadding:true, letterSpacing:-1 }]}>{displayClock}</Text>'
page, n = clock_pattern.subn(clock_repl, page, count=1)
if n != 1:
    page = page.replace('>{clock}</Text>', '>{displayClock}</Text>', 1)

# Main gallery always consumes the remaining available height after top/bottom controls claim space.
hero_pattern = re.compile(r'<LinearGradient colors=\{\[cardA, cardB\]\} style=\{\[styles\.hero, \{ borderColor: cardBorder, width: `\$\{Math\.round\(mainCardWidthScale \* 100\)\}%`, alignSelf: "center" \}, fitFullScreen \? \{ flex: 1 \} : \{ flex: 0, height: Math\.round\(mainCardHeight \* mainCardHeightScale\) \}\]\}>')
hero_repl = '<LinearGradient colors={[cardA, cardB]} style={[styles.hero, { borderColor: cardBorder, width: `${Math.min(100,Math.max(1,Math.round(mainCardWidthScale*100)))}%`, alignSelf:"center", flexShrink:1, minHeight:140 }, fitFullScreen ? { flex:1, maxHeight:heroAvailableHeight } : { flex:0, height:Math.min(heroAvailableHeight,Math.max(140,Math.round(mainCardHeight*mainCardHeightScale))) }]}> '
page, n = hero_pattern.subn(hero_repl, page, count=1)
if n != 1:
    page = page.replace(
        '<LinearGradient colors={[cardA, cardB]} style={[styles.hero, { borderColor: cardBorder, width: `${Math.round(mainCardWidthScale * 100)}%`, alignSelf: "center" }, fitFullScreen ? { flex: 1 } : { flex: 0, height: Math.round(mainCardHeight * mainCardHeightScale) }]}>',
        hero_repl,
        1,
    )

# Main prayer text can be any requested size, but must stay inside the gallery card.
repls = [
    ('<Text style={[styles.arabic, { fontSize: (landscape ? 58 : 78) * arabicScale, color: arabicColor, fontFamily: arabicFont }]}>{current.ar}</Text>',
     '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.01} allowFontScaling={false} style={[styles.arabic, { width:"96%", maxHeight:"28%", alignSelf:"center", textAlign:"center", paddingVertical:6, includeFontPadding:true, fontSize:(landscape?58:78)*arabicScale, color:arabicColor, fontFamily:arabicFont, flexShrink:1 }]}>{current.ar}</Text>'),
    ('<Text style={[styles.english, { fontSize: (landscape ? 42 : 54) * englishScale, color: englishColor, fontFamily: englishFont }]}>{current.en}</Text>',
     '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.01} allowFontScaling={false} style={[styles.english, { width:"96%", maxHeight:"22%", alignSelf:"center", textAlign:"center", paddingVertical:3, includeFontPadding:true, fontSize:(landscape?42:54)*englishScale, color:englishColor, fontFamily:englishFont, flexShrink:1 }]}>{current.en}</Text>'),
    ('<View style={styles.timeRow}><Text style={[styles.prayerTime, { fontSize: (landscape ? 62 : 82) * prayerTimeScale, color: prayerTimeColor, fontFamily: prayerTimeFont }]}>{currentTime.main}</Text><Text style={[styles.prayerPeriod, { fontSize: 26 * prayerTimeScale, color: prayerTimeColor, fontFamily: prayerTimeFont }]}>{currentTime.period}</Text></View>',
     '<View style={[styles.timeRow,{width:"96%",maxHeight:"24%",alignSelf:"center",flexShrink:1}]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.01} allowFontScaling={false} style={[styles.prayerTime,{flexShrink:1,fontSize:(landscape?62:82)*prayerTimeScale,color:prayerTimeColor,fontFamily:prayerTimeFont}]}>{currentTime.main}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.01} allowFontScaling={false} style={[styles.prayerPeriod,{flexShrink:1,fontSize:26*prayerTimeScale,color:prayerTimeColor,fontFamily:prayerTimeFont}]}>{currentTime.period}</Text></View>'),
]
for old,new in repls:
    if old in page:
        page = page.replace(old,new,1)

# Bottom cards claim their requested height; the gallery shrinks above them automatically.
page = page.replace('<View style={[styles.miniRow, { height: lowerCardHeight }]}>', '<View style={[styles.miniRow,{height:miniBandHeight,flexShrink:0,alignItems:"stretch"}]}>', 1)
page = page.replace('height: Math.round(lowerCardHeight * miniHeight)', 'height: "100%"', 1)

page = page.replace(
    '<View style={styles.prayerPill}><Text style={styles.pillText}>{isNext ? "NEXT PRAYER" : "PRAYER"}</Text></View>',
    '{showPrayerLabel ? <View style={styles.prayerPill}><Text style={styles.pillText}>{prayerLabelEmoji ? `${prayerLabelEmoji} ` : ""}{prayerLabelText}</Text></View> : null}',
    1,
)
page = page.replace(
    '<View style={styles.adhan}><Text style={styles.adhanText}>🔊 Adhan On</Text></View>',
    '{showAdhan ? <View style={styles.adhan}><Text style={styles.adhanText}>{adhanEmoji} {adhanText}</Text></View> : null}',
    1,
)

mini_font_line = '            const miniFont = typeof remoteTheme[`${miniPrefix}font`] === "string" ? remoteTheme[`${miniPrefix}font`] : undefined;\n'
if mini_font_line in page and 'const miniEmoji =' not in page:
    page = page.replace(mini_font_line, mini_font_line + '            const miniEmoji = typeof remoteTheme[`${miniPrefix}emoji`] === "string" && remoteTheme[`${miniPrefix}emoji`].trim() ? remoteTheme[`${miniPrefix}emoji`].trim() : p.icon;\n', 1)
page = page.replace('>{p.icon}</Text>', '>{miniEmoji}</Text>', 1)

for marker in ['clockBandHeight','miniBandHeight','heroAvailableHeight','displayClock','miniEmoji','minimumFontScale={0.01}']:
    if marker not in page:
        raise SystemExit(f"smart ux native marker missing: {marker}")
page_path.write_text(page, encoding="utf-8")

# --- Paired admin: unlimited positive sizing + quick editor + Islamic emoji palette ---
ctl_path = Path("mobile/src/ConnectDisplayPage.tsx")
ctl = ctl_path.read_text(encoding="utf-8")

# Replace size helpers with unlimited positive percentage inputs.
size_start = ctl.find('  const sizeField=')
font_start = ctl.find('  const fontField=')
if size_start == -1 or font_start == -1 or font_start <= size_start:
    raise SystemExit("smart ux: size/font helpers missing")
unlimited_helpers = '''  const sizeField=(label:string,key:string,value:number)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.stepRow}>{[0.5,0.75,1,1.5,2,3,5,10].map(n=><Pressable key={n} onPress={()=>mutate({[key]:n})} style={[styles.step,Math.abs(Number(value)-n)<.001&&styles.stepOn]}><Text style={styles.stepText}>{Math.round(n*100)}%</Text></Pressable>)}</View><View style={styles.colorRow}><TextInput key={`${key}-${value}`} defaultValue={String(Math.round((Number(value)||1)*100))} keyboardType="decimal-pad" returnKeyType="done" onEndEditing={e=>{const pct=Number(String(e.nativeEvent.text||"").replace(/[^0-9.]/g,""));if(Number.isFinite(pct)&&pct>0)mutate({[key]:pct/100})}} style={styles.input}/><Text style={styles.fieldLabel}>%</Text></View><Text style={styles.help}>No maximum. Enter any positive percentage. The display will reflow other sections to make room.</Text></View>;
  const cardSizeField=(label:string,key:string,value:number)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.stepRow}>{[0.5,0.75,1,1.5,2,3,5,10].map(n=><Pressable key={n} onPress={()=>mutate({[key]:n})} style={[styles.step,Math.abs(Number(value)-n)<.001&&styles.stepOn]}><Text style={styles.stepText}>{Math.round(n*100)}%</Text></Pressable>)}</View><View style={styles.colorRow}><TextInput key={`${key}-${value}`} defaultValue={String(Math.round((Number(value)||1)*100))} keyboardType="decimal-pad" returnKeyType="done" onEndEditing={e=>{const pct=Number(String(e.nativeEvent.text||"").replace(/[^0-9.]/g,""));if(Number.isFinite(pct)&&pct>0)mutate({[key]:pct/100})}} style={styles.input}/><Text style={styles.fieldLabel}>%</Text></View><Text style={styles.help}>No maximum. The gallery and other sections automatically adjust around it.</Text></View>;
  const percentField=(label:string,key:string,value:number,min=1,max=0)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.stepRow}>{[0.5,0.75,1,1.5,2,3,5,10].map(n=><Pressable key={n} onPress={()=>mutate({[key]:n})} style={[styles.step,Math.abs(Number(value)-n)<.001&&styles.stepOn]}><Text style={styles.stepText}>{Math.round(n*100)}%</Text></Pressable>)}</View><View style={styles.colorRow}><TextInput key={`${key}-${value}`} defaultValue={String(Math.round((Number(value)||1)*100))} keyboardType="decimal-pad" returnKeyType="done" onEndEditing={e=>{const pct=Number(String(e.nativeEvent.text||"").replace(/[^0-9.]/g,""));if(Number.isFinite(pct)&&pct>0)mutate({[key]:pct/100})}} style={styles.input}/><Text style={styles.fieldLabel}>%</Text></View><Text style={styles.help}>No maximum. Enter any positive percentage.</Text></View>;
'''
ctl = ctl[:size_start] + unlimited_helpers + ctl[font_start:]

fonts = 'const FONTS=["sans-serif","serif","monospace","sans-serif-condensed"];'
emojis = 'const ISLAMIC_EMOJIS=["🕌","☪️","🌙","🌙✨","🕋","📿","🤲","📖","✨","🌟","⭐","💫","🌅","🌄","🌇","🌆","🌌","☀️","🌤️","🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘","🧭","🔔","🔊","📢","🛐","🤍","💚","💛","🟢","🟡","💠","۞","◆","✦","☾","☽","ﷲ","ﷺ"];'
if 'const ISLAMIC_EMOJIS=' not in ctl:
    if fonts not in ctl:
        raise SystemExit("smart ux: FONTS constant missing")
    ctl = ctl.replace(fonts, fonts + '\n' + emojis, 1)

helper_anchor = '  const bool=(label:string,key:string,value:boolean)='
if helper_anchor not in ctl:
    raise SystemExit("smart ux: bool helper missing")
if 'const emojiField=' not in ctl:
    emoji_helper = '''  const emojiField=(label:string,key:string,value:string)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.help}>Choose an Islamic icon/emoji or enter your own.</Text><View style={[styles.stepRow,{gap:8}]}>{ISLAMIC_EMOJIS.map(e=><Pressable key={`${key}-${e}`} onPress={()=>mutate({[key]:e})} style={[styles.step,{minWidth:48,paddingHorizontal:10},String(value||"")===e&&styles.stepOn]}><Text style={{fontSize:24}}>{e}</Text></Pressable>)}</View><View style={styles.colorRow}><TextInput value={String(value||"")} onChangeText={v=>mutate({[key]:v})} placeholder="Custom emoji / symbol" style={styles.input}/><Pressable onPress={()=>mutate({[key]:""})} style={styles.step}><Text style={styles.stepText}>CLEAR</Text></Pressable></View></View>;\n'''
    ctl = ctl.replace(helper_anchor, emoji_helper + helper_anchor, 1)

ctl = ctl.replace('<TextInput value={String(th.prayerLabelEmoji||"")} onChangeText={v=>mutate({prayerLabelEmoji:v})} placeholder="Optional emoji" style={styles.input}/>', '{emojiField("PRAYER LABEL ICON / EMOJI","prayerLabelEmoji",String(th.prayerLabelEmoji||""))}', 1)
ctl = ctl.replace('<TextInput value={String(th.adhanEmoji||"")} onChangeText={v=>mutate({adhanEmoji:v})} placeholder="Emoji" style={styles.input}/>', '{emojiField("ADHAN ICON / EMOJI","adhanEmoji",String(th.adhanEmoji||"🔊"))}', 1)
needle = '{fontField(`${pref}font`,String(th[`${pref}font`]||"sans-serif"))}{colorField("CARD COLOR 1"'
if needle in ctl and 'LOWER CARD ICON / EMOJI' not in ctl:
    ctl = ctl.replace(needle, '{fontField(`${pref}font`,String(th[`${pref}font`]||"sans-serif"))}{emojiField("LOWER CARD ICON / EMOJI",`${pref}emoji`,String(th[`${pref}emoji`]||""))}{colorField("CARD COLOR 1"', 1)

help_text = '<Text style={styles.help}>Tap any part of the preview. Every change is sent to the connected tablet/iPad automatically.</Text>'
quick = '''<Text style={styles.help}>Tap any part of the preview. Every change is sent to the connected tablet/iPad automatically.</Text><Text style={styles.fieldLabel}>SMART EDIT · CHOOSE WHAT TO CHANGE</Text><View style={styles.stepRow}>{[["page","🖼️ Background"],["clock","🕒 Local time"],["card","🕌 Main card"],["arabic","ﷲ Arabic"],["english","Aa English"],["time","⏰ Prayer time"],["adhan","🔊 Adhan"],["mini","🌙 Lower cards"]].map(([key,label])=><Pressable key={key} onPress={()=>setSelected(key as Part)} style={[styles.step,selected===key&&styles.stepOn]}><Text style={styles.stepText}>{label}</Text></Pressable>)}</View>'''
if help_text not in ctl:
    raise SystemExit("smart ux: editor help insertion point missing")
if 'SMART EDIT · CHOOSE WHAT TO CHANGE' not in ctl:
    ctl = ctl.replace(help_text, quick, 1)

for marker in ['ISLAMIC_EMOJIS','emojiField','SMART EDIT · CHOOSE WHAT TO CHANGE','No maximum.','🖼️ Background','🕒 Local time','🕌 Main card']:
    if marker not in ctl:
        raise SystemExit(f"smart ux controller marker missing: {marker}")
ctl_path.write_text(ctl, encoding="utf-8")

print("HASSOUN_TABLET_SMART_UX_V4 applied: unlimited admin sizing + dynamic vertical reflow + safe-fit gallery text + Islamic emoji palette")
