import fs from "node:fs";

function patchFile(path, patches) {
  let src = fs.readFileSync(path, "utf8");
  for (const [label, before, after] of patches) {
    if (!src.includes(before)) throw new Error(`${path}: missing patch target ${label}`);
    src = src.replace(before, after);
  }
  fs.writeFileSync(path, src);
}

patchFile("mobile/src/quran/quranRendering.tsx", [
  [
    "book mode type",
    `export type QuranPageTheme = "paper" | "white" | "sepia" | "dark";`,
    `export type QuranPageTheme = "paper" | "white" | "sepia" | "dark";\nexport type QuranBookMode = "auto" | "single" | "spread";`
  ],
  [
    "appearance book mode",
    `  pageTheme: QuranPageTheme;\n  tajweed: boolean;`,
    `  pageTheme: QuranPageTheme;\n  bookMode: QuranBookMode;\n  tajweed: boolean;`
  ],
  [
    "default book mode",
    `  textColor: "#111111",\n  pageTheme: "paper",\n  tajweed: false`,
    `  textColor: "#111111",\n  pageTheme: "paper",\n  bookMode: "auto",\n  tajweed: false`
  ],
  [
    "settings subtitle",
    `{t("Font • Tajweed • size • spacing • colors", "الخط • التجويد • الحجم • التباعد • الألوان")}`,
    `{t("Font • Tajweed • book layout • size • colors", "الخط • التجويد • شكل الكتاب • الحجم • الألوان")}`
  ],
  [
    "insert book layout",
    `            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("PAGE STYLE", "لون الصفحة")}</Text>`,
    `            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("PAGE LAYOUT", "شكل الصفحات")}</Text>\n            <View style={styles.layoutRow}>\n              {([\n                ["auto", "◫", t("Auto", "تلقائي"), t("Open book on Fold/tablet", "كتاب مفتوح على الأجهزة القابلة للطي")],\n                ["single", "▯", t("Single", "صفحة"), t("One Mushaf page", "صفحة مصحف واحدة")],\n                ["spread", "▯▯", t("Open book", "كتاب مفتوح"), t("Two pages side by side", "صفحتان جنباً إلى جنب")]\n              ] as Array<[QuranBookMode, string, string, string]>).map(([mode, icon, label, note]) => (\n                <Pressable key={mode} onPress={() => setAppearance((previous) => ({ ...previous, bookMode: mode }))} style={[styles.layoutChoice, appearance.bookMode === mode && styles.layoutChoiceActive]}>\n                  <Text style={[styles.layoutIcon, appearance.bookMode === mode && styles.layoutIconActive]}>{icon}</Text>\n                  <Text style={[styles.layoutLabel, appearance.bookMode === mode && styles.layoutLabelActive]}>{label}</Text>\n                  <Text style={styles.layoutNote}>{note}</Text>\n                </Pressable>\n              ))}\n            </View>\n\n            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("PAGE STYLE", "لون الصفحة")}</Text>`
  ],
  [
    "book layout styles",
    `  themeRow: { flexDirection: "row", gap: 7, marginBottom: 15 },`,
    `  layoutRow: { flexDirection: "row", gap: 7, marginBottom: 15 },\n  layoutChoice: { flex: 1, minHeight: 92, borderRadius: 16, borderWidth: 1, borderColor: "#e0ddd6", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 8 },\n  layoutChoiceActive: { borderColor: "#0b7a5d", backgroundColor: "#edf6f2" },\n  layoutIcon: { color: "#6c7974", fontSize: 23, fontWeight: "900" },\n  layoutIconActive: { color: "#0b7a5d" },\n  layoutLabel: { color: "#52635d", fontSize: 9, fontWeight: "900", marginTop: 5, textAlign: "center" },\n  layoutLabelActive: { color: "#0b654f" },\n  layoutNote: { color: "#929a96", fontSize: 7, lineHeight: 10, textAlign: "center", marginTop: 3 },\n  themeRow: { flexDirection: "row", gap: 7, marginBottom: 15 },`
  ]
]);

patchFile("mobile/App.tsx", [
  [
    "hide app nav in Quran",
    `      <View style={styles.bottomNav}>\n        {navItems.map((item) => {\n          const active = activeTab === item.tab;\n          return (\n            <Pressable\n              key={item.tab}\n              onPress={() => setActiveTab(item.tab)}\n              style={[styles.navItem, active && styles.navItemActive]}\n            >\n              <Text style={[styles.navEmoji, active && styles.navEmojiActive]}>{item.emoji}</Text>\n              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{locale === "ar" ? item.ar : item.en}</Text>\n            </Pressable>\n          );\n        })}\n      </View>`,
    `      {activeTab !== "quran" ? (\n        <View style={styles.bottomNav}>\n          {navItems.map((item) => {\n            const active = activeTab === item.tab;\n            return (\n              <Pressable\n                key={item.tab}\n                onPress={() => setActiveTab(item.tab)}\n                style={[styles.navItem, active && styles.navItemActive]}\n              >\n                <Text style={[styles.navEmoji, active && styles.navEmojiActive]}>{item.emoji}</Text>\n                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{locale === "ar" ? item.ar : item.en}</Text>\n              </Pressable>\n            );\n          })}\n        </View>\n      ) : null}`
  ]
]);

patchFile("mobile/app.config.ts", [
  ["version", `  version: "0.3.5",`, `  version: "0.3.6",`],
  ["version code", `    versionCode: 8,`, `    versionCode: 9,`]
]);

patchFile(".github/workflows/android-debug.yml", [
  ["apk filename", `WOPT-native-quran-v0.3.5.apk`, `WOPT-native-quran-v0.3.6.apk`],
  ["artifact name", `wopt-native-quran-v0.3.5-`, `wopt-native-quran-v0.3.6-`]
]);

console.log("Finalized Quran V3: Quran-only dock, book layout modes, v0.3.6 build metadata.");
