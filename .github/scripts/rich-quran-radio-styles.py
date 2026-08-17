from pathlib import Path

path = Path('mobile/src/quran/QuranV3.tsx')
text = path.read_text()
marker = '  radioContent: {'
start = text.index(marker)
end = text.index('},', start) + 2
styles = '''  radioContent: { paddingBottom: 34 },
  radioStudioHero: { margin: 14, marginBottom: 8, padding: 16, borderRadius: 28, backgroundColor: "#103f35", borderWidth: 1, borderColor: "#285b4e", shadowColor: "#000", shadowOpacity: .16, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  radioStudioTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  radioStudioBadge: { width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,.11)", alignItems: "center", justifyContent: "center" },
  radioStudioBadgeIcon: { fontSize: 25 },
  radioStudioEyebrow: { color: "#e0bd68", fontSize: 7, fontWeight: "900", letterSpacing: 1.2 },
  radioStudioTitle: { color: "#fff", fontSize: 17, fontWeight: "900", marginTop: 3 },
  radioStudioMeta: { color: "#b8d2c9", fontSize: 8, marginTop: 3 },
  radioHeroStop: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,.10)", alignItems: "center", justifyContent: "center" },
  radioHeroStopText: { color: "#f1d7cf", fontSize: 11, fontWeight: "900" },
  radioProgressTrack: { height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.13)", overflow: "hidden", marginTop: 15 },
  radioProgressFill: { height: 4, borderRadius: 4, backgroundColor: "#e1bd66" },
  radioTimeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  radioTimeText: { color: "#a9c8be", fontSize: 7, fontWeight: "800" },
  radioTransportRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 9 },
  radioTransportSide: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  radioTransportArrow: { color: "#fff", fontSize: 26, lineHeight: 28, fontWeight: "700" },
  radioTransportMini: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  radioTransportMiniText: { color: "#dceae5", fontSize: 8, fontWeight: "900" },
  radioTransportMain: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: .18, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  radioTransportMainText: { color: "#0b654f", fontSize: 19, fontWeight: "900" },
  radioQuickRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 11 },
  radioQuickPill: { minHeight: 31, borderRadius: 16, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  radioQuickPillActive: { backgroundColor: "#e4c46f", borderColor: "#e4c46f" },
  radioQuickText: { color: "#d8e7e1", fontSize: 7, fontWeight: "900" },
  radioQuickTextActive: { color: "#173f35" },
  radioQueuePill: { minHeight: 31, borderRadius: 16, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.12)" },
  radioQueueText: { color: "#b9d4ca", fontSize: 7, fontWeight: "900" },
  radioSectionHead: { marginHorizontal: 16, marginTop: 14, marginBottom: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  radioSectionKicker: { color: "#a17c36", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  radioSectionTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 2 },
  radioSectionHint: { fontSize: 20 },
  radioStudioCard: { marginHorizontal: 14, marginTop: 11, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", padding: 14, shadowColor: "#493d2e", shadowOpacity: .045, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  radioContinuousCard: { backgroundColor: "#fbfaf6", borderColor: "#ded7c9" },
  radioCardIconWrap: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#e9f4ef", alignItems: "center", justifyContent: "center" },
  radioMoonWrap: { backgroundColor: "#f4edda" },
  radioCardIconText: { color: "#0b654f", fontSize: 17, fontWeight: "900" },
  radioStudioCardTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" },
  radioStudioCardMeta: { color: "#7f8c87", fontSize: 8, lineHeight: 12, marginTop: 3 },
  radioPillActions: { flexDirection: "row", gap: 7, marginTop: 11 },
  radioPrimaryPill: { flex: 1.2, minHeight: 46, borderRadius: 16, backgroundColor: "#0b654f", flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
  radioPrimaryPillIcon: { color: "#fff", fontSize: 14, fontWeight: "900" },
  radioPrimaryPillText: { color: "#fff", fontSize: 8, fontWeight: "900", textAlign: "center" },
  radioGlassPill: { flex: 1, minHeight: 46, borderRadius: 16, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  radioGlassPillText: { color: "#245044", fontSize: 8, fontWeight: "900", textAlign: "center" },
  radioEmptyQueue: { minHeight: 88, marginTop: 10, borderRadius: 18, backgroundColor: "#f7f6f2", borderWidth: 1, borderColor: "#eeebe4", alignItems: "center", justifyContent: "center" },
  radioEmptyQueueIcon: { fontSize: 22, opacity: .65 },
  radioEmptyQueueText: { color: "#8c9691", fontSize: 8, fontWeight: "800", marginTop: 4 },'''
text = text[:start] + styles + text[end:]
path.write_text(text)
print('Rich Quran Radio styles integrated')
