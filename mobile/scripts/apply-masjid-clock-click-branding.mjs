import fs from "node:fs";

const path = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Missing source for ${label}`);
  source = source.replace(from, to);
}

// Support a mosque-owned logo on the TV.
replaceOnce(
  '  Alert,\n  Modal,',
  '  Alert,\n  Image,\n  Modal,',
  'Image import'
);
replaceOnce(
  '  mosqueSubtitle: string;\n',
  '  mosqueSubtitle: string;\n  masjidLogoUri: string;\n',
  'masjid logo settings field'
);
replaceOnce(
  '  mosqueSubtitle: "Prayer • Community • Connection",\n',
  '  mosqueSubtitle: "Prayer • Community • Connection",\n  masjidLogoUri: "",\n',
  'masjid logo default'
);

// Remove the old long-press-anywhere trigger.
replaceOnce(
  '<Pressable onLongPress={() => setAdminOpen(true)} delayLongPress={900} style={styles.layoutFill}>{body}</Pressable>',
  '<View style={styles.layoutFill}>{body}</View>',
  'old full-screen long-press admin trigger'
);

// Make every main clock a normal click/tap/TV-select target.
for (const styleName of ["bigClock", "portraitClock", "minimalClock"]) {
  const from = `<Text style={styles.${styleName}}>{displayClock(props.now, settings.showSeconds)}</Text>`;
  const to = `<Pressable onPress={() => setAdminOpen(true)} accessibilityRole="button" accessibilityLabel="Open masjid setup"><Text style={styles.${styleName}}>{displayClock(props.now, settings.showSeconds)}</Text></Pressable>`;
  source = source.split(from).join(to);
}

// Mosque name is the primary TV branding. Hassoun remains only as a small copyright mark.
source = source.replace('mosqueName: "Hassoun Masjid",', 'mosqueName: "Your Masjid Name",');
source = source.replace('settingsRef.current.mosqueName || "Hassoun Masjid TV"', 'settingsRef.current.mosqueName || "Masjid TV"');

// Render the mosque logo beside the mosque name wherever the mosque name is shown.
source = source.replace(
  '<Text style={styles.mosqueName}>{settings.mosqueName}</Text>',
  '<View style={styles.brandRow}>{settings.masjidLogoUri ? <Image source={{ uri: settings.masjidLogoUri }} style={styles.masjidLogo} resizeMode="contain" /> : null}<Text style={styles.mosqueName}>{settings.mosqueName}</Text></View>'
);
source = source.split('<Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text>').join(
  '<View style={styles.brandRowPortrait}>{settings.masjidLogoUri ? <Image source={{ uri: settings.masjidLogoUri }} style={styles.masjidLogoPortrait} resizeMode="contain" /> : null}<Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text></View>'
);

// Local TV logo upload, persisted in the app document directory.
const functionAnchor = '  const addJumuah = () => setSettings((current) => ({ ...current, jumuah: [...current.jumuah, { id: `j${Date.now()}`, time: "", label: `Jumu’ah ${current.jumuah.length + 1}` }] }));\n';
if (!source.includes('const chooseMasjidLogo = async () =>')) {
  if (!source.includes(functionAnchor)) throw new Error('Missing logo function anchor');
  source = source.replace(functionAnchor, `  const chooseMasjidLogo = async () => {\n    try {\n      const [DocumentPicker, FileSystem] = await Promise.all([import("expo-document-picker"), import("expo-file-system/legacy")]);\n      const result = await DocumentPicker.getDocumentAsync({ type: ["image/png", "image/jpeg", "image/webp", "image/*"], copyToCacheDirectory: true, multiple: false });\n      if (result.canceled || !result.assets?.[0]?.uri) return;\n      const asset = result.assets[0];\n      const rawExt = (asset.name || "logo.png").split(".").pop()?.toLowerCase() || "png";\n      const ext = ["png", "jpg", "jpeg", "webp"].includes(rawExt) ? rawExt : "png";\n      const target = \`${'${'}FileSystem.documentDirectory}masjid-logo.${'${'}ext}\`;\n      await FileSystem.copyAsync({ from: asset.uri, to: target });\n      update({ masjidLogoUri: target });\n      Alert.alert("Masjid logo saved", "The logo will now appear beside the mosque name on this display.");\n    } catch (error) { Alert.alert("Logo upload failed", String(error)); }\n  };\n\n${functionAnchor}`);
}

replaceOnce(
  '<Text style={styles.adminLabel}>Mosque name</Text><TextInput value={settings.mosqueName} onChangeText={(mosqueName) => update({ mosqueName })} style={styles.input} />',
  '<Text style={styles.adminLabel}>Mosque name</Text><TextInput value={settings.mosqueName} onChangeText={(mosqueName) => update({ mosqueName })} style={styles.input} /><Text style={styles.adminLabel}>Masjid logo</Text><View style={styles.logoAdminRow}>{settings.masjidLogoUri ? <Image source={{ uri: settings.masjidLogoUri }} style={styles.logoPreview} resizeMode="contain" /> : <Text style={styles.help}>No logo uploaded</Text>}<Pressable style={styles.smallButton} onPress={() => void chooseMasjidLogo()}><Text style={styles.smallButtonText}>Choose Logo</Text></Pressable>{settings.masjidLogoUri ? <Pressable style={styles.smallButton} onPress={() => update({ masjidLogoUri: "" })}><Text style={styles.smallButtonText}>Remove</Text></Pressable> : null}</View><Text style={styles.adminLabel}>Or logo image URL</Text><TextInput value={settings.masjidLogoUri.startsWith("http") ? settings.masjidLogoUri : ""} onChangeText={(masjidLogoUri) => update({ masjidLogoUri })} placeholder="https://.../logo.png" autoCapitalize="none" style={styles.input} />',
  'masjid logo admin controls'
);

replaceOnce(
  '<View style={styles.footer}><Text style={styles.footerText}>{settings.mosqueSubtitle}</Text><Text style={styles.footerStatus}>{remoteOnline ? "● Connected" : "○ Offline-safe"}</Text></View>',
  '<View style={styles.footer}><Text style={styles.footerText}>{settings.mosqueSubtitle}</Text><Text style={styles.footerCopyright}>© Hassoun</Text><Text style={styles.footerStatus}>{remoteOnline ? "● Connected" : "○ Offline-safe"}</Text></View>',
  'footer copyright'
);

replaceOnce(
  'footer: { height: 38, borderTopWidth: 1, borderTopColor: "#78672E", paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, footerText: { color: "#E4D49C", fontSize: 15 }, footerStatus: { color: "#8CD7B9", fontSize: 13 },',
  'footer: { height: 38, borderTopWidth: 1, borderTopColor: "#78672E", paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, footerText: { color: "#E4D49C", fontSize: 15 }, footerCopyright: { color: "#B8AB7E", fontSize: 11 }, footerStatus: { color: "#8CD7B9", fontSize: 13 }, brandRow: { flexDirection: "row", alignItems: "center", gap: 12 }, brandRowPortrait: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, masjidLogo: { width: 62, height: 62 }, masjidLogoPortrait: { width: 72, height: 72 }, logoAdminRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }, logoPreview: { width: 80, height: 80, borderRadius: 10, backgroundColor: "#FFFFFF" },',
  'footer and logo styles'
);

fs.writeFileSync(path, source);
console.log("Applied click-clock setup, mosque-first branding, Hassoun copyright, and masjid logo upload");
