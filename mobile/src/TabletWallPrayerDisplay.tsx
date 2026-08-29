import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import type { PrayerAlertPreferences } from "./alertPreferences";
import { formatPrayerTime } from "./time";
import { PRAYER_KEYS, type PrayerDay, type PrayerKey } from "./types";

type Locale = "en" | "ar";
type NextPrayer = { prayer: PrayerKey; time: string; secondsRemaining: number; isTomorrow: boolean };
type Props = {
  locale: Locale;
  now: Date;
  shortDate: string;
  hijriDate: string;
  locationLabel?: string;
  today?: PrayerDay;
  next: NextPrayer | null;
  preferences: PrayerAlertPreferences;
  onTogglePrayer: (prayer: PrayerKey) => void;
  onOpenQibla: () => void;
};

type TextTarget = "clock" | "location" | "date" | "arabic" | "english" | "prayerTime" | "countdown" | "adhan" | "bottomArabic" | "bottomEnglish" | "bottomTime";
type FontWeight = "400" | "500" | "600" | "700" | "800" | "900";
type TextAppearance = { color: string; fontFamily: string; fontSize: number; fontWeight: FontWeight };
type WallDisplaySettings = {
  backgroundPreset: string;
  customBackgroundUri: string;
  backgroundColor: string;
  patternColor: string;
  patternOpacity: number;
  cardColor: string;
  cardBorderColor: string;
  cardBorderWidth: number;
  cardRadius: number;
  bottomCardColor: string;
  bottomCardBorderColor: string;
  selectedBottomColor: string;
  selectedBottomBorderColor: string;
  clockShadowColor: string;
  clockShadowRadius: number;
  clockShadowDepth: number;
  autoSlide: boolean;
  slideSeconds: number;
  lockMinutes: number;
  transitionMs: number;
  showSeconds: boolean;
  showEnglish: boolean;
  showCountdown: boolean;
  showAdhanControl: boolean;
  showBottomCards: boolean;
  bottomCardHeight: number;
  text: Record<TextTarget, TextAppearance>;
};

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};
const GLYPHS: Record<PrayerKey, string> = { fajr: "◒", dhuhr: "☀", asr: "◐", maghrib: "◓", isha: "☾" };
const WALL_SETTINGS_KEY = "hassoun:tablet-wall-display:settings:v4";
const FONT_CHOICES = ["System", "sans-serif", "sans-serif-medium", "sans-serif-condensed", "serif", "monospace", "Noto Naskh Arabic", "Noto Kufi Arabic", "Noto Sans Arabic", "Traditional Arabic"];
const COLOR_SWATCHES = ["#FFFFFF", "#FFF9EB", "#F6E7B0", "#E8C767", "#C89932", "#0A5B48", "#07503F", "#03392F", "#102D27", "#171717", "#7A2D2D", "#315D89"];
const BACKGROUNDS = [
  { id: "ivory", name: "Ivory Masjid", base: "#F7F1E3", pattern: "#D3B15A" },
  { id: "pearl", name: "Pearl", base: "#FCF8EE", pattern: "#CDAF66" },
  { id: "dawn", name: "Warm Dawn", base: "#F5E5C5", pattern: "#B78C3A" },
  { id: "sage", name: "Soft Sage", base: "#E8EFE7", pattern: "#73927C" },
  { id: "emerald", name: "Emerald", base: "#0A4E3D", pattern: "#D9B85D" },
  { id: "night", name: "Night", base: "#10221E", pattern: "#BBA35B" }
];

const defaultText: Record<TextTarget, TextAppearance> = {
  clock: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 150, fontWeight: "900" },
  location: { color: "#0A493C", fontFamily: "sans-serif-medium", fontSize: 18, fontWeight: "800" },
  date: { color: "#0A493C", fontFamily: "sans-serif-medium", fontSize: 18, fontWeight: "800" },
  arabic: { color: "#F0CC72", fontFamily: "Noto Naskh Arabic", fontSize: 108, fontWeight: "900" },
  english: { color: "#F5D985", fontFamily: "sans-serif-medium", fontSize: 34, fontWeight: "800" },
  prayerTime: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 104, fontWeight: "900" },
  countdown: { color: "#F0CC72", fontFamily: "sans-serif-medium", fontSize: 30, fontWeight: "900" },
  adhan: { color: "#F6DB89", fontFamily: "sans-serif-medium", fontSize: 22, fontWeight: "800" },
  bottomArabic: { color: "#0A493C", fontFamily: "Noto Naskh Arabic", fontSize: 21, fontWeight: "900" },
  bottomEnglish: { color: "#0A493C", fontFamily: "sans-serif-medium", fontSize: 12, fontWeight: "700" },
  bottomTime: { color: "#0A493C", fontFamily: "sans-serif", fontSize: 19, fontWeight: "900" }
};

const DEFAULT_SETTINGS: WallDisplaySettings = {
  backgroundPreset: "ivory",
  customBackgroundUri: "",
  backgroundColor: "#F7F1E3",
  patternColor: "#D3B15A",
  patternOpacity: 0.16,
  cardColor: "#07503F",
  cardBorderColor: "#D9B65C",
  cardBorderWidth: 2,
  cardRadius: 36,
  bottomCardColor: "#FFFDF6",
  bottomCardBorderColor: "#0A5B48",
  selectedBottomColor: "#07503F",
  selectedBottomBorderColor: "#E8C767",
  clockShadowColor: "#8A651C",
  clockShadowRadius: 7,
  clockShadowDepth: 7,
  autoSlide: true,
  slideSeconds: 9,
  lockMinutes: 5,
  transitionMs: 520,
  showSeconds: false,
  showEnglish: true,
  showCountdown: true,
  showAdhanControl: true,
  showBottomCards: true,
  bottomCardHeight: 92,
  text: defaultText
};

function resolvedFont(fontFamily: string) { return fontFamily === "System" ? undefined : fontFamily; }
function validColor(value: string) { return /^#[0-9a-fA-F]{6}$/.test(value.trim()); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function remainingLabel(seconds: number, locale: Locale) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (safe < 3600) return locale === "ar" ? `${minutes} دقيقة` : `${Math.max(1, minutes)} minute${minutes === 1 ? "" : "s"} left`;
  return locale === "ar" ? `${hours} س ${minutes} د` : `${hours}h ${minutes}m left`;
}
function mergeSettings(raw: unknown): WallDisplaySettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const partial = raw as Partial<WallDisplaySettings>;
  return { ...DEFAULT_SETTINGS, ...partial, text: { ...DEFAULT_SETTINGS.text, ...(partial.text || {}) } };
}
function displayClock(now: Date, showSeconds: boolean) {
  let hour = now.getHours() % 12;
  if (hour === 0) hour = 12;
  const base = `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return showSeconds ? `${base}:${String(now.getSeconds()).padStart(2, "0")}` : base;
}
function Stepper({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <View style={styles.stepper}><Pressable onPress={() => onChange(clamp(value - step, min, max))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></Pressable><Text style={styles.stepValue}>{value}</Text><Pressable onPress={() => onChange(clamp(value + step, min, max))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></Pressable></View>;
}
function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <View style={styles.editorBlock}><Text style={styles.editorLabel}>{label}</Text><View style={styles.swatches}>{COLOR_SWATCHES.map((color) => <Pressable key={color} onPress={() => onChange(color)} style={[styles.swatch, { backgroundColor: color }, value.toUpperCase() === color && styles.swatchSelected]} />)}</View><View style={styles.hexRow}><TextInput value={draft} onChangeText={setDraft} onEndEditing={() => validColor(draft) ? onChange(draft.toUpperCase()) : setDraft(value)} style={styles.hexInput} autoCapitalize="characters" maxLength={7} /></View></View>;
}
function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return <View style={styles.toggleRow}><Text style={styles.toggleLabel}>{label}</Text><Switch value={value} onValueChange={onValueChange} /></View>;
}

export default function TabletWallPrayerDisplay({ locale, now, shortDate, locationLabel = "Current location", today, next, preferences, onTogglePrayer }: Props) {
  useKeepAwake("hassoun-tablet-wall-display");
  const [settings, setSettings] = useState<WallDisplaySettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<"presets" | "text" | "boxes" | "behavior">("presets");
  const [selectedTextTarget, setSelectedTextTarget] = useState<TextTarget>("clock");
  const transition = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void AsyncStorage.getItem(WALL_SETTINGS_KEY).then((saved) => {
      if (!saved) return;
      try { setSettings(mergeSettings(JSON.parse(saved))); } catch {}
    }).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (ready) void AsyncStorage.setItem(WALL_SETTINGS_KEY, JSON.stringify(settings)); }, [settings, ready]);

  const nextIndex = next && !next.isTomorrow ? PRAYER_KEYS.indexOf(next.prayer) : -1;
  const locked = nextIndex >= 0 && Boolean(next && next.secondsRemaining <= settings.lockMinutes * 60);
  const [visibleIndex, setVisibleIndex] = useState(nextIndex >= 0 ? nextIndex : 0);
  const previousIndex = useRef(visibleIndex);

  useEffect(() => { if (locked && nextIndex >= 0) setVisibleIndex(nextIndex); }, [locked, nextIndex]);
  useEffect(() => {
    if (locked || !settings.autoSlide || editorOpen) return;
    const id = setInterval(() => setVisibleIndex((current) => (current + 1) % PRAYER_KEYS.length), clamp(settings.slideSeconds, 3, 60) * 1000);
    return () => clearInterval(id);
  }, [locked, settings.autoSlide, settings.slideSeconds, editorOpen]);
  useEffect(() => {
    if (previousIndex.current === visibleIndex) return;
    previousIndex.current = visibleIndex;
    transition.setValue(0);
    Animated.timing(transition, { toValue: 1, duration: clamp(settings.transitionMs, 120, 1800), useNativeDriver: true }).start();
  }, [transition, visibleIndex, settings.transitionMs]);

  const prayer = PRAYER_KEYS[visibleIndex] ?? PRAYER_KEYS[0];
  const prayerTime = today?.[prayer] ?? (next?.prayer === prayer ? next.time : "");
  const isUpcoming = next?.prayer === prayer && !next.isTomorrow;
  const muted = !preferences[prayer].athan;
  const customBackground = Boolean(settings.customBackgroundUri);
  const clockText = useMemo(() => displayClock(now, settings.showSeconds), [now, settings.showSeconds]);

  const updateSettings = (patch: Partial<WallDisplaySettings>) => setSettings((current) => ({ ...current, ...patch }));
  const updateText = (target: TextTarget, patch: Partial<TextAppearance>) => setSettings((current) => ({ ...current, text: { ...current.text, [target]: { ...current.text[target], ...patch } } }));
  const choosePreset = (id: string) => { const preset = BACKGROUNDS.find((item) => item.id === id); if (preset) updateSettings({ backgroundPreset: id, customBackgroundUri: "", backgroundColor: preset.base, patternColor: preset.pattern }); };
  const pickBackground = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
      if (!result.canceled && result.assets[0]?.uri) updateSettings({ customBackgroundUri: result.assets[0].uri, backgroundPreset: "custom" });
    } catch (error) { console.warn("Wall background picker unavailable", error); }
  };
  const textStyle = (target: TextTarget) => ({ color: settings.text[target].color, fontFamily: resolvedFont(settings.text[target].fontFamily), fontSize: settings.text[target].fontSize, fontWeight: settings.text[target].fontWeight });

  const content = <View style={[styles.screen, { backgroundColor: customBackground ? "transparent" : settings.backgroundColor }]}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.mosqueGlow, { borderColor: settings.patternColor, opacity: settings.patternOpacity }]} />
      <Text style={[styles.patternLeft, { color: settings.patternColor, opacity: settings.patternOpacity }]}>│\n│\n♢\n│\n│</Text>
      <Text style={[styles.patternRight, { color: settings.patternColor, opacity: settings.patternOpacity }]}>│\n│\n♢\n│\n│</Text>
    </View>

    <View style={styles.metaRow}>
      <Text numberOfLines={1} style={[styles.metaItem, textStyle("location")]}>⌖  {locationLabel}</Text>
      <View style={styles.metaDivider} />
      <Text numberOfLines={1} style={[styles.metaItem, textStyle("date")]}>▣  {shortDate}</Text>
    </View>

    <Pressable onLongPress={() => setEditorOpen(true)} delayLongPress={650} style={styles.clockArea}>
      <View style={styles.clockStack}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.clock3d, textStyle("clock"), { color: settings.clockShadowColor, transform: [{ translateY: settings.clockShadowDepth }, { translateX: 2 }] }]}>{clockText}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.clockFace, textStyle("clock"), { textShadowColor: "#2D2218", textShadowRadius: settings.clockShadowRadius, textShadowOffset: { width: 0, height: 3 } }]}>{clockText}</Text>
      </View>
    </Pressable>

    <Animated.View style={[styles.mainCard, { backgroundColor: settings.cardColor, borderColor: settings.cardBorderColor, borderWidth: settings.cardBorderWidth, borderRadius: settings.cardRadius, opacity: transition, transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) }, { scale: transition.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
      <View style={styles.cardOrnamentTop}><View style={[styles.goldLine, { backgroundColor: settings.cardBorderColor }]} /><Text style={[styles.ornament, { color: settings.cardBorderColor }]}>◆</Text><View style={[styles.goldLine, { backgroundColor: settings.cardBorderColor }]} /></View>
      <View style={styles.nextPill}><Text style={styles.nextPillText}>{isUpcoming ? (locale === "ar" ? "الصلاة القادمة" : "NEXT PRAYER") : (locale === "ar" ? "الصلاة" : "PRAYER")}</Text></View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.prayerArabic, textStyle("arabic")]}>{NAMES[prayer].ar}</Text>
      {settings.showEnglish ? <Text style={[styles.prayerEnglish, textStyle("english")]}>{NAMES[prayer].en}</Text> : null}
      <View style={styles.cardDivider}><View style={[styles.dividerLine, { backgroundColor: settings.cardBorderColor }]} /><Text style={[styles.dividerStar, { color: settings.cardBorderColor }]}>۞</Text><View style={[styles.dividerLine, { backgroundColor: settings.cardBorderColor }]} /></View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.prayerTime, textStyle("prayerTime")]}>{prayerTime ? formatPrayerTime(prayerTime, locale) : "--:--"}</Text>
      {settings.showCountdown && isUpcoming && next ? <Text style={[styles.countdown, textStyle("countdown")]}>◷  {remainingLabel(next.secondsRemaining, locale)}</Text> : <View style={styles.countdownSpacer} />}
      {settings.showAdhanControl ? <Pressable onPress={() => onTogglePrayer(prayer)} style={[styles.adhanButton, { borderColor: settings.cardBorderColor }]}><Text style={[styles.adhanText, textStyle("adhan")]}>{muted ? "🔇  Adhan Off" : "🔊  Adhan On"}</Text></Pressable> : null}
      {locked ? <Text style={styles.lockedText}>{locale === "ar" ? "مثبت حتى وقت الصلاة" : `Locked on ${NAMES[prayer].en} until prayer time`}</Text> : null}
    </Animated.View>

    {settings.showBottomCards ? <View style={[styles.bottomStrip, { height: settings.bottomCardHeight }]}>{PRAYER_KEYS.map((key, index) => {
      const active = index === visibleIndex;
      const time = today?.[key] ?? "";
      return <Pressable key={key} onPress={() => setVisibleIndex(index)} style={[styles.bottomCard, { backgroundColor: active ? settings.selectedBottomColor : settings.bottomCardColor, borderColor: active ? settings.selectedBottomBorderColor : settings.bottomCardBorderColor }]}>
        <Text numberOfLines={1} style={[styles.bottomArabic, textStyle("bottomArabic"), active && styles.bottomActiveText]}>{NAMES[key].ar}</Text>
        <Text numberOfLines={1} style={[styles.bottomEnglish, textStyle("bottomEnglish"), active && styles.bottomActiveText]}>{NAMES[key].en}</Text>
        <Text style={[styles.bottomGlyph, active && styles.bottomActiveText]}>{GLYPHS[key]}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.bottomTime, textStyle("bottomTime"), active && styles.bottomActiveGold]}>{time ? formatPrayerTime(time, locale).replace(/\s?[ap]\.?m\.?/i, "") : "--:--"}</Text>
      </Pressable>;
    })}</View> : null}

    <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
      <View style={styles.modalShade}><View style={styles.editorSheet}>
        <View style={styles.editorHeader}><View><Text style={styles.editorTitle}>Wall Display Designer</Text><Text style={styles.editorHint}>Press and hold the large clock anytime to reopen.</Text></View><Pressable onPress={() => setEditorOpen(false)} style={styles.closeButton}><Text style={styles.closeButtonText}>Done</Text></Pressable></View>
        <View style={styles.editorTabs}>{(["presets", "text", "boxes", "behavior"] as const).map((tab) => <Pressable key={tab} onPress={() => setEditorTab(tab)} style={[styles.editorTab, editorTab === tab && styles.editorTabActive]}><Text style={[styles.editorTabText, editorTab === tab && styles.editorTabTextActive]}>{tab.toUpperCase()}</Text></Pressable>)}</View>
        <ScrollView contentContainerStyle={styles.editorContent}>
          {editorTab === "presets" ? <><Text style={styles.editorSection}>Background</Text><View style={styles.presetGrid}>{BACKGROUNDS.map((item) => <Pressable key={item.id} onPress={() => choosePreset(item.id)} style={[styles.presetCard, { backgroundColor: item.base, borderColor: settings.backgroundPreset === item.id ? "#0A5B48" : "#D8D2C4" }]}><Text style={{ color: item.base === "#0A4E3D" || item.base === "#10221E" ? "#FFF" : "#173F35", fontWeight: "800" }}>{item.name}</Text></Pressable>)}</View><Pressable onPress={() => void pickBackground()} style={styles.uploadButton}><Text style={styles.uploadButtonText}>Upload your own background</Text></Pressable><Stepper value={Math.round(settings.patternOpacity * 100)} min={0} max={40} step={5} onChange={(value) => updateSettings({ patternOpacity: value / 100 })} /></> : null}
          {editorTab === "text" ? <><Text style={styles.editorSection}>Choose text element</Text><View style={styles.targetGrid}>{(Object.keys(settings.text) as TextTarget[]).map((target) => <Pressable key={target} onPress={() => setSelectedTextTarget(target)} style={[styles.targetChip, selectedTextTarget === target && styles.targetChipActive]}><Text style={[styles.targetChipText, selectedTextTarget === target && styles.targetChipTextActive]}>{target}</Text></Pressable>)}</View><ColorControl label="Text color" value={settings.text[selectedTextTarget].color} onChange={(color) => updateText(selectedTextTarget, { color })} /><Text style={styles.editorLabel}>Font size</Text><Stepper value={settings.text[selectedTextTarget].fontSize} min={8} max={190} step={2} onChange={(fontSize) => updateText(selectedTextTarget, { fontSize })} /><Text style={styles.editorLabel}>Font</Text><View style={styles.fontGrid}>{FONT_CHOICES.map((font) => <Pressable key={font} onPress={() => updateText(selectedTextTarget, { fontFamily: font })} style={[styles.fontChip, settings.text[selectedTextTarget].fontFamily === font && styles.fontChipActive]}><Text style={styles.fontChipText}>{font}</Text></Pressable>)}</View></> : null}
          {editorTab === "boxes" ? <><ColorControl label="Main prayer card" value={settings.cardColor} onChange={(cardColor) => updateSettings({ cardColor })} /><ColorControl label="Main card border" value={settings.cardBorderColor} onChange={(cardBorderColor) => updateSettings({ cardBorderColor })} /><ColorControl label="Bottom cards" value={settings.bottomCardColor} onChange={(bottomCardColor) => updateSettings({ bottomCardColor })} /><ColorControl label="Selected bottom card" value={settings.selectedBottomColor} onChange={(selectedBottomColor) => updateSettings({ selectedBottomColor })} /><Text style={styles.editorLabel}>Bottom card height</Text><Stepper value={settings.bottomCardHeight} min={64} max={130} step={4} onChange={(bottomCardHeight) => updateSettings({ bottomCardHeight })} /><Text style={styles.editorLabel}>Clock 3D depth</Text><Stepper value={settings.clockShadowDepth} min={0} max={16} step={1} onChange={(clockShadowDepth) => updateSettings({ clockShadowDepth })} /></> : null}
          {editorTab === "behavior" ? <><ToggleRow label="Auto-slide prayers" value={settings.autoSlide} onValueChange={(autoSlide) => updateSettings({ autoSlide })} /><ToggleRow label="Show seconds on clock" value={settings.showSeconds} onValueChange={(showSeconds) => updateSettings({ showSeconds })} /><ToggleRow label="Show English prayer name" value={settings.showEnglish} onValueChange={(showEnglish) => updateSettings({ showEnglish })} /><ToggleRow label="Show countdown" value={settings.showCountdown} onValueChange={(showCountdown) => updateSettings({ showCountdown })} /><ToggleRow label="Show Adhan control" value={settings.showAdhanControl} onValueChange={(showAdhanControl) => updateSettings({ showAdhanControl })} /><ToggleRow label="Show bottom prayer strip" value={settings.showBottomCards} onValueChange={(showBottomCards) => updateSettings({ showBottomCards })} /><Text style={styles.editorLabel}>Seconds between slides</Text><Stepper value={settings.slideSeconds} min={3} max={60} step={1} onChange={(slideSeconds) => updateSettings({ slideSeconds })} /><Text style={styles.editorLabel}>Lock on next prayer (minutes)</Text><Stepper value={settings.lockMinutes} min={1} max={30} step={1} onChange={(lockMinutes) => updateSettings({ lockMinutes })} /></> : null}
          <Pressable onPress={() => setSettings(DEFAULT_SETTINGS)} style={styles.resetButton}><Text style={styles.resetButtonText}>Reset to approved Hassoun wall design</Text></Pressable>
        </ScrollView>
      </View></View>
    </Modal>
  </View>;

  if (customBackground) return <ImageBackground source={{ uri: settings.customBackgroundUri }} resizeMode="cover" style={styles.backgroundImage}><View style={styles.backgroundVeil} />{content}</ImageBackground>;
  return content;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 28, paddingTop: 8, paddingBottom: 12, overflow: "hidden" },
  backgroundImage: { flex: 1 }, backgroundVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,249,235,0.70)" },
  mosqueGlow: { position: "absolute", left: "10%", right: "10%", bottom: 96, height: 290, borderWidth: 2, borderRadius: 180 },
  patternLeft: { position: "absolute", left: 5, top: "32%", fontSize: 32, lineHeight: 48, textAlign: "center" },
  patternRight: { position: "absolute", right: 5, top: "32%", fontSize: 32, lineHeight: 48, textAlign: "center" },
  metaRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22, paddingHorizontal: 30 },
  metaItem: { flexShrink: 1, textAlign: "center" }, metaDivider: { width: 1, height: 28, backgroundColor: "#9AAEA5" },
  clockArea: { height: 168, justifyContent: "center", alignItems: "center", marginTop: -4 }, clockStack: { width: "100%", height: 160, justifyContent: "center", alignItems: "center" },
  clock3d: { position: "absolute", width: "100%", textAlign: "center", letterSpacing: -5 }, clockFace: { position: "absolute", width: "100%", textAlign: "center", letterSpacing: -5 },
  mainCard: { flex: 1, minHeight: 0, marginHorizontal: 46, marginTop: 6, marginBottom: 14, paddingHorizontal: 34, paddingVertical: 18, alignItems: "center", justifyContent: "space-evenly", shadowColor: "#3F3319", shadowOpacity: 0.24, shadowRadius: 15, shadowOffset: { width: 0, height: 9 }, elevation: 8 },
  cardOrnamentTop: { width: "62%", flexDirection: "row", alignItems: "center", gap: 10, marginBottom: -4 }, goldLine: { flex: 1, height: 1 }, ornament: { fontSize: 18 },
  nextPill: { borderWidth: 1, borderColor: "#D9B65C", borderRadius: 999, paddingHorizontal: 24, paddingVertical: 8 }, nextPillText: { color: "#F0CC72", fontWeight: "900", fontSize: 16, letterSpacing: 1.2 },
  prayerArabic: { width: "100%", textAlign: "center", lineHeight: 130, textShadowColor: "rgba(0,0,0,.36)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 5 } },
  prayerEnglish: { textAlign: "center", marginTop: -8 },
  cardDivider: { width: "74%", flexDirection: "row", alignItems: "center", gap: 12 }, dividerLine: { height: 1, flex: 1 }, dividerStar: { fontSize: 25 },
  prayerTime: { width: "100%", textAlign: "center", lineHeight: 118, textShadowColor: "rgba(0,0,0,.48)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 5 } },
  countdown: { textAlign: "center", marginTop: -6 }, countdownSpacer: { height: 32 },
  adhanButton: { minWidth: 220, minHeight: 54, borderWidth: 1, borderRadius: 999, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }, adhanText: { textAlign: "center" }, lockedText: { color: "#D7C88E", fontSize: 11, fontWeight: "700", marginTop: -2 },
  bottomStrip: { flexDirection: "row", gap: 9, marginHorizontal: 8 }, bottomCard: { flex: 1, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, paddingVertical: 5 },
  bottomArabic: { lineHeight: 27 }, bottomEnglish: { marginTop: -2 }, bottomGlyph: { color: "#B78D31", fontSize: 17, lineHeight: 19 }, bottomTime: { marginTop: -2 }, bottomActiveText: { color: "#F7E8B5" }, bottomActiveGold: { color: "#F0CC72" },
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,.38)", justifyContent: "flex-end" }, editorSheet: { height: "76%", backgroundColor: "#FFFDF7", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  editorHeader: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, editorTitle: { color: "#143F35", fontSize: 21, fontWeight: "900" }, editorHint: { color: "#79847E", fontSize: 11, marginTop: 3 }, closeButton: { backgroundColor: "#07503F", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }, closeButtonText: { color: "#FFF", fontWeight: "900" },
  editorTabs: { flexDirection: "row", paddingHorizontal: 14, gap: 6 }, editorTab: { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", backgroundColor: "#EEE9DE" }, editorTabActive: { backgroundColor: "#07503F" }, editorTabText: { color: "#66736D", fontWeight: "900", fontSize: 10 }, editorTabTextActive: { color: "#FFF" },
  editorContent: { padding: 18, paddingBottom: 42 }, editorSection: { color: "#143F35", fontSize: 17, fontWeight: "900", marginBottom: 10 }, presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, presetCard: { width: "31%", minHeight: 64, borderWidth: 2, borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 6 }, uploadButton: { marginTop: 12, borderRadius: 14, backgroundColor: "#EDE7D8", padding: 14, alignItems: "center" }, uploadButtonText: { color: "#143F35", fontWeight: "900" },
  editorBlock: { marginTop: 14 }, editorLabel: { color: "#344E47", fontSize: 12, fontWeight: "900", marginTop: 14, marginBottom: 8 }, swatches: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#CCC" }, swatchSelected: { borderWidth: 3, borderColor: "#0A5B48" }, hexRow: { flexDirection: "row", marginTop: 8 }, hexInput: { minWidth: 120, borderWidth: 1, borderColor: "#D7D1C5", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: "#143F35", backgroundColor: "#FFF" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 7 }, stepButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EAE5D9", alignItems: "center", justifyContent: "center" }, stepButtonText: { color: "#07503F", fontSize: 22, fontWeight: "900" }, stepValue: { minWidth: 52, textAlign: "center", color: "#143F35", fontWeight: "900" },
  targetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, targetChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "#EEE9DE" }, targetChipActive: { backgroundColor: "#07503F" }, targetChipText: { color: "#58665F", fontWeight: "800", fontSize: 11 }, targetChipTextActive: { color: "#FFF" },
  fontGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, fontChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#EEE9DE" }, fontChipActive: { backgroundColor: "#DCC784" }, fontChipText: { color: "#143F35", fontSize: 11, fontWeight: "700" },
  toggleRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E9E4D8" }, toggleLabel: { color: "#143F35", fontSize: 13, fontWeight: "800" },
  resetButton: { marginTop: 24, borderWidth: 1, borderColor: "#B99545", borderRadius: 14, padding: 14, alignItems: "center" }, resetButtonText: { color: "#7B5A16", fontWeight: "900" }
});
