import fs from "node:fs";
const path = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

source = source.replace('else if (landscape) body = <><View style={styles.grandTop}>', 'else if (landscape) body = <View style={styles.fill}><View style={styles.grandTop}>');
const brokenGrand = '<View style={styles.grandSide}><JumuahPanel /><AnnouncementPanel /></View></View><PrayerCards />;';
const fragmentGrand = '<View style={styles.grandSide}><JumuahPanel /><AnnouncementPanel /></View></View><PrayerCards /></>;';
const wrappedGrand = '<View style={styles.grandSide}><JumuahPanel /><AnnouncementPanel /></View></View><PrayerCards /></View>;';
if (source.includes(brokenGrand)) source = source.replace(brokenGrand, wrappedGrand);
if (source.includes(fragmentGrand)) source = source.replace(fragmentGrand, wrappedGrand);

const returnMarker = "\n\n  return <View style={[styles.screen, theme]}>";
if (!source.includes(returnMarker)) throw new Error("Missing Masjid TV return marker");
const functionText = `\n  const importScheduleFile = async () => {\n    try {\n      const [DocumentPicker, FileSystem] = await Promise.all([import("expo-document-picker"), import("expo-file-system/legacy")]);\n      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "application/json", "text/plain", "*/*"], copyToCacheDirectory: true, multiple: false });\n      if (result.canceled || !result.assets?.[0]?.uri) return;\n      const text = await FileSystem.readAsStringAsync(result.assets[0].uri);\n      const trimmed = text.trim();\n      if (!trimmed) throw new Error("The selected schedule file is empty.");\n      if (trimmed.startsWith("{")) {\n        const data = JSON.parse(trimmed);\n        update({ adhanByDate: data.adhanByDate || data.adhan || {}, iqamaByDate: data.iqamaByDate || data.iqama || {} });\n      } else {\n        update(csvToSchedule(trimmed));\n      }\n      Alert.alert("Schedule uploaded", result.assets[0].name + " was imported and saved for this mosque display.");\n    } catch (error) { Alert.alert("Schedule upload failed", String(error)); }\n  };\n`;
source = source.replace(returnMarker, functionText + returnMarker);

const uiMarker = '<Pressable onPress={importSchedule} style={styles.primary}><Text style={styles.primaryText}>Import & Save Schedule</Text></Pressable>';
if (!source.includes(uiMarker)) throw new Error("Missing schedule import button");
source = source.replace(uiMarker, '<Pressable onPress={() => void importScheduleFile()} style={styles.primary}><Text style={styles.primaryText}>Choose CSV / JSON Schedule File</Text></Pressable><Pressable onPress={importSchedule} style={styles.primary}><Text style={styles.primaryText}>Import Pasted Schedule</Text></Pressable>');

fs.writeFileSync(path, source);
console.log("Wrapped Grand Masjid layout and added mosque CSV/JSON schedule upload");
