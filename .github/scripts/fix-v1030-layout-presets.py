from pathlib import Path
import re

ctl_path = Path("mobile/src/ConnectDisplayPage.tsx")
page_path = Path("mobile/src/MasjidDisplayPage.tsx")
ctl = ctl_path.read_text(encoding="utf-8")
page = page_path.read_text(encoding="utf-8")

# ---------- Admin: one-tap layout ideas ----------
if 'const LAYOUT_PRESETS=' not in ctl:
    anchor = 'const hex=(v:any,f:string)=>'
    if anchor not in ctl:
        raise SystemExit('layout presets: hex helper anchor missing')
    presets = r'''const LAYOUT_PRESETS=[
  {id:"classic",name:"Clean & Classic",emoji:"🕌",desc:"Bright, elegant and easy to read.",patch:{backgroundMode:"color",pageGradientA:"#fbfaf6",pageGradientB:"#f3f0e8",clockColor:"#075d52",clockOutline:"#e0b761",cardGradientA:"#fffdf7",cardGradientB:"#f8f3e8",cardBorder:"#e0b761",arabicColor:"#075d52",englishColor:"#075d52",prayerTimeColor:"#075d52",miniGradientA:"#fffdf7",miniGradientB:"#f5f0e6",miniTextColor:"#075d52",miniNextA:"#0c6c5d",miniNextB:"#075449",miniNextText:"#ffffff"}},
  {id:"dark",name:"Dark Premium",emoji:"🌙",desc:"Black, gold and premium.",patch:{backgroundMode:"color",pageGradientA:"#090b0b",pageGradientB:"#17110b",clockColor:"#f4cb77",clockOutline:"#b27b33",cardGradientA:"#090909",cardGradientB:"#15110a",cardBorder:"#e0b761",arabicColor:"#f4cb77",englishColor:"#f4cb77",prayerTimeColor:"#f4cb77",miniGradientA:"#111111",miniGradientB:"#191919",miniTextColor:"#f8f3e8",miniNextA:"#d5a93b",miniNextB:"#9b6e16",miniNextText:"#111111"}},
  {id:"image",name:"Background Image",emoji:"🖼️",desc:"Use your own mosque/photo URL.",patch:{backgroundMode:"image",pageGradientA:"#123f46",pageGradientB:"#081f24",cardGradientA:"#0b3a3acc",cardGradientB:"#082f34cc",cardBorder:"#f4cb77",clockColor:"#ffffff",arabicColor:"#ffffff",englishColor:"#ffffff",prayerTimeColor:"#ffffff"}},
  {id:"video",name:"Video Background",emoji:"🎞️",desc:"Loop a silent video behind the display.",patch:{backgroundMode:"video",pageGradientA:"#0c2f3a",pageGradientB:"#071a20",cardGradientA:"#072d35cc",cardGradientB:"#061f26cc",cardBorder:"#e0b761",clockColor:"#ffffff",arabicColor:"#f4cb77",englishColor:"#ffffff",prayerTimeColor:"#ffffff"}},
  {id:"gradient",name:"Gradient Modern",emoji:"🌈",desc:"Clean, colorful and modern.",patch:{backgroundMode:"color",pageGradientA:"#10bfa7",pageGradientB:"#135fe8",clockColor:"#ffffff",clockOutline:"#ffffff",cardGradientA:"#0c8fa8",cardGradientB:"#0b70c9",cardBorder:"#bfe8ff",arabicColor:"#ffffff",englishColor:"#ffffff",prayerTimeColor:"#ffffff",miniGradientA:"#d9f0ff",miniGradientB:"#b8ddff",miniTextColor:"#10344a",miniNextA:"#0b70c9",miniNextB:"#0758a6",miniNextText:"#ffffff"}},
  {id:"minimal",name:"Minimal White",emoji:"🤍",desc:"Bright and distraction-free.",patch:{backgroundMode:"color",pageGradientA:"#ffffff",pageGradientB:"#f7f7f2",clockColor:"#0d6b4f",clockOutline:"#d9d2c6",cardGradientA:"#ffffff",cardGradientB:"#fafaf7",cardBorder:"#d9d2c6",arabicColor:"#0d6b4f",englishColor:"#0d6b4f",prayerTimeColor:"#0d6b4f",miniGradientA:"#ffffff",miniGradientB:"#f5f5f1",miniTextColor:"#233732",miniNextA:"#0d6b4f",miniNextB:"#075449",miniNextText:"#ffffff"}},
  {id:"night",name:"Night Mode",emoji:"🌌",desc:"Perfect for dark environments.",patch:{backgroundMode:"color",pageGradientA:"#061326",pageGradientB:"#0a1832",clockColor:"#f4f6ff",clockOutline:"#334c7c",cardGradientA:"#0b1f3a",cardGradientB:"#0c2746",cardBorder:"#5576b2",arabicColor:"#ffffff",englishColor:"#ffffff",prayerTimeColor:"#ffffff",miniGradientA:"#102642",miniGradientB:"#0a1d34",miniTextColor:"#e8efff",miniNextA:"#173d66",miniNextB:"#0d2c4f",miniNextText:"#ffffff"}},
  {id:"largeclock",name:"Large Clock Focus",emoji:"🕒",desc:"Make local time the visual focus.",patch:{backgroundMode:"color",pageGradientA:"#fbfaf6",pageGradientB:"#f3f0e8",clockColor:"#111111",clockSize:3.5,clockBandScale:2.2,cardGradientA:"#fffdf7",cardGradientB:"#f8f3e8",cardBorder:"#e0b761",arabicColor:"#111111",englishColor:"#111111",prayerTimeColor:"#111111",lowerCardScale:.8}},
  {id:"compact",name:"Compact Bottom Bar",emoji:"🌙",desc:"Small lower cards, more gallery room.",patch:{lowerCardScale:.62,mainCardScale:1.25,clockBandScale:1,miniGradientA:"#092f35",miniGradientB:"#061f25",miniTextColor:"#ffffff",miniNextA:"#0d8e77",miniNextB:"#087a67",miniNextText:"#ffffff"}},
  {id:"message",name:"Custom Message",emoji:"📖",desc:"Show your own quote, reminder or masjid message.",patch:{showCustomMessage:true,customMessage:"Indeed, prayer prevents immorality and wrongdoing.",customMessageColor:"#f8f3e8",customMessageSize:1,customMessageFont:"serif",backgroundMode:"color",pageGradientA:"#21180e",pageGradientB:"#4a2f11",cardGradientA:"#3b280f",cardGradientB:"#21180e",cardBorder:"#e0b761",clockColor:"#f8f3e8",arabicColor:"#f4cb77",englishColor:"#f4cb77",prayerTimeColor:"#f8f3e8"}}
];
'''
    ctl = ctl.replace(anchor, presets + anchor, 1)

# Add preset application helper without replacing user URLs unless preset explicitly supplies them.
if 'const applyLayoutPreset=' not in ctl:
    anchor = '  const remove=async(id:string)=>'
    if anchor not in ctl:
        raise SystemExit('layout presets: remove helper anchor missing')
    helper = '''  const applyLayoutPreset=(preset:any)=>setRemote(cur=>{if(!cur)return cur;const current=theme(cur.settings);const patch={...preset.patch};if(preset.id==="image"&&!current.backgroundImageUrl)patch.backgroundImageUrl="";if(preset.id==="video"&&!current.backgroundVideoUrl)patch.backgroundVideoUrl="";const th={...current,...patch,layoutPreset:preset.id};const next={...cur,settings:{...cur.settings,displayMode:"tablet",tabletTheme:th}};if(saveTimer.current)clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>void send(next),120);return next});\n'''
    ctl = ctl.replace(anchor, helper + anchor, 1)

# Add layout idea cards under the smart edit selector.
if 'LAYOUT IDEAS · ONE TAP' not in ctl:
    marker = '<Text style={styles.fieldLabel}>SMART EDIT · CHOOSE WHAT TO CHANGE</Text>'
    pos = ctl.find(marker)
    if pos == -1:
        raise SystemExit('layout presets: smart edit marker missing')
    # Insert before preview block so it is always discoverable.
    insertion = '''<Text style={styles.fieldLabel}>LAYOUT IDEAS · ONE TAP</Text><Text style={styles.help}>Start from a layout, then customize every part. Presets never lock the editor.</Text><View style={{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:14}}>{LAYOUT_PRESETS.map(p=><Pressable key={p.id} onPress={()=>applyLayoutPreset(p)} style={[styles.step,{width:"48%",minHeight:78,alignItems:"flex-start",justifyContent:"center"},String(th.layoutPreset||"")===p.id&&styles.stepOn]}><Text style={{fontSize:24}}>{p.emoji}</Text><Text style={[styles.stepText,{fontSize:14}]}>{p.name}</Text><Text style={[styles.help,{fontSize:11,marginTop:2}]}>{p.desc}</Text></Pressable>)}</View>'''
    ctl = ctl[:pos] + insertion + ctl[pos:]

# Make custom message/logo controls part of the main card editor.
if 'CUSTOM MESSAGE / QUOTE' not in ctl:
    card_case = 'case"card":return <>'
    if card_case not in ctl:
        raise SystemExit('layout presets: main card case missing')
    add = '''case"card":return <><Text style={styles.fieldLabel}>CUSTOM MESSAGE / QUOTE</Text>{bool("Show custom message","showCustomMessage",th.showCustomMessage===true)}<TextInput value={String(th.customMessage||"")} onChangeText={v=>mutate({customMessage:v})} multiline placeholder="Masjid message, ayah, reminder or quote" style={[styles.input,{minHeight:74,textAlignVertical:"top"}]}/>{colorField("MESSAGE COLOR","customMessageColor",String(th.customMessageColor||"#ffffff"))}{sizeField("MESSAGE SIZE","customMessageSize",Number(th.customMessageSize)||1)}{fontField("customMessageFont",String(th.customMessageFont||"serif"))}<Text style={styles.fieldLabel}>OPTIONAL LOGO / IMAGE URL</Text><TextInput value={String(th.customLogoUrl||"")} onChangeText={v=>mutate({customLogoUrl:v})} placeholder="https://.../logo.png" autoCapitalize="none" style={styles.input}/>'''
    ctl = ctl.replace(card_case, add, 1)

# ---------- Native display: render optional custom message + logo inside the gallery ----------
anchor = '  const showAdhan = remoteTheme.showAdhan !== false;\n'
if anchor not in page:
    raise SystemExit('layout presets native: showAdhan anchor missing')
if 'const showCustomMessage =' not in page:
    extra = '''  const showCustomMessage = remoteTheme.showCustomMessage === true;\n  const customMessage = typeof remoteTheme.customMessage === "string" ? remoteTheme.customMessage.trim() : "";\n  const customMessageColor = themeHex(remoteTheme.customMessageColor, CLASSIC.white);\n  const customMessageScale = clampTextScale(remoteTheme.customMessageSize);\n  const customMessageFont = typeof remoteTheme.customMessageFont === "string" ? remoteTheme.customMessageFont : undefined;\n  const customLogoUrl = typeof remoteTheme.customLogoUrl === "string" ? remoteTheme.customLogoUrl.trim() : "";\n'''
    page = page.replace(anchor, anchor + extra, 1)

# Put custom content between prayer time/countdown and Adhan, shrinking/fitting inside the card.
if 'showCustomMessage && customMessage' not in page:
    adhan_marker = '{showAdhan ? <View style={styles.adhan}><Text style={styles.adhanText}>{adhanEmoji} {adhanText}</Text></View> : null}'
    if adhan_marker not in page:
        raise SystemExit('layout presets native: adhan render marker missing')
    custom = '''{customLogoUrl ? <Image source={{uri:customLogoUrl}} style={{width:72,height:72,resizeMode:"contain",alignSelf:"center",marginVertical:4}} /> : null}{showCustomMessage && customMessage ? <Text numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.01} allowFontScaling={false} style={{width:"92%",maxHeight:"24%",alignSelf:"center",textAlign:"center",color:customMessageColor,fontFamily:customMessageFont,fontSize:24*customMessageScale,flexShrink:1,paddingHorizontal:8}}>{customMessage}</Text> : null}'''
    page = page.replace(adhan_marker, custom + adhan_marker, 1)

for marker in ['LAYOUT_PRESETS','LAYOUT IDEAS · ONE TAP','Clean & Classic','Dark Premium','Background Image','Video Background','Gradient Modern','Minimal White','Night Mode','Large Clock Focus','Compact Bottom Bar','Custom Message','CUSTOM MESSAGE / QUOTE']:
    if marker not in ctl:
        raise SystemExit(f'layout presets control missing: {marker}')
for marker in ['showCustomMessage','customMessage','customLogoUrl']:
    if marker not in page:
        raise SystemExit(f'layout presets native missing: {marker}')

ctl_path.write_text(ctl, encoding='utf-8')
page_path.write_text(page, encoding='utf-8')
print('HASSOUN_TABLET_LAYOUT_PRESETS_V1 applied: 10 one-tap customizable layouts + custom message/logo')
