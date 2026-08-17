import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Font from "expo-font";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { QuranAyah, QuranLocale } from "./quranData";

export type QuranFontChoice = "qcf-v2" | "qcf-v1" | "qpc-hafs";
export type QuranPageTheme = "paper" | "white" | "sepia" | "dark";
export type QuranBookMode = "auto" | "single" | "spread";
export type QuranBrowseMode = "vertical" | "horizontal";

export type QuranAppearance = {
  font: QuranFontChoice;
  fontSize: number;
  lineHeightMultiplier: number;
  textColor: string;
  pageTheme: QuranPageTheme;
  bookMode: QuranBookMode;
  browseMode: QuranBrowseMode;
  tajweed: boolean;
};

export const DEFAULT_QURAN_APPEARANCE: QuranAppearance = {
  font: "qcf-v2",
  fontSize: 30,
  lineHeightMultiplier: 1.9,
  textColor: "#111111",
  pageTheme: "paper",
  bookMode: "auto",
  browseMode: "vertical",
  tajweed: false
};

const APPEARANCE_KEY = "wopt:quran:appearance:v2";
const API_BASE = "https://api.quran.com/api/v4/quran/verses";
const FONT_BASE = "https://verses.quran.foundation/fonts/quran/hafs";
const QPC_FONT_URL = `${FONT_BASE}/uthmanic_hafs/UthmanicHafs1Ver18.ttf`;
const responseCache = new Map<string, Record<string, string>>();
const loadedFonts = new Set<string>();

export function quranPageBackground(theme: QuranPageTheme) {
  if (theme === "white") return "#ffffff";
  if (theme === "sepia") return "#f4ecd8";
  if (theme === "dark") return "#181b1a";
  return "#fcf9ef";
}

export function useQuranAppearance() {
  const [appearance, setAppearanceState] = useState<QuranAppearance>(DEFAULT_QURAN_APPEARANCE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(APPEARANCE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<QuranAppearance>;
          setAppearanceState({ ...DEFAULT_QURAN_APPEARANCE, ...parsed });
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const setAppearance = (next: QuranAppearance | ((previous: QuranAppearance) => QuranAppearance)) => {
    setAppearanceState((previous) => {
      const value = typeof next === "function" ? next(previous) : next;
      void AsyncStorage.setItem(APPEARANCE_KEY, JSON.stringify(value));
      return value;
    });
  };

  const reset = () => {
    setAppearanceState(DEFAULT_QURAN_APPEARANCE);
    void AsyncStorage.setItem(APPEARANCE_KEY, JSON.stringify(DEFAULT_QURAN_APPEARANCE));
  };

  return { appearance, setAppearance, reset, ready };
}

function fontFamilyFor(font: QuranFontChoice, page: number) {
  if (font === "qpc-hafs") return "WOPT-QPC-Hafs";
  return `WOPT-${font}-p${page}`;
}

async function ensureFont(font: QuranFontChoice, page: number) {
  const family = fontFamilyFor(font, page);
  if (loadedFonts.has(family) || Font.isLoaded(family)) return family;
  const uri = font === "qpc-hafs"
    ? QPC_FONT_URL
    : font === "qcf-v1"
      ? `${FONT_BASE}/v1/ttf/p${page}.ttf`
      : `${FONT_BASE}/v2/ttf/p${page}.ttf`;
  await Font.loadAsync(family, uri);
  loadedFonts.add(family);
  return family;
}

async function ensureQpcFont() {
  const family = "WOPT-QPC-Hafs";
  if (!loadedFonts.has(family) && !Font.isLoaded(family)) {
    await Font.loadAsync(family, QPC_FONT_URL);
    loadedFonts.add(family);
  }
  return family;
}

function scriptFor(appearance: QuranAppearance) {
  if (appearance.tajweed) return "uthmani_tajweed";
  if (appearance.font === "qcf-v1") return "code_v1";
  if (appearance.font === "qcf-v2") return "code_v2";
  return "qpc_hafs";
}

async function fetchPageScript(script: string, page: number) {
  const cacheKey = `${script}:${page}`;
  const cached = responseCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/${script}?page_number=${page}`);
  if (!response.ok) throw new Error(`Quran script request failed: ${response.status}`);
  const payload = await response.json() as { verses?: Array<Record<string, unknown>> };
  const out: Record<string, string> = {};

  for (const verse of payload.verses ?? []) {
    const key = typeof verse.verse_key === "string" ? verse.verse_key : "";
    if (!key) continue;
    const value = script === "uthmani_tajweed"
      ? verse.text_uthmani_tajweed
      : script === "code_v1"
        ? verse.code_v1
        : script === "code_v2"
          ? verse.code_v2
          : verse.text_qpc_hafs;
    if (typeof value === "string" && value) out[key] = value;
  }

  responseCache.set(cacheKey, out);
  return out;
}

function decodeNumericEntities(value: string) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

type TajweedPiece = { text: string; rule?: string; end?: boolean };

function parseTajweed(value: string) {
  const pieces: TajweedPiece[] = [];
  const pattern = /<tajweed\s+class=["']?([^"'\s>]+)["']?>([\s\S]*?)<\/tajweed>|<span\s+class=["']?end["']?>([\s\S]*?)<\/span>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      pieces.push({ text: decodeNumericEntities(value.slice(cursor, match.index)) });
    }
    if (match[1]) pieces.push({ text: decodeNumericEntities(match[2] ?? ""), rule: match[1] });
    else pieces.push({ text: decodeNumericEntities(match[3] ?? ""), end: true });
    cursor = pattern.lastIndex;
  }
  if (cursor < value.length) pieces.push({ text: decodeNumericEntities(value.slice(cursor)) });
  return pieces;
}

const TAJWEED_COLORS: Record<string, string> = {
  ham_wasl: "#8a8a8a",
  slnt: "#9a9a9a",
  laam_shamsiyah: "#9a9a9a",
  madda_normal: "#537fff",
  madda_permissible: "#4050ff",
  madda_necessary: "#000ebc",
  madda_obligatory: "#2144c1",
  qlq: "#dd0008",
  ikhf_shfw: "#d500b7",
  ikhf: "#9400a8",
  idghm_shfw: "#58b800",
  iqlb: "#26bffd",
  idgh_ghn: "#169777",
  idgh_w_ghn: "#169200",
  idgh_mus: "#777777",
  ghn: "#ff7e1e"
};

function ayahKey(ayah: QuranAyah) {
  return `${ayah.surah}:${ayah.ayah}`;
}

function numberForLocale(value: number, locale: QuranLocale) {
  return locale === "ar" ? new Intl.NumberFormat("ar").format(value) : String(value);
}

export function QuranPageText({
  page,
  ayahs,
  appearance,
  locale,
  selectedKey,
  highlightedKey,
  onPressAyah
}: {
  page: number;
  ayahs: QuranAyah[];
  appearance: QuranAppearance;
  locale: QuranLocale;
  selectedKey?: string | null;
  highlightedKey?: string | null;
  onPressAyah: (ayah: QuranAyah) => void;
}) {
  const [remoteText, setRemoteText] = useState<Record<string, string>>({});
  const [fontFamily, setFontFamily] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const script = useMemo(() => scriptFor(appearance), [appearance.font, appearance.tajweed]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const family = appearance.tajweed
          ? await ensureQpcFont()
          : await ensureFont(appearance.font, page);
        const data = await fetchPageScript(script, page);
        if (active) {
          setFontFamily(family);
          setRemoteText(data);
        }
      } catch {
        if (active) {
          // Verified local Uthmani text remains the safe fallback.
          setRemoteText({});
          try {
            const family = await ensureQpcFont();
            if (active) setFontFamily(family);
          } catch {
            if (active) setFontFamily(undefined);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [appearance.font, appearance.tajweed, page, script]);

  const effectiveColor = appearance.pageTheme === "dark" && appearance.textColor === "#111111"
    ? "#f2efe7"
    : appearance.textColor;
  const lineHeight = Math.round(appearance.fontSize * appearance.lineHeightMultiplier);

  return (
    <View>
      {loading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color="#0b654f" /><Text style={styles.loadingText}>{locale === "ar" ? "جارٍ تجهيز خط المصحف…" : "Preparing Mushaf font…"}</Text></View> : null}
      <Text style={{ color: effectiveColor, fontSize: appearance.fontSize, lineHeight, textAlign: "right", writingDirection: "rtl", fontFamily }}>
        {ayahs.map((ayah) => {
          const key = ayahKey(ayah);
          const selected = selectedKey === key;
          const highlighted = highlightedKey === key;
          const raw = remoteText[key];
          const highlightStyle = highlighted
            ? { backgroundColor: appearance.pageTheme === "dark" ? "#715b20" : "#f8e7a4" }
            : selected
              ? { backgroundColor: appearance.pageTheme === "dark" ? "#21483d" : "#dff1e9" }
              : undefined;

          if (appearance.tajweed && raw) {
            const pieces = parseTajweed(raw);
            return (
              <Text key={key} onPress={() => onPressAyah(ayah)} style={highlightStyle}>
                {pieces.map((piece, index) => piece.end ? (
                  <Text key={`${key}-e-${index}`} style={{ color: "#0b8b69", fontFamily }}>{` ﴿${piece.text}﴾ `}</Text>
                ) : (
                  <Text key={`${key}-t-${index}`} style={piece.rule ? { color: TAJWEED_COLORS[piece.rule] ?? effectiveColor } : { color: effectiveColor }}>{piece.text}</Text>
                ))}
                {" "}
              </Text>
            );
          }

          if ((appearance.font === "qcf-v1" || appearance.font === "qcf-v2") && raw) {
            const decoded = decodeNumericEntities(raw).trimEnd();
            const glyphs = Array.from(decoded);
            const markerGlyph = glyphs.pop() ?? "";
            const verseGlyphs = glyphs.join("");
            return (
              <Text key={key} onPress={() => onPressAyah(ayah)} style={[highlightStyle, { fontFamily, color: effectiveColor }]}>
                {verseGlyphs}
                {markerGlyph ? <Text style={{ color: "#0b8b69", fontFamily }}>{markerGlyph}</Text> : null}{" "}
              </Text>
            );
          }

          const text = raw ? decodeNumericEntities(raw).replace(/<[^>]+>/g, "") : ayah.text;
          return (
            <Text key={key} onPress={() => onPressAyah(ayah)} style={highlightStyle}>
              {text}<Text style={{ color: "#0b8b69", fontFamily }}> ﴿{numberForLocale(ayah.ayah, locale)}﴾ </Text>
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

const FONT_OPTIONS: Array<{ id: QuranFontChoice; en: string; ar: string; noteEn: string; noteAr: string }> = [
  { id: "qcf-v2", en: "King Fahad Complex V2", ar: "مجمع الملك فهد V2", noteEn: "Recommended Madani Mushaf", noteAr: "مصحف المدينة الموصى به" },
  { id: "qcf-v1", en: "King Fahad Complex V1", ar: "مجمع الملك فهد V1", noteEn: "Traditional Madani glyphs", noteAr: "الرسم المدني التقليدي" },
  { id: "qpc-hafs", en: "QPC Uthmani Hafs", ar: "عثماني حفص QPC", noteEn: "Unicode Hafs script", noteAr: "خط حفص العثماني" }
];

export function ReaderSettingsSheet({
  visible,
  locale,
  appearance,
  setAppearance,
  reset,
  onDone
}: {
  visible: boolean;
  locale: QuranLocale;
  appearance: QuranAppearance;
  setAppearance: (next: QuranAppearance | ((previous: QuranAppearance) => QuranAppearance)) => void;
  reset: () => void;
  onDone: () => void;
}) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const effectiveColor = appearance.pageTheme === "dark" && appearance.textColor === "#111111" ? "#f2efe7" : appearance.textColor;
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <View style={styles.modalShade}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, ar && styles.rtl]}>{t("Qur’an appearance", "مظهر القرآن")}</Text>
              <Text style={[styles.sheetSubtitle, ar && styles.rtl]}>{t("Font • Tajweed • navigation • layout • size • colors", "الخط • التجويد • التنقل • شكل الكتاب • الحجم • الألوان")}</Text>
            </View>
            <Pressable onPress={onDone} style={styles.doneTop}><Text style={styles.doneTopText}>✓</Text></Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("QUR’AN FONT", "خط القرآن")}</Text>
            <View style={styles.optionCard}>
              {FONT_OPTIONS.map((option, index) => {
                const selected = appearance.font === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setAppearance((previous) => ({ ...previous, font: option.id }))}
                    style={[styles.fontOption, index > 0 && styles.optionDivider]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fontName, ar && styles.rtl]}>{ar ? option.ar : option.en}</Text>
                      <Text style={[styles.fontNote, ar && styles.rtl]}>{ar ? option.noteAr : option.noteEn}</Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.tajweedCard}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, ar && styles.rtl]}>🎨 {t("Show Tajweed rules while reading", "إظهار أحكام التجويد أثناء القراءة")}</Text>
                <Text style={[styles.settingNote, ar && styles.rtl]}>{t("Uses Quran.com Uthmani Tajweed rule markup with color-coded letters.", "يستخدم نص التجويد العثماني الملوّن المعتمد من Quran.com.")}</Text>
              </View>
              <Switch value={appearance.tajweed} onValueChange={(value) => setAppearance((previous) => ({ ...previous, tajweed: value }))} trackColor={{ false: "#d4d8d5", true: "#8dcabb" }} thumbColor={appearance.tajweed ? "#0b7a5d" : "#ffffff"} />
            </View>

            {appearance.tajweed ? (
              <View style={styles.legendCard}>
                <Text style={[styles.legendTitle, ar && styles.rtl]}>{t("Tajweed color guide", "دليل ألوان التجويد")}</Text>
                <View style={styles.legendWrap}>
                  <Text style={[styles.legendChip, { color: "#537fff" }]}>{t("Madd", "مد")}</Text>
                  <Text style={[styles.legendChip, { color: "#ff7e1e" }]}>{t("Ghunnah", "غنة")}</Text>
                  <Text style={[styles.legendChip, { color: "#9400a8" }]}>{t("Ikhfa", "إخفاء")}</Text>
                  <Text style={[styles.legendChip, { color: "#dd0008" }]}>{t("Qalqalah", "قلقلة")}</Text>
                  <Text style={[styles.legendChip, { color: "#169777" }]}>{t("Idgham", "إدغام")}</Text>
                </View>
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("TEXT SIZE", "حجم الخط")}</Text>
            <View style={styles.stepperCard}>
              <Pressable onPress={() => setAppearance((previous) => ({ ...previous, fontSize: Math.max(20, previous.fontSize - 2) }))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></Pressable>
              <View style={styles.stepValueWrap}><Text style={styles.stepValue}>{appearance.fontSize}</Text><Text style={styles.stepCaption}>{t("Font size", "حجم الخط")}</Text></View>
              <Pressable onPress={() => setAppearance((previous) => ({ ...previous, fontSize: Math.min(48, previous.fontSize + 2) }))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></Pressable>
            </View>

            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("LINE SPACING", "تباعد السطور")}</Text>
            <View style={styles.stepperCard}>
              <Pressable onPress={() => setAppearance((previous) => ({ ...previous, lineHeightMultiplier: Math.max(1.35, Math.round((previous.lineHeightMultiplier - 0.1) * 10) / 10) }))} style={styles.stepButton}><Text style={styles.stepButtonText}>−</Text></Pressable>
              <View style={styles.stepValueWrap}><Text style={styles.stepValue}>{appearance.lineHeightMultiplier.toFixed(1)}×</Text><Text style={styles.stepCaption}>{t("Spacing", "التباعد")}</Text></View>
              <Pressable onPress={() => setAppearance((previous) => ({ ...previous, lineHeightMultiplier: Math.min(2.6, Math.round((previous.lineHeightMultiplier + 0.1) * 10) / 10) }))} style={styles.stepButton}><Text style={styles.stepButtonText}>+</Text></Pressable>
            </View>

            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("PAGE LAYOUT", "شكل الصفحات")}</Text>
            <View style={styles.layoutRow}>
              {([
                ["auto", "◫", t("Auto", "تلقائي"), t("Open book on Fold/tablet", "كتاب مفتوح على الأجهزة القابلة للطي")],
                ["single", "▯", t("Single", "صفحة"), t("One Mushaf page", "صفحة مصحف واحدة")],
                ["spread", "▯▯", t("Open book", "كتاب مفتوح"), t("Two pages side by side", "صفحتان جنباً إلى جنب")]
              ] as Array<[QuranBookMode, string, string, string]>).map(([mode, icon, label, note]) => (
                <Pressable key={mode} onPress={() => setAppearance((previous) => ({ ...previous, bookMode: mode }))} style={[styles.layoutChoice, appearance.bookMode === mode && styles.layoutChoiceActive]}>
                  <Text style={[styles.layoutIcon, appearance.bookMode === mode && styles.layoutIconActive]}>{icon}</Text>
                  <Text style={[styles.layoutLabel, appearance.bookMode === mode && styles.layoutLabelActive]}>{label}</Text>
                  <Text style={styles.layoutNote}>{note}</Text>
                </Pressable>
              ))}
            </View>


            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("PAGE BROWSING", "طريقة التنقل")}</Text>
            <View style={styles.browseRow}>
              {([
                ["vertical", "↕", t("Vertical", "رأسي"), t("Scroll up/down. At the page edge, keep swiping to turn the page.", "مرّر لأعلى وأسفل، وعند نهاية الصفحة تابع السحب للانتقال.")],
                ["horizontal", "↔", t("Horizontal", "أفقي"), t("Swipe left/right anywhere on the Mushaf page to turn pages.", "اسحب يميناً ويساراً في أي مكان على صفحة المصحف للتنقل بين الصفحات.")]
              ] as Array<[QuranBrowseMode, string, string, string]>).map(([mode, icon, label, note]) => (
                <Pressable key={mode} onPress={() => setAppearance((previous) => ({ ...previous, browseMode: mode }))} style={[styles.browseChoice, appearance.browseMode === mode && styles.browseChoiceActive]}>
                  <Text style={[styles.browseIcon, appearance.browseMode === mode && styles.browseIconActive]}>{icon}</Text>
                  <View style={{ flex: 1 }}><Text style={[styles.browseLabel, ar && styles.rtl]}>{label}</Text><Text style={[styles.browseNote, ar && styles.rtl]}>{note}</Text></View>
                  <View style={[styles.radio, appearance.browseMode === mode && styles.radioSelected]}>{appearance.browseMode === mode ? <View style={styles.radioDot} /> : null}</View>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("PAGE STYLE", "لون الصفحة")}</Text>
            <View style={styles.themeRow}>
              {([
                ["paper", "#fcf9ef", t("Mushaf", "مصحف")],
                ["white", "#ffffff", t("White", "أبيض")],
                ["sepia", "#f4ecd8", t("Sepia", "ورقي")],
                ["dark", "#181b1a", t("Dark", "داكن")]
              ] as Array<[QuranPageTheme, string, string]>).map(([theme, color, label]) => (
                <Pressable key={theme} onPress={() => setAppearance((previous) => ({ ...previous, pageTheme: theme }))} style={[styles.themeChoice, appearance.pageTheme === theme && styles.themeChoiceActive]}>
                  <View style={[styles.themeSwatch, { backgroundColor: color }]} />
                  <Text style={styles.themeLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("TEXT COLOR", "لون النص")}</Text>
            <View style={styles.colorRow}>
              {["#111111", "#163e34", "#6d4c2f", "#f2efe7"].map((color) => (
                <Pressable key={color} onPress={() => setAppearance((previous) => ({ ...previous, textColor: color }))} style={[styles.colorChoice, appearance.textColor === color && styles.colorChoiceActive]}>
                  <View style={[styles.colorDot, { backgroundColor: color }]} />
                </Pressable>
              ))}
            </View>

            <View style={[styles.previewCard, { backgroundColor: quranPageBackground(appearance.pageTheme) }]}>
              <Text style={styles.previewLabel}>{t("Preview", "معاينة")}</Text>
              <Text style={{ color: effectiveColor, fontSize: appearance.fontSize, lineHeight: Math.round(appearance.fontSize * appearance.lineHeightMultiplier), textAlign: "center", writingDirection: "rtl" }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</Text>
            </View>
          </ScrollView>

          <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, 12), minHeight: 72 + Math.max(insets.bottom, 12) }]}>
            <Pressable onPress={reset} style={styles.resetButton}><Text style={styles.resetText}>{t("Reset", "إعادة ضبط")}</Text></Pressable>
            <Pressable onPress={onDone} style={styles.doneButton}><Text style={styles.doneText}>{t("Done", "تم")}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rtl: { textAlign: "right", writingDirection: "rtl" },
  loadingRow: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 },
  loadingText: { color: "#71807a", fontSize: 9 },
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,.42)", justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", backgroundColor: "#fbfaf7", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  sheetHandle: { width: 44, height: 5, borderRadius: 9, backgroundColor: "#d6d4cf", alignSelf: "center", marginTop: 9 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 13, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e6e2da" },
  sheetTitle: { color: "#173f35", fontSize: 21, fontWeight: "900" },
  sheetSubtitle: { color: "#7c8782", fontSize: 9, marginTop: 3 },
  doneTop: { width: 38, height: 38, borderRadius: 15, backgroundColor: "#e6f2ed", alignItems: "center", justifyContent: "center" },
  doneTopText: { color: "#0b7057", fontSize: 18, fontWeight: "900" },
  sheetScroll: { padding: 18, paddingBottom: 36 },
  sectionLabel: { color: "#8d743d", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 5, marginBottom: 8 },
  optionCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e3dfd7", overflow: "hidden", marginBottom: 16 },
  fontOption: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 10 },
  optionDivider: { borderTopWidth: 1, borderTopColor: "#ece9e2" },
  fontName: { color: "#233f38", fontSize: 14, fontWeight: "800" },
  fontNote: { color: "#84908b", fontSize: 9, marginTop: 3 },
  radio: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: "#aab4af", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: "#0b7a5d" },
  radioDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#0b7a5d" },
  tajweedCard: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#edf6f2", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#d7ebe2", marginBottom: 14 },
  settingTitle: { color: "#173f35", fontSize: 12, fontWeight: "900" },
  settingNote: { color: "#74827c", fontSize: 9, lineHeight: 13, marginTop: 4 },
  legendCard: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e5e1d9", padding: 12, marginBottom: 15 },
  legendTitle: { color: "#344f47", fontSize: 10, fontWeight: "900", marginBottom: 8 },
  legendWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  legendChip: { fontSize: 10, fontWeight: "900", backgroundColor: "#f6f5f1", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6 },
  stepperCard: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e3dfd7", padding: 8, marginBottom: 14 },
  stepButton: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" },
  stepButtonText: { color: "#0b654f", fontSize: 26, fontWeight: "700" },
  stepValueWrap: { alignItems: "center" },
  stepValue: { color: "#173f35", fontSize: 17, fontWeight: "900" },
  stepCaption: { color: "#8a948f", fontSize: 8, marginTop: 1 },
  layoutRow: { flexDirection: "row", gap: 7, marginBottom: 15 },
  layoutChoice: { flex: 1, minHeight: 92, borderRadius: 16, borderWidth: 1, borderColor: "#e0ddd6", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 8 },
  layoutChoiceActive: { borderColor: "#0b7a5d", backgroundColor: "#edf6f2" },
  layoutIcon: { color: "#6c7974", fontSize: 23, fontWeight: "900" },
  layoutIconActive: { color: "#0b7a5d" },
  layoutLabel: { color: "#52635d", fontSize: 9, fontWeight: "900", marginTop: 5, textAlign: "center" },
  layoutLabelActive: { color: "#0b654f" },
  layoutNote: { color: "#929a96", fontSize: 7, lineHeight: 10, textAlign: "center", marginTop: 3 },
  browseRow: { gap: 8, marginBottom: 15 },
  browseChoice: { minHeight: 76, borderRadius: 18, borderWidth: 1, borderColor: "#e0ddd6", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 11, padding: 12 },
  browseChoiceActive: { borderColor: "#0b7a5d", backgroundColor: "#edf6f2" },
  browseIcon: { width: 38, height: 38, textAlign: "center", textAlignVertical: "center", borderRadius: 13, backgroundColor: "#f1f3f0", color: "#65726d", fontSize: 21, fontWeight: "900" },
  browseIconActive: { backgroundColor: "#dff0e8", color: "#0b7057" },
  browseLabel: { color: "#233f38", fontSize: 12, fontWeight: "900" },
  browseNote: { color: "#7f8b86", fontSize: 8, lineHeight: 12, marginTop: 3 },
  themeRow: { flexDirection: "row", gap: 7, marginBottom: 15 },
  themeChoice: { flex: 1, alignItems: "center", gap: 5, padding: 7, borderRadius: 14, borderWidth: 1, borderColor: "#e0ddd6", backgroundColor: "#fff" },
  themeChoiceActive: { borderColor: "#0b7a5d", backgroundColor: "#edf6f2" },
  themeSwatch: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: "#d7d2c8" },
  themeLabel: { color: "#52635d", fontSize: 8, fontWeight: "800", textAlign: "center" },
  colorRow: { flexDirection: "row", gap: 12, marginBottom: 15 },
  colorChoice: { width: 46, height: 46, borderRadius: 15, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  colorChoiceActive: { borderColor: "#0b7a5d" },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "#d2d0ca" },
  previewCard: { borderRadius: 20, borderWidth: 1, borderColor: "#ded8ca", padding: 15, marginTop: 3 },
  previewLabel: { color: "#8a8f8c", fontSize: 9, marginBottom: 9 },
  sheetFooter: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: "#e7e3dc", backgroundColor: "#fff" },
  resetButton: { minWidth: 86, minHeight: 44, alignItems: "center", justifyContent: "center" },
  resetText: { color: "#69736f", fontSize: 12, fontWeight: "800" },
  doneButton: { minWidth: 92, minHeight: 46, borderRadius: 15, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  doneText: { color: "#fff", fontSize: 12, fontWeight: "900" }
});
