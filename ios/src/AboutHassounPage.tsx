import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BrandMark from "./BrandMark";

type Locale = "en" | "ar";
type AboutConfig = {
  sadaqahTitleEn?: string; sadaqahTitleAr?: string;
  sadaqahBodyEn?: string; sadaqahBodyAr?: string;
  names?: string[];
  donationEnabled?: boolean; donationUrl?: string;
  donationTitleEn?: string; donationTitleAr?: string;
  donationBodyEn?: string; donationBodyAr?: string;
};

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const DEFAULTS: AboutConfig = {
  sadaqahTitleEn: "A continuing Sadaqah Jariyah",
  sadaqahTitleAr: "صدقة جارية مستمرة",
  sadaqahBodyEn: "Hassoun is built as a continuing charity dedicated to spreading beneficial Islamic knowledge, helping people protect their prayers, read Qur’an, learn and teach their families.",
  sadaqahBodyAr: "بُني Hassoun كصدقة جارية لنشر العلم الإسلامي النافع ومساعدة الناس على المحافظة على الصلاة وقراءة القرآن والتعلم وتعليم أسرهم.",
  names: ["Abdul Jalil Hassoun", "Salwa Hassoun"],
  donationEnabled: false,
  donationUrl: "",
  donationTitleEn: "Contribute to this Sadaqah Jariyah",
  donationTitleAr: "ساهم في هذه الصدقة الجارية",
  donationBodyEn: "Your contribution can help support hosting, development, Qur’an tools, prayer services and future educational features so the benefit can continue for more people.",
  donationBodyAr: "يمكن لمساهمتك أن تساعد في دعم الاستضافة والتطوير وأدوات القرآن وخدمات الصلاة والميزات التعليمية القادمة ليستمر النفع لعدد أكبر من الناس."
};

export default function AboutHassounPage({ locale, version, onBack }: { locale: Locale; version: string; onBack: () => void }) {
  const ar = locale === "ar"; const t=(en:string,arText:string)=>ar?arText:en;
  const [config,setConfig]=useState<AboutConfig>(DEFAULTS);
  useEffect(()=>{ void fetch(`${API}/app/runtime`).then(r=>r.ok?r.json():null).then((data:any)=>{const remote=data?.settings?.about_sadaqah; if(remote&&typeof remote==="object") setConfig({...DEFAULTS,...remote});}).catch(()=>undefined); },[]);
  const names=(config.names?.length?config.names:DEFAULTS.names)!;
  const donate=()=>{const url=String(config.donationUrl||"").trim(); if(config.donationEnabled&&/^https:\/\//i.test(url)) void Linking.openURL(url);};
  const donationReady=Boolean(config.donationEnabled&&/^https:\/\//i.test(String(config.donationUrl||"")));
  return <ScrollView style={s.flex} contentContainerStyle={s.screen} showsVerticalScrollIndicator={false}>
    <View style={s.header}><Pressable onPress={onBack} style={s.back}><Text style={s.backText}>‹</Text></Pressable><Text style={s.headerTitle}>{t("About Hassoun","حول Hassoun")}</Text></View>
    <View style={s.hero}><BrandMark size={92}/><Text style={s.brand}>Hassoun</Text><Text style={s.tag}>{t("Prayer • Qur’an • Knowledge","الصلاة • القرآن • المعرفة")}</Text><View style={s.version}><Text style={s.versionText}>v{version}</Text></View></View>

    <View style={s.card}><Text style={s.cardTitle}>{t("🌿 Our purpose","🌿 هدفنا")}</Text><Text style={[s.body,ar&&s.rtl]}>{t("Hassoun brings prayer times, Adhan, Qur’an reading and listening, memorization tools, Islamic events, learning and family-friendly Islamic games into one calm experience.","يجمع Hassoun مواقيت الصلاة والأذان وقراءة القرآن والاستماع إليه وأدوات الحفظ والمناسبات الإسلامية والتعلم والألعاب الإسلامية العائلية في تجربة واضحة وهادئة.")}</Text></View>

    <View style={[s.card,s.sadaqah]}><Text style={s.sadaqahEmoji}>🤲</Text><Text style={[s.sadaqahTitle,ar&&s.rtl]}>{ar?(config.sadaqahTitleAr||DEFAULTS.sadaqahTitleAr):(config.sadaqahTitleEn||DEFAULTS.sadaqahTitleEn)}</Text><Text style={[s.sadaqahBody,ar&&s.rtl]}>{ar?(config.sadaqahBodyAr||DEFAULTS.sadaqahBodyAr):(config.sadaqahBodyEn||DEFAULTS.sadaqahBodyEn)}</Text><View style={s.dedication}><Text style={s.dedicationLabel}>{t("DEDICATED AS SADAQAH JARIYAH FOR","صدقة جارية عن")}</Text>{names.map(name=><Text key={name} style={s.name}>• {name}</Text>)}</View><Text style={[s.dua,ar&&s.rtl]}>{t("May Allah accept it, place barakah in every beneficial use, and make every prayer reminder, ayah read, lesson learned and good deed encouraged a continuing reward. Ameen.","نسأل الله أن يتقبلها ويبارك في كل نفع منها وأن يجعل كل تذكير بالصلاة وكل آية تُقرأ وكل علم يُتعلم وكل خير يُشجَّع عليه أجراً مستمراً. آمين.")}</Text></View>

    <View style={[s.card,s.donation]}><Text style={s.cardTitle}>{ar?(config.donationTitleAr||DEFAULTS.donationTitleAr):(config.donationTitleEn||DEFAULTS.donationTitleEn)} 💚</Text><Text style={[s.body,ar&&s.rtl]}>{ar?(config.donationBodyAr||DEFAULTS.donationBodyAr):(config.donationBodyEn||DEFAULTS.donationBodyEn)}</Text><View style={s.supportGrid}><View style={s.supportChip}><Text style={s.supportEmoji}>☁️</Text><Text style={s.supportText}>{t("Hosting","الاستضافة")}</Text></View><View style={s.supportChip}><Text style={s.supportEmoji}>📖</Text><Text style={s.supportText}>{t("Qur’an tools","أدوات القرآن")}</Text></View><View style={s.supportChip}><Text style={s.supportEmoji}>🕌</Text><Text style={s.supportText}>{t("Prayer services","خدمات الصلاة")}</Text></View><View style={s.supportChip}><Text style={s.supportEmoji}>🎓</Text><Text style={s.supportText}>{t("Learning","التعلم")}</Text></View></View>
      <Pressable onPress={donate} disabled={!donationReady} style={[s.donateButton,!donationReady&&s.donateDisabled]}><Text style={s.donateText}>{donationReady?t("🤲 Donate / Contribute","🤲 تبرع / ساهم"):t("🤲 Donation link coming soon","🤲 رابط التبرع قريباً")}</Text></Pressable>
      <Text style={s.small}>{t("Donations are voluntary and should only be made through the verified link shown inside Hassoun.","التبرعات اختيارية ويجب أن تتم فقط من خلال الرابط الموثق الظاهر داخل Hassoun.")}</Text>
    </View>

    <View style={s.card}><Text style={s.cardTitle}>{t("📚 Sources & trust","📚 المصادر والموثوقية")}</Text><Text style={[s.body,ar&&s.rtl]}>{t("Windsor prayer times use the trusted Windsor schedule. Qur’an text and recitation features use verified Qur’anic data and recognized public Qur’an services where indicated. Other locations use location-based prayer calculation.","تستخدم مواقيت وندسور الجدول الموثوق. تستخدم ميزات القرآن بيانات قرآنية موثقة وخدمات قرآن عامة معروفة حيث يشار إليها. تستخدم المواقع الأخرى حساب الصلاة حسب الموقع.")}</Text></View>
    <View style={s.footer}><BrandMark size={32}/><Text style={s.footerText}>{t("Built to benefit people, families and future generations.","بُني لينفع الناس والأسر والأجيال القادمة.")}</Text></View>
  </ScrollView>;
}

const s=StyleSheet.create({flex:{flex:1,backgroundColor:"#f7f4ec"},screen:{paddingHorizontal:18,paddingTop:14,paddingBottom:48},header:{flexDirection:"row",alignItems:"center",gap:12},back:{width:42,height:42,borderRadius:14,backgroundColor:"#fff",borderWidth:1,borderColor:"#dedbd2",alignItems:"center",justifyContent:"center"},backText:{fontSize:30,lineHeight:32,color:"#0b654f"},headerTitle:{fontSize:21,fontWeight:"900",color:"#173f35"},hero:{alignItems:"center",paddingVertical:25},brand:{fontSize:30,fontWeight:"900",color:"#173f35",marginTop:8},tag:{fontSize:11,fontWeight:"800",letterSpacing:1,color:"#a07e42",marginTop:4},version:{marginTop:10,backgroundColor:"#dfeee8",paddingHorizontal:12,paddingVertical:5,borderRadius:99},versionText:{color:"#23634f",fontSize:10,fontWeight:"900"},card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e1ddd4",borderRadius:22,padding:16,marginBottom:11},cardTitle:{color:"#173f35",fontSize:17,fontWeight:"900",marginBottom:8},body:{color:"#687a73",fontSize:12,lineHeight:19},sadaqah:{backgroundColor:"#075a46",borderColor:"#2a7a66",alignItems:"center",padding:19},sadaqahEmoji:{fontSize:35},sadaqahTitle:{color:"#f2d986",fontSize:20,fontWeight:"900",textAlign:"center",marginTop:8},sadaqahBody:{color:"#d7e6e0",fontSize:12,lineHeight:19,textAlign:"center",marginTop:8},dedication:{alignSelf:"stretch",marginTop:15,borderRadius:17,backgroundColor:"rgba(255,255,255,.09)",padding:14},dedicationLabel:{color:"#f2d986",fontSize:9,fontWeight:"900",letterSpacing:1,textAlign:"center",marginBottom:8},name:{color:"#fff",fontSize:16,fontWeight:"900",textAlign:"center",marginTop:4},dua:{color:"#c8ddd5",fontSize:11,lineHeight:17,textAlign:"center",marginTop:13,fontStyle:"italic"},donation:{borderColor:"#d7bb69",backgroundColor:"#fffaf0"},supportGrid:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:12},supportChip:{flexBasis:"47%",flexGrow:1,backgroundColor:"#fff",borderWidth:1,borderColor:"#eadfbd",borderRadius:14,padding:9,flexDirection:"row",gap:7,alignItems:"center"},supportEmoji:{fontSize:17},supportText:{color:"#5d654f",fontSize:10,fontWeight:"800"},donateButton:{marginTop:14,borderRadius:15,backgroundColor:"#0b654f",paddingVertical:13,alignItems:"center"},donateDisabled:{backgroundColor:"#8b9b95"},donateText:{color:"#fff",fontSize:13,fontWeight:"900"},small:{color:"#8d8169",fontSize:9.5,lineHeight:14,textAlign:"center",marginTop:8},footer:{marginTop:4,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"center"},footerText:{color:"#75857e",fontSize:10,fontWeight:"700"},rtl:{textAlign:"right",writingDirection:"rtl"}});