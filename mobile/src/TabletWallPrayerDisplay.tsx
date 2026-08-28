import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
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
  dividerColor: string;
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
  fajr: { en: "Fajr", ar: "الفجر" }, dhuhr: { en: "Dhuhr", ar: "الظهر" }, asr: { en: "Asr", ar: "العصر" }, maghrib: { en: "Maghrib", ar: "المغرب" }, isha: { en: "Isha", ar: "العشاء" }
};
const GLYPHS: Record<PrayerKey, string> = { fajr: "◒", dhuhr: "☀", asr: "◐", maghrib: "◓", isha: "☾" };
const WALL_SETTINGS_KEY = "hassoun:tablet-wall-display:settings:v3";
const FONT_CHOICES = ["System", "sans-serif", "sans-serif-medium", "sans-serif-condensed", "serif", "monospace", "Noto Naskh Arabic", "Noto Kufi Arabic", "Noto Sans Arabic", "Droid Arabic Naskh", "Droid Arabic Kufi", "Traditional Arabic", "Arial"];
const COLOR_SWATCHES = ["#FFFFFF", "#FFF9EB", "#F8E5A0", "#E9C765", "#C99A32", "#0A5B48", "#063D33", "#032A24", "#122D28", "#17211F", "#111111", "#742D2D", "#735F9C", "#1F5B84"];
const BACKGROUNDS = [
  { id: "cream", name: "Ivory Masjid", base: "#F7F1E2", pattern: "#D5B45C" },
  { id: "warm", name: "Warm Dawn", base: "#F4E5C5", pattern: "#B88A35" },
  { id: "white", name: "Clean White", base: "#FCFBF6", pattern: "#D0BC83" },
  { id: "sage", name: "Soft Sage", base: "#E7EFE8", pattern: "#6C907B" },
  { id: "emerald", name: "Emerald", base: "#0B4C3D", pattern: "#D8BA62" },
  { id: "midnight", name: "Night Prayer", base: "#0D211D", pattern: "#B9A15D" }
];
const defaultText: Record<TextTarget, TextAppearance> = {
  clock: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 126, fontWeight: "900" },
  location: { color: "#0A4A3C", fontFamily: "sans-serif-medium", fontSize: 18, fontWeight: "800" },
  date: { color: "#0A4A3C", fontFamily: "sans-serif-medium", fontSize: 18, fontWeight: "800" },
  arabic: { color: "#E9C765", fontFamily: "Noto Naskh Arabic", fontSize: 94, fontWeight: "900" },
  english: { color: "#F8E5A0", fontFamily: "sans-serif-medium", fontSize: 34, fontWeight: "800" },
  prayerTime: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 88, fontWeight: "900" },
  countdown: { color: "#E9C765", fontFamily: "sans-serif-medium", fontSize: 34, fontWeight: "900" },
  adhan: { color: "#F8E5A0", fontFamily: "sans-serif-medium", fontSize: 20, fontWeight: "800" },
  bottomArabic: { color: "#0A4A3C", fontFamily: "Noto Naskh Arabic", fontSize: 22, fontWeight: "900" },
  bottomEnglish: { color: "#0A4A3C", fontFamily: "sans-serif-medium", fontSize: 12, fontWeight: "700" },
  bottomTime: { color: "#0A4A3C", fontFamily: "sans-serif", fontSize: 19, fontWeight: "900" }
};
const DEFAULT_SETTINGS: WallDisplaySettings = {
  backgroundPreset: "cream", customBackgroundUri: "", backgroundColor: "#F7F1E2", patternColor: "#D5B45C", patternOpacity: 0.12,
  cardColor: "#07503F", cardBorderColor: "#D7B45E", cardBorderWidth: 2, cardRadius: 34, dividerColor: "#D7B45E",
  bottomCardColor: "#FFFDF6", bottomCardBorderColor: "#0A5B48", selectedBottomColor: "#07503F", selectedBottomBorderColor: "#E9C765",
  clockShadowColor: "#8B661B", clockShadowRadius: 7, clockShadowDepth: 5,
  autoSlide: true, slideSeconds: 9, lockMinutes: 5, transitionMs: 520, showSeconds: false, showEnglish: true, showCountdown: true, showAdhanControl: true, showBottomCards: true, bottomCardHeight: 78,
  text: defaultText
};

function resolvedFont(fontFamily: string) { return fontFamily === "System" ? undefined : fontFamily; }
function validColor(value: string) { return /^#[0-9a-fA-F]{6}$/.test(value.trim()); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function remainingLabel(seconds: number, locale: Locale) {
  const safe = Math.max(0, Math.floor(seconds)); const hours = Math.floor(safe / 3600); const minutes = Math.floor((safe % 3600) / 60); const secs = safe % 60;
  if (safe < 3600) return locale === "ar" ? `${minutes}:${String(secs).padStart(2, "0")}` : `${minutes} min ${String(secs).padStart(2, "0")} sec`;
  return locale === "ar" ? `${hours} س ${minutes} د` : `${hours}h ${minutes}m`;
}
function mergeSettings(raw: unknown): WallDisplaySettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const partial = raw as Partial<WallDisplaySettings>;
  return { ...DEFAULT_SETTINGS, ...partial, text: { ...DEFAULT_SETTINGS.text, ...(partial.text || {}) } };
}
function PatternBackground({ color, opacity }: { color: string; opacity: number }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Text style={[styles.patternTop, { color, opacity }]}>☾   ۞   ◇   ۞   ☾</Text><Text style={[styles.patternMid, { color, opacity: opacity * 0.7 }]}>۞   ◇   ۞   ◇   ۞</Text><Text style={[styles.patternBottom, { color, opacity }]}>◇   ☾   ۞   ☾   ◇</Text></View>;
}
function Stepper({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <View style={styles.stepper}><Pressable onPress={() => onChange(clamp(value - step, min, max))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></Pressable><Text style={styles.stepValue}>{value}</Text><Pressable onPress={() => onChange(clamp(value + step, min, max))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></Pressable></View>;
}
function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState(value); useEffect(() => setDraft(value), [value]);
  return <View style={styles.editorField}><Text style={styles.editorLabel}>{label}</Text><View style={styles.swatches}>{COLOR_SWATCHES.map((color) => <Pressable key={color} onPress={() => onChange(color)} style={[styles.swatch, { backgroundColor: color }, value.toUpperCase() === color && styles.swatchSelected]} />)}</View><View style={styles.hexRow}><View style={[styles.colorPreview, { backgroundColor: validColor(value) ? value : "#FFFFFF" }]} /><TextInput value={draft} onChangeText={setDraft} onEndEditing={() => { if (validColor(draft)) onChange(draft.toUpperCase()); else setDraft(value); }} autoCapitalize="characters" maxLength={7} style={styles.hexInput} placeholder="#FFFFFF" placeholderTextColor="#777" /></View></View>;
}
function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return <View style={styles.toggleRow}><Text style={styles.toggleLabel}>{label}</Text><Switch value={value} onValueChange={onValueChange} /></View>;
}

export default function TabletWallPrayerDisplay({ locale, now, shortDate, locationLabel = "Current location", today, next, preferences, onTogglePrayer }: Props) {
  useKeepAwake("hassoun-tablet-wall-display");
  const [settings, setSettings] = useState<WallDisplaySettings>(DEFAULT_SETTINGS);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<"presets" | "text" | "boxes" | "behavior">("presets");
  const [selectedTextTarget, setSelectedTextTarget] = useState<TextTarget>("clock");
  const [settingsReady, setSettingsReady] = useState(false);
  const transition = useRef(new Animated.Value(1)).current;

  useEffect(() => { void AsyncStorage.getItem(WALL_SETTINGS_KEY).then((saved) => { if (!saved) return; try { setSettings(mergeSettings(JSON.parse(saved))); } catch {} }).finally(() => setSettingsReady(true)); }, []);
  useEffect(() => { if (settingsReady) void AsyncStorage.setItem(WALL_SETTINGS_KEY, JSON.stringify(settings)); }, [settings, settingsReady]);

  const lockSeconds = settings.lockMinutes * 60;
  const nextIndex = next && !next.isTomorrow ? PRAYER_KEYS.indexOf(next.prayer) : -1;
  const sliderLocked = nextIndex >= 0 && next !== null && next.secondsRemaining <= lockSeconds;
  const [visibleIndex, setVisibleIndex] = useState(nextIndex >= 0 ? nextIndex : 0);
  const previousIndex = useRef(visibleIndex);

  useEffect(() => { if (sliderLocked && nextIndex >= 0) setVisibleIndex(nextIndex); }, [sliderLocked, nextIndex]);
  useEffect(() => { if (sliderLocked || !settings.autoSlide || editorOpen) return; const id = setInterval(() => setVisibleIndex((current) => (current + 1) % PRAYER_KEYS.length), clamp(settings.slideSeconds, 3, 60) * 1000); return () => clearInterval(id); }, [sliderLocked, settings.autoSlide, settings.slideSeconds, editorOpen]);
  useEffect(() => { if (previousIndex.current === visibleIndex) return; previousIndex.current = visibleIndex; transition.setValue(0); Animated.timing(transition, { toValue: 1, duration: clamp(settings.transitionMs, 120, 1800), useNativeDriver: true }).start(); }, [transition, visibleIndex, settings.transitionMs]);

  const localTime = useMemo(() => new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { hour: "2-digit", minute: "2-digit", second: settings.showSeconds ? "2-digit" : undefined, hour12: false }).format(now), [locale, now, settings.showSeconds]);
  const prayer = PRAYER_KEYS[visibleIndex] ?? PRAYER_KEYS[0];
  const prayerTime = today?.[prayer] ?? (next?.prayer === prayer ? next.time : "");
  const isUpcoming = next?.prayer === prayer && !next.isTomorrow;
  const muted = !preferences[prayer].athan;
  const customBackground = Boolean(settings.customBackgroundUri);

  const updateSettings = (patch: Partial<WallDisplaySettings>) => setSettings((current) => ({ ...current, ...patch }));
  const updateText = (target: TextTarget, patch: Partial<TextAppearance>) => setSettings((current) => ({ ...current, text: { ...current.text, [target]: { ...current.text[target], ...patch } } }));
  const choosePreset = (id: string) => { const choice = BACKGROUNDS.find((item) => item.id === id); if (choice) updateSettings({ backgroundPreset: id, customBackgroundUri: "", backgroundColor: choice.base, patternColor: choice.pattern }); };
  const pickBackground = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 0.9 }); if (!result.canceled && result.assets[0]?.uri) updateSettings({ customBackgroundUri: result.assets[0].uri, backgroundPreset: "custom" }); };

  const screenContent = <View style={[styles.screen, { backgroundColor: customBackground ? "transparent" : settings.backgroundColor }]}>
    {!customBackground ? <PatternBackground color={settings.patternColor} opacity={settings.patternOpacity} /> : null}
    <View style={styles.metaRow}>
      <Text numberOfLines={1} style={[styles.metaText, { color: settings.text.location.color, fontFamily: resolvedFont(settings.text.location.fontFamily), fontSize: settings.text.location.fontSize, fontWeight: settings.text.location.fontWeight }]}>📍 {locationLabel}</Text>
      <Text numberOfLines={1} style={[styles.metaText, { color: settings.text.date.color, fontFamily: resolvedFont(settings.text.date.fontFamily), fontSize: settings.text.date.fontSize, fontWeight: settings.text.date.fontWeight }]}>🗓 {shortDate}</Text>
    </View>
    <Pressable onLongPress={() => setEditorOpen(true)} delayLongPress={650} accessibilityRole="button" accessibilityHint="Press and hold to customize the wall display" style={styles.clockArea}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.clock, { color: settings.text.clock.color, fontFamily: resolvedFont(settings.text.clock.fontFamily), fontSize: settings.text.clock.fontSize, fontWeight: settings.text.clock.fontWeight, textShadowColor: settings.clockShadowColor, textShadowRadius: settings.clockShadowRadius, textShadowOffset: { width: settings.clockShadowDepth, height: settings.clockShadowDepth } }]}>{localTime}</Text>
    </Pressable>
    <View style={[styles.divider, { backgroundColor: settings.dividerColor }]} />
    <View style={styles.galleryArea}>
      <Animated.View style={[styles.cardWrap, { opacity: transition, transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
        <View style={[styles.prayerCard, { backgroundColor: settings.cardColor, borderColor: settings.cardBorderColor, borderWidth: settings.cardBorderWidth, borderRadius: settings.cardRadius }]}>
          {isUpcoming ? <View style={[styles.nextPill, { borderColor: settings.dividerColor }]}><Text style={[styles.nextPillText, { color: settings.text.countdown.color }]}>NEXT PRAYER</Text></View> : null}
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.arabicName, { color: settings.text.arabic.color, fontFamily: resolvedFont(settings.text.arabic.fontFamily), fontSize: settings.text.arabic.fontSize, fontWeight: settings.text.arabic.fontWeight }]}>{NAMES[prayer].ar}</Text>
          {settings.showEnglish ? <Text style={{ color: settings.text.english.color, fontFamily: resolvedFont(settings.text.english.fontFamily), fontSize: settings.text.english.fontSize, fontWeight: settings.text.english.fontWeight, textAlign: "center" }}>{NAMES[prayer].en}</Text> : null}
          <View style={[styles.cardRule, { backgroundColor: settings.dividerColor }]} />
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.prayerTime, { color: settings.text.prayerTime.color, fontFamily: resolvedFont(settings.text.prayerTime.fontFamily), fontSize: settings.text.prayerTime.fontSize, fontWeight: settings.text.prayerTime.fontWeight }]}>{prayerTime ? formatPrayerTime(prayerTime, locale).replace(/\s*[ap]\.m\.?/gi, "") : "—"}</Text>
          {settings.showCountdown && isUpcoming && next ? <Text style={{ color: settings.text.countdown.color, fontFamily: resolvedFont(settings.text.countdown.fontFamily), fontSize: settings.text.countdown.fontSize, fontWeight: settings.text.countdown.fontWeight, textAlign: "center", marginTop: 8 }}>◷ {remainingLabel(next.secondsRemaining, locale)} left</Text> : null}
          {settings.showAdhanControl ? <Pressable onPress={() => onTogglePrayer(prayer)} style={({ pressed }) => [styles.adhanControl, { borderColor: settings.cardBorderColor }, muted && styles.muted, pressed && styles.pressed]} accessibilityRole="button"><Text style={{ color: settings.text.adhan.color, fontFamily: resolvedFont(settings.text.adhan.fontFamily), fontSize: settings.text.adhan.fontSize, fontWeight: settings.text.adhan.fontWeight }}>{muted ? "🔇 Adhan Off" : "🔊 Adhan On"}</Text></Pressable> : null}
          {sliderLocked && isUpcoming ? <Text style={[styles.lockMessage, { color: settings.text.countdown.color }]}>● Auto-slide paused • prayer is under {settings.lockMinutes} min away</Text> : null}
        </View>
      </Animated.View>
      {settings.showBottomCards ? <View style={styles.prayerTabs}>{PRAYER_KEYS.map((key, index) => {
        const selected = index === visibleIndex; const time = today?.[key] || ""; const backgroundColor = selected ? settings.selectedBottomColor : settings.bottomCardColor; const borderColor = selected ? settings.selectedBottomBorderColor : settings.bottomCardBorderColor; const selectedTextColor = selected ? "#FFFFFF" : undefined;
        return <Pressable key={key} onPress={() => setVisibleIndex(index)} style={({ pressed }) => [styles.prayerTab, { minHeight: settings.bottomCardHeight, backgroundColor, borderColor }, pressed && styles.pressed]}>
          <Text style={[styles.tabGlyph, { color: selected ? settings.text.countdown.color : settings.text.bottomArabic.color }]}>{GLYPHS[key]}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: selectedTextColor || settings.text.bottomArabic.color, fontFamily: resolvedFont(settings.text.bottomArabic.fontFamily), fontSize: settings.text.bottomArabic.fontSize, fontWeight: settings.text.bottomArabic.fontWeight, writingDirection: "rtl" }}>{NAMES[key].ar}</Text>
          <Text style={{ color: selectedTextColor || settings.text.bottomEnglish.color, fontFamily: resolvedFont(settings.text.bottomEnglish.fontFamily), fontSize: settings.text.bottomEnglish.fontSize, fontWeight: settings.text.bottomEnglish.fontWeight }}>{NAMES[key].en}</Text>
          <Text style={{ color: selected ? settings.text.countdown.color : settings.text.bottomTime.color, fontFamily: resolvedFont(settings.text.bottomTime.fontFamily), fontSize: settings.text.bottomTime.fontSize, fontWeight: settings.text.bottomTime.fontWeight, fontVariant: ["tabular-nums"] }}>{time ? formatPrayerTime(time, locale).replace(/\s*[ap]\.m\.?/gi, "") : "—"}</Text>
        </Pressable>;
      })}</View> : null}
    </View>

    <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
      <View style={styles.modalBackdrop}><View style={styles.editorSheet}>
        <View style={styles.editorHeader}><View style={{ flex: 1 }}><Text style={styles.editorTitle}>Wall Display Designer</Text><Text style={styles.editorSubtitle}>Every change previews live and saves automatically.</Text></View><Pressable onPress={() => setEditorOpen(false)} style={styles.doneButton}><Text style={styles.doneButtonText}>Done</Text></Pressable></View>
        <View style={styles.editorTabs}>{(["presets", "text", "boxes", "behavior"] as const).map((tab) => <Pressable key={tab} onPress={() => setEditorTab(tab)} style={[styles.editorTab, editorTab === tab && styles.editorTabActive]}><Text style={[styles.editorTabText, editorTab === tab && styles.editorTabTextActive]}>{tab === "presets" ? "Themes" : tab === "text" ? "Text" : tab === "boxes" ? "Boxes" : "Slider"}</Text></Pressable>)}</View>
        <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false}>
          {editorTab === "presets" ? <><Text style={styles.sectionTitle}>Islamic background presets</Text><View style={styles.presetGrid}>{BACKGROUNDS.map((item) => <Pressable key={item.id} onPress={() => choosePreset(item.id)} style={[styles.presetCard, settings.backgroundPreset === item.id && !customBackground && styles.presetSelected]}><View style={[styles.presetPreview, { backgroundColor: item.base }]}><Text style={{ color: item.pattern, fontSize: 26 }}>☾ ۞</Text></View><Text style={styles.presetName}>{item.name}</Text></Pressable>)}</View><Pressable onPress={() => void pickBackground()} style={styles.uploadButton}><Text style={styles.uploadButtonText}>🖼 Choose my own background</Text></Pressable>{customBackground ? <Pressable onPress={() => updateSettings({ customBackgroundUri: "", backgroundPreset: "cream" })} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Remove custom background</Text></Pressable> : null}<ColorControl label="Page background" value={settings.backgroundColor} onChange={(backgroundColor) => updateSettings({ backgroundColor, customBackgroundUri: "" })} /><ColorControl label="Islamic pattern" value={settings.patternColor} onChange={(patternColor) => updateSettings({ patternColor })} /><View style={styles.editorField}><Text style={styles.editorLabel}>Pattern visibility</Text><Stepper value={Math.round(settings.patternOpacity * 100)} min={0} max={40} step={2} onChange={(value) => updateSettings({ patternOpacity: value / 100 })} /></View></> : null}
          {editorTab === "text" ? <><Text style={styles.sectionTitle}>Choose exactly what you want to edit</Text><View style={styles.targetGrid}>{(Object.keys(defaultText) as TextTarget[]).map((target) => <Pressable key={target} onPress={() => setSelectedTextTarget(target)} style={[styles.targetButton, selectedTextTarget === target && styles.targetButtonActive]}><Text style={[styles.targetButtonText, selectedTextTarget === target && styles.targetButtonTextActive]}>{target.replace(/([A-Z])/g, " $1")}</Text></Pressable>)}</View><ColorControl label={`${selectedTextTarget} color`} value={settings.text[selectedTextTarget].color} onChange={(color) => updateText(selectedTextTarget, { color })} /><View style={styles.editorField}><Text style={styles.editorLabel}>Font size</Text><Stepper value={settings.text[selectedTextTarget].fontSize} min={10} max={180} step={2} onChange={(fontSize) => updateText(selectedTextTarget, { fontSize })} /></View><View style={styles.editorField}><Text style={styles.editorLabel}>Font weight</Text><View style={styles.fontChips}>{(["400", "500", "600", "700", "800", "900"] as FontWeight[]).map((fontWeight) => <Pressable key={fontWeight} onPress={() => updateText(selectedTextTarget, { fontWeight })} style={[styles.fontChip, settings.text[selectedTextTarget].fontWeight === fontWeight && styles.fontChipActive]}><Text style={styles.fontChipText}>{fontWeight}</Text></Pressable>)}</View></View><View style={styles.editorField}><Text style={styles.editorLabel}>Font / Arabic calligraphy style</Text><View style={styles.fontList}>{FONT_CHOICES.map((fontFamily) => <Pressable key={fontFamily} onPress={() => updateText(selectedTextTarget, { fontFamily })} style={[styles.fontChoice, settings.text[selectedTextTarget].fontFamily === fontFamily && styles.fontChoiceActive]}><Text style={[styles.fontChoiceText, { fontFamily: resolvedFont(fontFamily) }]}>{fontFamily} • المغرب</Text></Pressable>)}</View></View>{selectedTextTarget === "clock" ? <><ColorControl label="3D clock edge / shadow" value={settings.clockShadowColor} onChange={(clockShadowColor) => updateSettings({ clockShadowColor })} /><View style={styles.editorField}><Text style={styles.editorLabel}>3D depth</Text><Stepper value={settings.clockShadowDepth} min={0} max={12} step={1} onChange={(clockShadowDepth) => updateSettings({ clockShadowDepth })} /></View><View style={styles.editorField}><Text style={styles.editorLabel}>3D softness</Text><Stepper value={settings.clockShadowRadius} min={0} max={18} step={1} onChange={(clockShadowRadius) => updateSettings({ clockShadowRadius })} /></View></> : null}</> : null}
          {editorTab === "boxes" ? <><Text style={styles.sectionTitle}>Main prayer card</Text><ColorControl label="Main card" value={settings.cardColor} onChange={(cardColor) => updateSettings({ cardColor })} /><ColorControl label="Main card border" value={settings.cardBorderColor} onChange={(cardBorderColor) => updateSettings({ cardBorderColor })} /><ColorControl label="Divider / decorative lines" value={settings.dividerColor} onChange={(dividerColor) => updateSettings({ dividerColor })} /><View style={styles.editorField}><Text style={styles.editorLabel}>Card corner roundness</Text><Stepper value={settings.cardRadius} min={0} max={70} step={2} onChange={(cardRadius) => updateSettings({ cardRadius })} /></View><View style={styles.editorField}><Text style={styles.editorLabel}>Card border thickness</Text><Stepper value={settings.cardBorderWidth} min={0} max={8} step={1} onChange={(cardBorderWidth) => updateSettings({ cardBorderWidth })} /></View><Text style={styles.sectionTitle}>Bottom prayer bar</Text><ColorControl label="Bottom cards" value={settings.bottomCardColor} onChange={(bottomCardColor) => updateSettings({ bottomCardColor })} /><ColorControl label="Bottom card border" value={settings.bottomCardBorderColor} onChange={(bottomCardBorderColor) => updateSettings({ bottomCardBorderColor })} /><ColorControl label="Selected prayer card" value={settings.selectedBottomColor} onChange={(selectedBottomColor) => updateSettings({ selectedBottomColor })} /><ColorControl label="Selected prayer border" value={settings.selectedBottomBorderColor} onChange={(selectedBottomBorderColor) => updateSettings({ selectedBottomBorderColor })} /><View style={styles.editorField}><Text style={styles.editorLabel}>Bottom card height</Text><Stepper value={settings.bottomCardHeight} min={58} max={130} step={2} onChange={(bottomCardHeight) => updateSettings({ bottomCardHeight })} /></View></> : null}
          {editorTab === "behavior" ? <><Text style={styles.sectionTitle}>Prayer card behavior</Text><ToggleRow label="Auto-slide prayer cards" value={settings.autoSlide} onValueChange={(autoSlide) => updateSettings({ autoSlide })} /><View style={styles.editorField}><Text style={styles.editorLabel}>Seconds per prayer card</Text><Stepper value={settings.slideSeconds} min={3} max={60} step={1} onChange={(slideSeconds) => updateSettings({ slideSeconds })} /></View><View style={styles.editorField}><Text style={styles.editorLabel}>Stop slider this many minutes before prayer</Text><Stepper value={settings.lockMinutes} min={0} max={30} step={1} onChange={(lockMinutes) => updateSettings({ lockMinutes })} /></View><View style={styles.editorField}><Text style={styles.editorLabel}>Slide transition speed (ms)</Text><Stepper value={settings.transitionMs} min={120} max={1800} step={80} onChange={(transitionMs) => updateSettings({ transitionMs })} /></View><ToggleRow label="Show seconds on local clock" value={settings.showSeconds} onValueChange={(showSeconds) => updateSettings({ showSeconds })} /><ToggleRow label="Show English prayer name" value={settings.showEnglish} onValueChange={(showEnglish) => updateSettings({ showEnglish })} /><ToggleRow label="Show next-prayer countdown" value={settings.showCountdown} onValueChange={(showCountdown) => updateSettings({ showCountdown })} /><ToggleRow label="Show Adhan on/off control" value={settings.showAdhanControl} onValueChange={(showAdhanControl) => updateSettings({ showAdhanControl })} /><ToggleRow label="Show all 5 bottom prayer cards" value={settings.showBottomCards} onValueChange={(showBottomCards) => updateSettings({ showBottomCards })} /></> : null}
          <Pressable onPress={() => setSettings(DEFAULT_SETTINGS)} style={styles.resetButton}><Text style={styles.resetButtonText}>Reset wall display to Hassoun defaults</Text></Pressable><Text style={styles.editorHelp}>Tip: press and hold the big local time anytime to reopen this designer.</Text>
        </ScrollView>
      </View></View>
    </Modal>
  </View>;

  return customBackground ? <ImageBackground source={{ uri: settings.customBackgroundUri }} resizeMode="cover" style={styles.backgroundImage} imageStyle={styles.backgroundImageInner}><View style={styles.customBackgroundShade} />{screenContent}</ImageBackground> : screenContent;
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1 }, backgroundImageInner: { opacity: 0.86 }, customBackgroundShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF22" },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },
  patternTop: { position: "absolute", top: 48, alignSelf: "center", fontSize: 60, letterSpacing: 16 }, patternMid: { position: "absolute", top: "46%", alignSelf: "center", fontSize: 72, letterSpacing: 20 }, patternBottom: { position: "absolute", bottom: 55, alignSelf: "center", fontSize: 56, letterSpacing: 14 },
  metaRow: { width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 34, paddingHorizontal: 16, minHeight: 34 }, metaText: { maxWidth: "46%", textAlign: "center" },
  clockArea: { width: "100%", minHeight: 150, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 }, clock: { width: "100%", lineHeight: 136, letterSpacing: 1, textAlign: "center", fontVariant: ["tabular-nums"], includeFontPadding: false },
  divider: { height: 2, width: "88%", alignSelf: "center", opacity: 0.9, marginBottom: 10 }, galleryArea: { flex: 1, alignItems: "center", justifyContent: "space-between" }, cardWrap: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", minHeight: 0 },
  prayerCard: { width: "94%", flex: 1, maxHeight: 840, minHeight: 500, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 22, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  nextPill: { position: "absolute", top: 18, borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 7 }, nextPillText: { fontSize: 14, fontWeight: "900", letterSpacing: 1.8 }, arabicName: { width: "100%", lineHeight: 122, textAlign: "center", writingDirection: "rtl", includeFontPadding: true }, cardRule: { width: "64%", height: 2, marginVertical: 14, opacity: 0.92 }, prayerTime: { width: "100%", lineHeight: 98, textAlign: "center", fontVariant: ["tabular-nums"], includeFontPadding: false },
  adhanControl: { marginTop: 16, minHeight: 54, minWidth: 205, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }, muted: { opacity: 0.58 }, lockMessage: { position: "absolute", bottom: 14, fontSize: 12, fontWeight: "800", textAlign: "center" },
  prayerTabs: { width: "100%", flexDirection: "row", gap: 7, paddingTop: 10, paddingBottom: 2 }, prayerTab: { flex: 1, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, paddingVertical: 4 }, tabGlyph: { fontSize: 15, lineHeight: 17, marginBottom: 1 }, pressed: { opacity: 0.72 },
  modalBackdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }, editorSheet: { height: "82%", backgroundColor: "#F9F6EE", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" }, editorHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#DED8C9" }, editorTitle: { color: "#073E33", fontSize: 24, fontWeight: "900" }, editorSubtitle: { color: "#6D746F", fontSize: 12, marginTop: 2 }, doneButton: { backgroundColor: "#08715A", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 12 }, doneButtonText: { color: "#FFF", fontWeight: "900", fontSize: 15 },
  editorTabs: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 7, backgroundColor: "#F0ECE2" }, editorTab: { flex: 1, minHeight: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, editorTabActive: { backgroundColor: "#08715A" }, editorTabText: { color: "#53605B", fontSize: 13, fontWeight: "800" }, editorTabTextActive: { color: "#FFF" }, editorScroll: { flex: 1 }, editorContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 42 }, sectionTitle: { color: "#073E33", fontSize: 20, fontWeight: "900", marginTop: 8, marginBottom: 12 },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, presetCard: { width: "31%", borderWidth: 2, borderColor: "transparent", borderRadius: 15, padding: 7, backgroundColor: "#FFF" }, presetSelected: { borderColor: "#08715A" }, presetPreview: { height: 68, borderRadius: 11, alignItems: "center", justifyContent: "center" }, presetName: { color: "#29443C", fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 5 }, uploadButton: { marginTop: 14, minHeight: 52, borderRadius: 16, backgroundColor: "#08715A", alignItems: "center", justifyContent: "center" }, uploadButtonText: { color: "#FFF", fontSize: 15, fontWeight: "900" }, secondaryButton: { marginTop: 8, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#A9B7B1", alignItems: "center", justifyContent: "center" }, secondaryButtonText: { color: "#31554B", fontWeight: "800" },
  editorField: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#E5DFD2" }, editorLabel: { color: "#173F35", fontSize: 15, fontWeight: "900", marginBottom: 10, textTransform: "capitalize" }, swatches: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, swatch: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: "#A8A8A8" }, swatchSelected: { borderColor: "#08715A", borderWidth: 4 }, hexRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }, colorPreview: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: "#AAA" }, hexInput: { flex: 1, height: 44, borderWidth: 1, borderColor: "#CFC8B9", borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#FFF", color: "#16372F", fontSize: 16, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 }, stepButton: { width: 46, height: 46, borderRadius: 13, backgroundColor: "#E5EFEA", alignItems: "center", justifyContent: "center" }, stepButtonText: { color: "#08715A", fontSize: 28, fontWeight: "900" }, stepValue: { minWidth: 72, color: "#183D33", fontSize: 20, fontWeight: "900", textAlign: "center" }, toggleRow: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E5DFD2" }, toggleLabel: { flex: 1, color: "#183D33", fontSize: 15, fontWeight: "800", paddingRight: 12 },
  targetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, targetButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#E9E5DA", alignItems: "center", justifyContent: "center" }, targetButtonActive: { backgroundColor: "#08715A" }, targetButtonText: { color: "#40534D", fontSize: 12, fontWeight: "800", textTransform: "capitalize" }, targetButtonTextActive: { color: "#FFF" }, fontChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, fontChip: { minWidth: 54, minHeight: 40, borderRadius: 12, backgroundColor: "#E9E5DA", alignItems: "center", justifyContent: "center", paddingHorizontal: 9 }, fontChipActive: { backgroundColor: "#08715A" }, fontChipText: { color: "#233E36", fontWeight: "800" }, fontList: { gap: 7 }, fontChoice: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#D8D1C2", backgroundColor: "#FFF", justifyContent: "center", paddingHorizontal: 13 }, fontChoiceActive: { borderColor: "#08715A", borderWidth: 2, backgroundColor: "#E6F2ED" }, fontChoiceText: { color: "#173D33", fontSize: 17 },
  resetButton: { marginTop: 28, minHeight: 52, borderRadius: 16, backgroundColor: "#8A3636", alignItems: "center", justifyContent: "center" }, resetButtonText: { color: "#FFF", fontSize: 14, fontWeight: "900" }, editorHelp: { color: "#68736F", fontSize: 12, textAlign: "center", marginTop: 12 }
});
