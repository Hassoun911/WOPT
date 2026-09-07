from pathlib import Path
import re

page_path = Path("mobile/src/MasjidDisplayPage.tsx")
page = page_path.read_text(encoding="utf-8")

# --- Native tablet: local-time band, safe text fitting, live labels/icons ---
anchor = '  const prayerTimeFont = typeof remoteTheme.prayerTimeFont === "string" ? remoteTheme.prayerTimeFont : undefined;\n'
if anchor not in page:
    raise SystemExit("smart ux: live-theme anchor missing")
extra = '''  const displayClock = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "2-digit", minute: "2-digit", second: remoteTheme.showSeconds !== false ? "2-digit" : undefined, hour12: remoteTheme.showClockPeriod !== false }).format(now);\n  const prayerLabelText = typeof remoteTheme.prayerLabelText === "string" && remoteTheme.prayerLabelText.trim() ? remoteTheme.prayerLabelText.trim() : (isNext ? "NEXT PRAYER" : "PRAYER");\n  const prayerLabelEmoji = typeof remoteTheme.prayerLabelEmoji === "string" ? remoteTheme.prayerLabelEmoji.trim() : "";\n  const showPrayerLabel = remoteTheme.showPrayerLabel !== false;\n  const adhanText = typeof remoteTheme.adhanText === "string" && remoteTheme.adhanText.trim() ? remoteTheme.adhanText.trim() : "Adhan On";\n  const adhanEmoji = typeof remoteTheme.adhanEmoji === "string" && remoteTheme.adhanEmoji.trim() ? remoteTheme.adhanEmoji.trim() : "🔊";\n  const showAdhan = remoteTheme.showAdhan !== false;\n'''
if 'const displayClock =' not in page:
    page = page.replace(anchor, anchor + extra, 1)

# Force the upper local time to own the whole row and auto-fit rather than clip.
page = page.replace(
    '<Pressable onPress={() => setSetup(true)} style={[styles.clockButton,{width:"100%",alignSelf:"stretch",justifyContent:"center",overflow:"visible",paddingHorizontal:4}]}>',
    '<Pressable onPress={() => setSetup(true)} style={[styles.clockButton,{width:"100%",alignSelf:"stretch",justifyContent:"center",alignItems:"center",overflow:"hidden",paddingHorizontal:2,minHeight:Math.max(88,height*.105)}]}>',
    1,
)
clock_pattern = re.compile(r'<Text numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.2\} allowFontScaling=\{false\} style=\{\[styles\.clock, \{ width:"100%", textAlign:"center", fontSize: \(landscape \? 78 : 112\) \* clockScale, color: clockColor, fontFamily: clockFont \}\]\}>\{clock\}</Text>')
clock_repl = '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.12} allowFontScaling={false} style={[styles.clock, { width:"100%", maxWidth:"100%", textAlign:"center", alignSelf:"stretch", fontSize: Math.max(72,width*.19*clockScale), color: clockColor, fontFamily: clockFont, includeFontPadding:true, letterSpacing:-1 }]}>{displayClock}</Text>'
page, n = clock_pattern.subn(clock_repl, page, count=1)
if n != 1:
    # fallback for already-mutated clock source
    page = page.replace('>{clock}</Text>', '>{displayClock}</Text>', 1)

# Main gallery prayer text must never be cut off when the admin makes it large.
repls = [
    ('<Text style={[styles.arabic, { fontSize: (landscape ? 58 : 78) * arabicScale, color: arabicColor, fontFamily: arabicFont }]}>{current.ar}</Text>',
     '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.25} allowFontScaling={false} style={[styles.arabic, { width:"94%", alignSelf:"center", textAlign:"center", paddingVertical:8, includeFontPadding:true, fontSize: (landscape ? 58 : 78) * arabicScale, color: arabicColor, fontFamily: arabicFont }]}>{current.ar}</Text>'),
    ('<Text style={[styles.english, { fontSize: (landscape ? 42 : 54) * englishScale, color: englishColor, fontFamily: englishFont }]}>{current.en}</Text>',
     '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.25} allowFontScaling={false} style={[styles.english, { width:"94%", alignSelf:"center", textAlign:"center", paddingVertical:4, includeFontPadding:true, fontSize: (landscape ? 42 : 54) * englishScale, color: englishColor, fontFamily: englishFont }]}>{current.en}</Text>'),
    ('<View style={styles.timeRow}><Text style={[styles.prayerTime, { fontSize: (landscape ? 62 : 82) * prayerTimeScale, color: prayerTimeColor, fontFamily: prayerTimeFont }]}>{currentTime.main}</Text><Text style={[styles.prayerPeriod, { fontSize: 26 * prayerTimeScale, color: prayerTimeColor, fontFamily: prayerTimeFont }]}>{currentTime.period}</Text></View>',
     '<View style={[styles.timeRow,{width:"94%",alignSelf:"center"}]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.25} allowFontScaling={false} style={[styles.prayerTime, { flexShrink:1, fontSize: (landscape ? 62 : 82) * prayerTimeScale, color: prayerTimeColor, fontFamily: prayerTimeFont }]}>{currentTime.main}</Text><Text numberOfLines={1} style={[styles.prayerPeriod, { fontSize: 26 * prayerTimeScale, color: prayerTimeColor, fontFamily: prayerTimeFont }]}>{currentTime.period}</Text></View>'),
]
for old,new in repls:
    if old in page:
        page = page.replace(old,new,1)

# Live custom prayer label and Adhan badge from the paired admin.
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

# Per-prayer mini-card Islamic icon/emoji override.
mini_font_line = '            const miniFont = typeof remoteTheme[`${miniPrefix}font`] === "string" ? remoteTheme[`${miniPrefix}font`] : undefined;\n'
if mini_font_line in page and 'const miniEmoji =' not in page:
    page = page.replace(mini_font_line, mini_font_line + '            const miniEmoji = typeof remoteTheme[`${miniPrefix}emoji`] === "string" && remoteTheme[`${miniPrefix}emoji`].trim() ? remoteTheme[`${miniPrefix}emoji`].trim() : p.icon;\n', 1)
page = page.replace('>{p.icon}</Text>', '>{miniEmoji}</Text>', 1)

for marker in ['displayClock','prayerLabelEmoji','adhanEmoji','miniEmoji','adjustsFontSizeToFit','minHeight:Math.max(88,height*.105)']:
    if marker not in page:
        raise SystemExit(f"smart ux native marker missing: {marker}")
page_path.write_text(page, encoding="utf-8")

# --- Paired admin: obvious quick edit navigation + smart Islamic emoji palette ---
ctl_path = Path("mobile/src/ConnectDisplayPage.tsx")
ctl = ctl_path.read_text(encoding="utf-8")

fonts = 'const FONTS=["sans-serif","serif","monospace","sans-serif-condensed"];'
emojis = 'const ISLAMIC_EMOJIS=["🕌","☪️","🌙","🌙✨","🕋","📿","🤲","📖","✨","🌟","⭐","💫","🌅","🌄","🌇","🌆","🌌","☀️","🌤️","🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘","🧭","🔔","🔊","📢","🛐","🤍","💚","💛","🟢","🟡","💠","۞","◆","✦","☾","☽","ﷲ","ﷺ"];'
if 'const ISLAMIC_EMOJIS=' not in ctl:
    if fonts not in ctl:
        raise SystemExit("smart ux: FONTS constant missing")
    ctl = ctl.replace(fonts, fonts + '\n' + emojis, 1)

# Emoji picker helper: preset Islamic palette + custom field.
helper_anchor = '  const bool=(label:string,key:string,value:boolean)='
if helper_anchor not in ctl:
    raise SystemExit("smart ux: bool helper missing")
if 'const emojiField=' not in ctl:
    emoji_helper = '''  const emojiField=(label:string,key:string,value:string)=><View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.help}>Choose an Islamic icon/emoji or enter your own.</Text><View style={[styles.stepRow,{gap:8}]}>{ISLAMIC_EMOJIS.map(e=><Pressable key={`${key}-${e}`} onPress={()=>mutate({[key]:e})} style={[styles.step,{minWidth:48,paddingHorizontal:10},String(value||"")===e&&styles.stepOn]}><Text style={{fontSize:24}}>{e}</Text></Pressable>)}</View><View style={styles.colorRow}><TextInput value={String(value||"")} onChangeText={v=>mutate({[key]:v})} placeholder="Custom emoji / symbol" style={styles.input}/><Pressable onPress={()=>mutate({[key]:""})} style={styles.step}><Text style={styles.stepText}>CLEAR</Text></Pressable></View></View>;\n'''
    ctl = ctl.replace(helper_anchor, emoji_helper + helper_anchor, 1)

# Replace plain emoji inputs with the smart palette.
ctl = ctl.replace('<TextInput value={String(th.prayerLabelEmoji||"")} onChangeText={v=>mutate({prayerLabelEmoji:v})} placeholder="Optional emoji" style={styles.input}/>', '{emojiField("PRAYER LABEL ICON / EMOJI","prayerLabelEmoji",String(th.prayerLabelEmoji||""))}', 1)
ctl = ctl.replace('<TextInput value={String(th.adhanEmoji||"")} onChangeText={v=>mutate({adhanEmoji:v})} placeholder="Emoji" style={styles.input}/>', '{emojiField("ADHAN ICON / EMOJI","adhanEmoji",String(th.adhanEmoji||"🔊"))}', 1)

# Add emoji selection to each independently editable lower prayer card.
needle = '{fontField(`${pref}font`,String(th[`${pref}font`]||"sans-serif"))}{colorField("CARD COLOR 1"'
if needle in ctl and 'LOWER CARD ICON / EMOJI' not in ctl:
    ctl = ctl.replace(needle, '{fontField(`${pref}font`,String(th[`${pref}font`]||"sans-serif"))}{emojiField("LOWER CARD ICON / EMOJI",`${pref}emoji`,String(th[`${pref}emoji`]||""))}{colorField("CARD COLOR 1"', 1)

# Make all major edit sections discoverable without guessing what part of the preview to tap.
help_text = '<Text style={styles.help}>Tap any part of the preview. Every change is sent to the connected tablet/iPad automatically.</Text>'
quick = '''<Text style={styles.help}>Tap any part of the preview. Every change is sent to the connected tablet/iPad automatically.</Text><Text style={styles.fieldLabel}>SMART EDIT · CHOOSE WHAT TO CHANGE</Text><View style={styles.stepRow}>{[["page","🖼️ Background"],["clock","🕒 Local time"],["card","🕌 Main card"],["arabic","ﷲ Arabic"],["english","Aa English"],["time","⏰ Prayer time"],["adhan","🔊 Adhan"],["mini","🌙 Lower cards"]].map(([key,label])=><Pressable key={key} onPress={()=>setSelected(key as Part)} style={[styles.step,selected===key&&styles.stepOn]}><Text style={styles.stepText}>{label}</Text></Pressable>)}</View>'''
if help_text not in ctl:
    raise SystemExit("smart ux: editor help insertion point missing")
if 'SMART EDIT · CHOOSE WHAT TO CHANGE' not in ctl:
    ctl = ctl.replace(help_text, quick, 1)

for marker in ['ISLAMIC_EMOJIS','emojiField','SMART EDIT · CHOOSE WHAT TO CHANGE','🖼️ Background','🕒 Local time','🕌 Main card','LOWER CARD ICON / EMOJI']:
    if marker not in ctl:
        raise SystemExit(f"smart ux controller marker missing: {marker}")
ctl_path.write_text(ctl, encoding="utf-8")

print("HASSOUN_TABLET_SMART_UX_V2 applied: full-width local time + safe-fit prayer text + quick editor + Islamic emoji palette")
