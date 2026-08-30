import fs from "node:fs";

const path = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Missing source for ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  '  Alert,\n  Modal,\n',
  '  Alert,\n  Image,\n  Modal,\n',
  'Image import'
);

replaceOnce(
  '  mosqueName: string;\n  mosqueSubtitle: string;\n',
  '  mosqueName: string;\n  mosqueSubtitle: string;\n  mosqueLogoUri: string;\n',
  'mosque logo settings type'
);

replaceOnce(
  '  mosqueName: "Your Masjid Name",\n  mosqueSubtitle: "Prayer • Community • Connection",\n',
  '  mosqueName: "Your Masjid Name",\n  mosqueSubtitle: "Prayer • Community • Connection",\n  mosqueLogoUri: "",\n',
  'mosque logo default'
);

const updateAnchor = '  const updateIqama = (prayer: PrayerKey, value: string) => setSettings((current) => ({ ...current, defaultIqama: { ...current.defaultIqama, [prayer]: value } }));\n';
replaceOnce(
  updateAnchor,
  updateAnchor + `\n  const chooseMasjidLogo = async () => {\n    try {\n      const [DocumentPicker, FileSystem] = await Promise.all([import("expo-document-picker"), import("expo-file-system/legacy")]);\n      const result = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true, multiple: false });\n      if (result.canceled || !result.assets?.[0]?.uri) return;\n      const sourceUri = result.assets[0].uri;\n      const originalName = result.assets[0].name || "masjid-logo.png";\n      const extension = (originalName.split(".").pop() || "png").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "png";\n      const destination = \`${'${FileSystem.documentDirectory}'}masjid-logo.\${extension}\`;\n      try { await FileSystem.deleteAsync(destination, { idempotent: true }); } catch {}\n      await FileSystem.copyAsync({ from: sourceUri, to: destination });\n      update({ mosqueLogoUri: destination });\n      Alert.alert("Masjid logo saved", "The logo will remain on this TV after restarts.");\n    } catch (error) {\n      Alert.alert("Logo upload failed", String(error));\n    }\n  };\n`,
  'persistent mosque logo picker'
);

replaceOnce(
  '<View><Text style={styles.mosqueName}>{settings.mosqueName}</Text><Text style={styles.location}>⌖ {displayLocationLabel}</Text></View>',
  '<View style={styles.mosqueBrand}>{settings.mosqueLogoUri ? <Image source={{ uri: settings.mosqueLogoUri }} style={styles.mosqueLogo} resizeMode="contain" /> : null}<View><Text style={styles.mosqueName}>{settings.mosqueName}</Text><Text style={styles.location}>⌖ {displayLocationLabel}</Text></View></View>',
  'landscape mosque branding'
);

replaceOnce(
  '<View style={styles.portraitHeader}><Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text><Text style={styles.location}>⌖ {displayLocationLabel}</Text><Text style={styles.date}>{props.shortDate}</Text></View>',
  '<View style={styles.portraitHeader}>{settings.mosqueLogoUri ? <Image source={{ uri: settings.mosqueLogoUri }} style={styles.mosqueLogoPortrait} resizeMode="contain" /> : null}<Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text><Text style={styles.location}>⌖ {displayLocationLabel}</Text><Text style={styles.date}>{props.shortDate}</Text></View>',
  'portrait mosque branding'
);

replaceOnce(
  '<Text style={styles.adminLabel}>Mosque name</Text><TextInput value={settings.mosqueName} onChangeText={(mosqueName) => update({ mosqueName })} style={styles.input} />\n              <Text style={styles.adminLabel}>Footer / subtitle</Text>',
  '<Text style={styles.adminLabel}>Mosque name</Text><TextInput value={settings.mosqueName} onChangeText={(mosqueName) => update({ mosqueName })} style={styles.input} />\n              <Text style={styles.adminLabel}>Masjid logo</Text>\n              {settings.mosqueLogoUri ? <View style={styles.logoAdminRow}><Image source={{ uri: settings.mosqueLogoUri }} style={styles.logoPreview} resizeMode="contain" /><Pressable style={styles.secondary} onPress={() => update({ mosqueLogoUri: "" })}><Text>Remove logo</Text></Pressable></View> : <Text style={styles.help}>Upload the masjid logo. PNG or JPG with a transparent or simple background works best.</Text>}\n              <Pressable style={styles.primary} onPress={() => void chooseMasjidLogo()}><Text style={styles.primaryText}>{settings.mosqueLogoUri ? "Replace Masjid Logo" : "Upload Masjid Logo"}</Text></Pressable>\n              <Text style={styles.adminLabel}>Footer / subtitle</Text>',
  'masjid logo admin controls'
);

replaceOnce(
  'grandTop: { minHeight: 150, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, mosqueName: { color: "#F6D675", fontWeight: "900", fontSize: 30 },',
  'grandTop: { minHeight: 150, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, mosqueBrand: { flexDirection: "row", alignItems: "center", gap: 14 }, mosqueLogo: { width: 78, height: 78 }, mosqueLogoPortrait: { width: 96, height: 96, marginBottom: 8 }, logoAdminRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 10 }, logoPreview: { width: 88, height: 88, backgroundColor: "#FFFFFF10", borderRadius: 12 }, mosqueName: { color: "#F6D675", fontWeight: "900", fontSize: 30 },',
  'mosque logo styles'
);

fs.writeFileSync(path, source);
console.log("Applied persistent Masjid logo upload and display support");
