import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import {
  getWallControllerState,
  listPairedWallDisplays,
  pairWallDisplay,
  revokeRemoteWallLink,
  sendRemoteWallCommand,
  updateRemoteWallSettings,
  type WallControllerLink,
  type WallRemoteDisplayState
} from "./wallRemote";

const SWATCHES = ["#FFFFFF", "#FFF9EB", "#F1D27A", "#D8A42B", "#9E6D13", "#07503F", "#03392F", "#171717", "#7A2D2D", "#315D89", "#5E4A8A"];
const FONTS = ["System", "sans-serif", "sans-serif-medium", "sans-serif-black", "sans-serif-condensed", "sans-serif-light", "serif", "monospace", "cursive", "Noto Naskh Arabic", "Noto Kufi Arabic", "Noto Sans Arabic", "Traditional Arabic"];
const TEXT_TARGETS = ["clock", "location", "date", "arabic", "english", "prayerTime", "countdown", "adhan", "bottomArabic", "bottomEnglish", "bottomTime"];

function Stepper({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  const change = (delta: number) => onChange(Math.max(min, Math.min(max, value + delta)));
  return <View style={styles.stepper}><Pressable style={styles.stepButton} onPress={() => change(-step)}><Text style={styles.stepButtonText}>−</Text></Pressable><Text style={styles.stepValue}>{value}</Text><Pressable style={styles.stepButton} onPress={() => change(step)}><Text style={styles.stepButtonText}>+</Text></Pressable></View>;
}

function Toggle({ label, value, onChange, note }: { label: string; value: boolean; onChange: (value: boolean) => void; note?: string }) {
  return <View style={styles.toggleRow}><View style={styles.toggleCopy}><Text style={styles.toggleLabel}>{label}</Text>{note ? <Text style={styles.note}>{note}</Text> : null}</View><Switch value={value} onValueChange={onChange} /></View>;
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={styles.block}><Text style={styles.label}>{label}</Text><View style={styles.swatches}>{SWATCHES.map((color) => <Pressable key={color} onPress={() => onChange(color)} style={[styles.swatch, { backgroundColor: color }, value?.toUpperCase() === color && styles.swatchActive]} />)}</View><TextInput value={value || ""} onChangeText={(text) => /^#[0-9a-fA-F]{0,6}$/.test(text) && onChange(text.toUpperCase())} style={styles.hexInput} autoCapitalize="characters" maxLength={7} /></View>;
}

function onlineLabel(lastSeenAt?: string | null) {
  if (!lastSeenAt) return "No recent status";
  const age = Date.now() - new Date(lastSeenAt).getTime();
  return age < 30_000 ? "Online now" : age < 120_000 ? "Recently online" : `Last seen ${new Date(lastSeenAt).toLocaleString()}`;
}

export default function WallRemoteController({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [links, setLinks] = useState<WallControllerLink[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [display, setDisplay] = useState<WallRemoteDisplayState | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [pairingCode, setPairingCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"status" | "look" | "text" | "behavior" | "smart">("status");
  const [textTarget, setTextTarget] = useState("clock");
  const selectedLink = useMemo(() => links.find((item) => item.displayId === selectedId) ?? null, [links, selectedId]);

  const reloadLinks = async () => {
    const next = await listPairedWallDisplays();
    setLinks(next);
    if (!selectedId && next[0]) setSelectedId(next[0].displayId);
  };

  const refreshState = async (silent = false) => {
    if (!selectedLink) return;
    try {
      const state = await getWallControllerState(selectedLink);
      setDisplay(state);
      setDraft(state.settings || {});
    } catch (error) {
      if (!silent) Alert.alert("Wall display unavailable", String(error));
    }
  };

  useEffect(() => { if (visible) void reloadLinks(); }, [visible]);
  useEffect(() => { if (visible && selectedLink) void refreshState(); }, [visible, selectedId]);
  useEffect(() => {
    if (!visible || !selectedLink) return;
    const id = setInterval(() => void refreshState(true), 10_000);
    return () => clearInterval(id);
  }, [visible, selectedId]);

  const pair = async () => {
    if (pairingCode.trim().length !== 6) { Alert.alert("Enter the 6-character code", "Open the Wall Display Designer on the tablet and use the Remote tab."); return; }
    setBusy(true);
    try {
      const result = await pairWallDisplay(pairingCode);
      setPairingCode("");
      await reloadLinks();
      setSelectedId(result.link.displayId);
      setDisplay(result.display);
      setDraft(result.display.settings || {});
      Alert.alert("Wall display paired", `${result.display.name} can now be controlled from this device.`);
    } catch (error) { Alert.alert("Pairing failed", String(error)); }
    finally { setBusy(false); }
  };

  const patch = (values: Record<string, any>) => setDraft((current) => ({ ...current, ...values }));
  const patchText = (target: string, values: Record<string, any>) => setDraft((current) => ({ ...current, text: { ...(current.text || {}), [target]: { ...(current.text?.[target] || {}), ...values } } }));

  const apply = async () => {
    if (!selectedLink) return;
    setBusy(true);
    try {
      await updateRemoteWallSettings(selectedLink, draft);
      Alert.alert("Sent", "The wall display will apply these settings within a few seconds.");
      await refreshState(true);
    } catch (error) { Alert.alert("Could not update display", String(error)); }
    finally { setBusy(false); }
  };

  const command = async (name: string, success: string) => {
    if (!selectedLink) return;
    try { await sendRemoteWallCommand(selectedLink, name); Alert.alert("Command sent", success); }
    catch (error) { Alert.alert("Command failed", String(error)); }
  };

  const unpair = async () => {
    if (!selectedLink) return;
    await revokeRemoteWallLink(selectedLink);
    setDisplay(null); setDraft({}); setSelectedId(null); await reloadLinks();
  };

  const text = draft.text?.[textTarget] || {};
  const status = display?.status || {};

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={styles.screen}>
      <View style={styles.header}><View><Text style={styles.title}>Wall Displays</Text><Text style={styles.subtitle}>Secure remote control for paired Hassoun displays</Text></View><Pressable onPress={onClose} style={styles.done}><Text style={styles.doneText}>Done</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pairCard}><Text style={styles.section}>Pair another display</Text><Text style={styles.note}>On the wall tablet, hold the large clock → Remote. Enter its 6-character code here.</Text><View style={styles.pairRow}><TextInput value={pairingCode} onChangeText={(value) => setPairingCode(value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))} placeholder="ABC234" autoCapitalize="characters" style={styles.codeInput} /><Pressable disabled={busy} onPress={() => void pair()} style={styles.primaryButton}><Text style={styles.primaryText}>Pair</Text></Pressable></View></View>

        {links.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deviceTabs}>{links.map((link) => <Pressable key={link.displayId} onPress={() => setSelectedId(link.displayId)} style={[styles.deviceChip, selectedId === link.displayId && styles.deviceChipActive]}><Text style={[styles.deviceChipText, selectedId === link.displayId && styles.deviceChipTextActive]}>{link.displayName}</Text></Pressable>)}</ScrollView> : <Text style={styles.empty}>No wall displays paired yet.</Text>}

        {selectedLink && display ? <>
          <View style={styles.statusCard}><View><Text style={styles.deviceName}>{display.name}</Text><Text style={[styles.online, onlineLabel(display.lastSeenAt) === "Online now" && styles.onlineNow]}>{onlineLabel(display.lastSeenAt)}</Text></View><Pressable onPress={() => void refreshState()} style={styles.refresh}><Text>↻</Text></Pressable></View>
          <View style={styles.tabs}>{(["status", "look", "text", "behavior", "smart"] as const).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item.toUpperCase()}</Text></Pressable>)}</View>

          {tab === "status" ? <View style={styles.panel}>
            <Text style={styles.section}>Live status</Text>
            <View style={styles.statusGrid}><Text style={styles.statusItem}>Prayer: {status.nextPrayer || "—"}</Text><Text style={styles.statusItem}>Countdown: {status.secondsRemaining ?? "—"}</Text><Text style={styles.statusItem}>Location: {status.location || "—"}</Text><Text style={styles.statusItem}>Alerts: {status.alertsEnabled ? "Enabled" : "Off"}</Text><Text style={styles.statusItem}>Exact alarms: {status.exactAlarms ? "Ready" : "Needs attention"}</Text><Text style={styles.statusItem}>Ramadan mode: {status.ramadanMode ? "On" : "Off"}</Text><Text style={styles.statusItem}>Battery: {status.batteryLevel != null ? `${Math.round(Number(status.batteryLevel) * 100)}%` : "—"}</Text><Text style={styles.statusItem}>Charging: {status.charging ? "Yes" : "No"}</Text></View>
            <Text style={styles.section}>Remote actions</Text>
            <View style={styles.commandGrid}><Pressable style={styles.command} onPress={() => void command("test_notification", "The reminder chime test was requested.")}><Text style={styles.commandTitle}>🔔 Test chime</Text></Pressable><Pressable style={styles.command} onPress={() => void command("test_adhan", "The Fajr Adhan test was requested.")}><Text style={styles.commandTitle}>🕌 Test Adhan</Text></Pressable><Pressable style={styles.command} onPress={() => void command("enable_alerts", "The tablet will prompt for anything it needs.")}><Text style={styles.commandTitle}>✓ Fix alerts</Text></Pressable><Pressable style={styles.command} onPress={() => void command("show_next_prayer", "The tablet will focus the upcoming prayer.")}><Text style={styles.commandTitle}>Next prayer</Text></Pressable><Pressable style={styles.command} onPress={() => void command("resume_auto", "Automatic prayer sliding was restored.")}><Text style={styles.commandTitle}>Resume auto</Text></Pressable><Pressable style={styles.command} onPress={() => void command("refresh_prayers", "Prayer data refresh was requested.")}><Text style={styles.commandTitle}>Refresh times</Text></Pressable></View>
          </View> : null}

          {tab === "look" ? <View style={styles.panel}>
            <Text style={styles.section}>Background & cards</Text>
            <View style={styles.presetRow}>{["ivory", "pearl", "dawn", "sage", "emerald", "night"].map((name) => <Pressable key={name} onPress={() => patch({ backgroundPreset: name, customBackgroundUri: "" })} style={[styles.preset, draft.backgroundPreset === name && styles.presetActive]}><Text style={styles.presetText}>{name}</Text></Pressable>)}</View>
            <Text style={styles.label}>Remote background image URL</Text><TextInput value={draft.remoteBackgroundUrl || ""} onChangeText={(remoteBackgroundUrl) => patch({ remoteBackgroundUrl, backgroundPreset: remoteBackgroundUrl ? "remote" : draft.backgroundPreset })} placeholder="https://..." autoCapitalize="none" style={styles.wideInput} />
            <ColorRow label="Background color" value={draft.backgroundColor || "#F7F1E3"} onChange={(backgroundColor) => patch({ backgroundColor })} />
            <ColorRow label="Pattern color" value={draft.patternColor || "#D3B15A"} onChange={(patternColor) => patch({ patternColor })} />
            <Text style={styles.label}>Photo overlay strength</Text><Stepper value={Math.round((draft.backgroundOverlayOpacity ?? 0.18) * 100)} min={0} max={90} step={5} onChange={(v) => patch({ backgroundOverlayOpacity: v / 100 })} />
            <ColorRow label="Main prayer card" value={draft.cardColor || "#07503F"} onChange={(cardColor) => patch({ cardColor })} />
            <ColorRow label="Main card border" value={draft.cardBorderColor || "#D9B65C"} onChange={(cardBorderColor) => patch({ cardBorderColor })} />
            <Text style={styles.label}>Card border width</Text><Stepper value={draft.cardBorderWidth ?? 2} min={0} max={8} onChange={(cardBorderWidth) => patch({ cardBorderWidth })} />
            <Text style={styles.label}>Card corner radius</Text><Stepper value={draft.cardRadius ?? 36} min={0} max={64} step={2} onChange={(cardRadius) => patch({ cardRadius })} />
            <ColorRow label="Bottom cards" value={draft.bottomCardColor || "#FFFDF6"} onChange={(bottomCardColor) => patch({ bottomCardColor })} />
            <ColorRow label="Selected bottom card" value={draft.selectedBottomColor || "#07503F"} onChange={(selectedBottomColor) => patch({ selectedBottomColor })} />
          </View> : null}

          {tab === "text" ? <View style={styles.panel}>
            <Text style={styles.section}>Every text element</Text><View style={styles.targetRow}>{TEXT_TARGETS.map((target) => <Pressable key={target} onPress={() => setTextTarget(target)} style={[styles.target, textTarget === target && styles.targetActive]}><Text style={[styles.targetText, textTarget === target && styles.targetTextActive]}>{target}</Text></Pressable>)}</View>
            <ColorRow label={`${textTarget} color`} value={text.color || "#FFFFFF"} onChange={(color) => patchText(textTarget, { color })} />
            <Text style={styles.label}>Font size</Text><Stepper value={Number(text.fontSize || 18)} min={8} max={280} step={2} onChange={(fontSize) => patchText(textTarget, { fontSize })} />
            <Text style={styles.label}>Font</Text><View style={styles.fonts}>{FONTS.map((font) => <Pressable key={font} onPress={() => patchText(textTarget, { fontFamily: font })} style={[styles.font, text.fontFamily === font && styles.fontActive]}><Text style={styles.fontText}>{font}</Text></Pressable>)}</View>
            {textTarget === "clock" ? <><ColorRow label="Clock gold edge" value={draft.clockEdgeColor || "#D8A42B"} onChange={(clockEdgeColor) => patch({ clockEdgeColor })} /><Text style={styles.label}>Edge thickness</Text><Stepper value={draft.clockEdgeWidth ?? 3} min={0} max={8} onChange={(clockEdgeWidth) => patch({ clockEdgeWidth })} /><ColorRow label="Clock shadow" value={draft.clockShadowColor || "#5B3B08"} onChange={(clockShadowColor) => patch({ clockShadowColor })} /><Text style={styles.label}>3D depth</Text><Stepper value={draft.clockShadowDepth ?? 10} min={0} max={20} onChange={(clockShadowDepth) => patch({ clockShadowDepth })} /><Text style={styles.label}>Shadow softness</Text><Stepper value={draft.clockShadowRadius ?? 10} min={0} max={20} onChange={(clockShadowRadius) => patch({ clockShadowRadius })} /></> : null}
          </View> : null}

          {tab === "behavior" ? <View style={styles.panel}>
            <Toggle label="Auto-slide prayer cards" value={draft.autoSlide !== false} onChange={(autoSlide) => patch({ autoSlide })} />
            <Toggle label="Show seconds" value={Boolean(draft.showSeconds)} onChange={(showSeconds) => patch({ showSeconds })} />
            <Toggle label="Show English prayer name" value={draft.showEnglish !== false} onChange={(showEnglish) => patch({ showEnglish })} />
            <Toggle label="Show countdown" value={draft.showCountdown !== false} onChange={(showCountdown) => patch({ showCountdown })} />
            <Toggle label="Show Adhan control" value={draft.showAdhanControl !== false} onChange={(showAdhanControl) => patch({ showAdhanControl })} />
            <Toggle label="Show bottom prayer strip" value={draft.showBottomCards !== false} onChange={(showBottomCards) => patch({ showBottomCards })} />
            <Text style={styles.label}>Seconds between slides</Text><Stepper value={draft.slideSeconds ?? 9} min={3} max={60} onChange={(slideSeconds) => patch({ slideSeconds })} />
            <Text style={styles.label}>Lock on next prayer</Text><Stepper value={draft.lockMinutes ?? 5} min={1} max={30} onChange={(lockMinutes) => patch({ lockMinutes })} />
            <Text style={styles.label}>Bottom card height</Text><Stepper value={draft.bottomCardHeight ?? 106} min={60} max={150} step={4} onChange={(bottomCardHeight) => patch({ bottomCardHeight })} />
          </View> : null}

          {tab === "smart" ? <View style={styles.panel}>
            <Toggle label="Smart prayer approach stages" value={draft.smartPrayerStages !== false} onChange={(smartPrayerStages) => patch({ smartPrayerStages })} note="20 min subtle cue • 10 min stronger cue • 5 min lock • Adhan Now state" />
            <Toggle label="Ramadan mode for Maghrib" value={Boolean(draft.ramadanMode)} onChange={(ramadanMode) => patch({ ramadanMode })} note="Plays your Ramadan audio 3 times, then the normal Maghrib Adhan + dua." />
            <Toggle label="Automatic day/night brightness" value={Boolean(draft.autoBrightness)} onChange={(autoBrightness) => patch({ autoBrightness })} />
            <Text style={styles.label}>Day brightness %</Text><Stepper value={draft.dayBrightness ?? 85} min={10} max={100} step={5} onChange={(dayBrightness) => patch({ dayBrightness })} />
            <Text style={styles.label}>Night brightness %</Text><Stepper value={draft.nightBrightness ?? 25} min={5} max={80} step={5} onChange={(nightBrightness) => patch({ nightBrightness })} />
            <Toggle label="Burn-in protection" value={draft.burnInProtection !== false} onChange={(burnInProtection) => patch({ burnInProtection })} note="Gently shifts static wall elements by a few pixels over time." />
            <Toggle label="Night dim after Isha" value={Boolean(draft.nightDimAfterIsha)} onChange={(nightDimAfterIsha) => patch({ nightDimAfterIsha })} />
            <Toggle label="Lock local designer" value={Boolean(draft.designerLocked)} onChange={(designerLocked) => patch({ designerLocked })} note="Prevents accidental changes on the wall tablet; remote control still works." />
          </View> : null}

          {tab !== "status" ? <Pressable disabled={busy} onPress={() => void apply()} style={styles.applyButton}><Text style={styles.applyText}>{busy ? "Sending…" : "Apply to wall display"}</Text></Pressable> : null}
          <Pressable onPress={() => void unpair()} style={styles.unpair}><Text style={styles.unpairText}>Remove this paired display</Text></Pressable>
        </> : null}
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F4EA" }, header: { paddingTop: 50, paddingHorizontal: 18, paddingBottom: 14, backgroundColor: "#07503F", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { color: "#FFF", fontSize: 25, fontWeight: "900" }, subtitle: { color: "#D6E7E0", fontSize: 11, marginTop: 2 }, done: { backgroundColor: "#FFF", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 }, doneText: { color: "#07503F", fontWeight: "900" }, content: { padding: 16, paddingBottom: 60 }, pairCard: { backgroundColor: "#FFF", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#DDD4C2" }, section: { color: "#123E34", fontSize: 17, fontWeight: "900", marginBottom: 8 }, note: { color: "#6E7873", fontSize: 11, lineHeight: 16 }, pairRow: { flexDirection: "row", gap: 8, marginTop: 12 }, codeInput: { flex: 1, borderWidth: 1, borderColor: "#C9C1B2", borderRadius: 12, paddingHorizontal: 14, fontSize: 20, fontWeight: "900", letterSpacing: 3, backgroundColor: "#FFF" }, primaryButton: { backgroundColor: "#07503F", borderRadius: 12, paddingHorizontal: 20, justifyContent: "center" }, primaryText: { color: "#FFF", fontWeight: "900" }, deviceTabs: { gap: 8, paddingVertical: 14 }, deviceChip: { borderWidth: 1, borderColor: "#BDB6A9", backgroundColor: "#FFF", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }, deviceChipActive: { backgroundColor: "#07503F", borderColor: "#07503F" }, deviceChipText: { color: "#40534C", fontWeight: "800" }, deviceChipTextActive: { color: "#FFF" }, empty: { textAlign: "center", color: "#7E8582", marginVertical: 30 }, statusCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFF", borderRadius: 16, padding: 14 }, deviceName: { color: "#123E34", fontWeight: "900", fontSize: 18 }, online: { color: "#927B42", marginTop: 2, fontSize: 11 }, onlineNow: { color: "#16865F" }, refresh: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEE9DF", alignItems: "center", justifyContent: "center" }, tabs: { flexDirection: "row", gap: 4, marginTop: 12 }, tab: { flex: 1, backgroundColor: "#E9E3D8", borderRadius: 10, alignItems: "center", paddingVertical: 9 }, tabActive: { backgroundColor: "#07503F" }, tabText: { color: "#67746E", fontSize: 8, fontWeight: "900" }, tabTextActive: { color: "#FFF" }, panel: { marginTop: 12, backgroundColor: "#FFF", borderRadius: 18, padding: 14 }, statusGrid: { gap: 8, marginBottom: 18 }, statusItem: { color: "#40534C", fontSize: 13, fontWeight: "700" }, commandGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, command: { width: "48%", minHeight: 55, borderWidth: 1, borderColor: "#D7C9A0", backgroundColor: "#FFF8E7", borderRadius: 13, alignItems: "center", justifyContent: "center", padding: 8 }, commandTitle: { color: "#17483D", fontWeight: "900", fontSize: 12 }, block: { marginTop: 14 }, label: { color: "#365048", fontSize: 12, fontWeight: "900", marginTop: 14, marginBottom: 7 }, swatches: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, swatch: { width: 31, height: 31, borderRadius: 16, borderWidth: 1, borderColor: "#C8C8C8" }, swatchActive: { borderWidth: 3, borderColor: "#07503F" }, hexInput: { marginTop: 7, alignSelf: "flex-start", width: 115, borderWidth: 1, borderColor: "#D2CBC0", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: "#173F35" }, stepper: { flexDirection: "row", alignItems: "center", gap: 12 }, stepButton: { width: 40, height: 36, borderRadius: 10, backgroundColor: "#E9E4D9", alignItems: "center", justifyContent: "center" }, stepButtonText: { color: "#07503F", fontSize: 22, fontWeight: "900" }, stepValue: { minWidth: 45, textAlign: "center", color: "#173F35", fontWeight: "900" }, toggleRow: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E7E1D5" }, toggleCopy: { flex: 1, paddingRight: 12 }, toggleLabel: { color: "#23473D", fontWeight: "800", fontSize: 13 }, presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, preset: { borderWidth: 1, borderColor: "#D0C8BA", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, presetActive: { backgroundColor: "#E8D9A7", borderColor: "#C89A2C" }, presetText: { color: "#25483F", fontWeight: "800", textTransform: "capitalize" }, wideInput: { borderWidth: 1, borderColor: "#D2CBC0", borderRadius: 11, padding: 10, color: "#173F35" }, targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, target: { borderWidth: 1, borderColor: "#D3CCC0", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, targetActive: { backgroundColor: "#07503F", borderColor: "#07503F" }, targetText: { color: "#53655F", fontSize: 10, fontWeight: "800" }, targetTextActive: { color: "#FFF" }, fonts: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, font: { borderWidth: 1, borderColor: "#D5CEC2", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }, fontActive: { backgroundColor: "#E8D9A7", borderColor: "#C89A2C" }, fontText: { color: "#29493F", fontSize: 10, fontWeight: "700" }, applyButton: { marginTop: 16, backgroundColor: "#07503F", borderRadius: 14, paddingVertical: 14, alignItems: "center" }, applyText: { color: "#FFF", fontWeight: "900" }, unpair: { marginTop: 14, alignItems: "center", padding: 12 }, unpairText: { color: "#9E3B3B", fontWeight: "800" }
});
