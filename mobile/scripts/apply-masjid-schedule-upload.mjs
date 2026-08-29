import fs from "node:fs";
const path = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const grandBlock = `  else if (landscape) body = (\n    <View style={styles.fill}>\n      <View style={styles.grandTop}>\n        <View>\n          <Text style={styles.mosqueName}>{settings.mosqueName}</Text>\n          <Text style={styles.location}>⌖ {props.locationLabel}</Text>\n        </View>\n        <Text style={styles.bigClock}>{clock(props.now, settings.showSeconds)}</Text>\n        <View style={styles.dateBlock}>\n          <Text style={styles.date}>{props.shortDate}</Text>\n          {settings.showHijri ? <Text style={styles.hijri}>{props.hijriDate}</Text> : null}\n        </View>\n      </View>\n      <View style={styles.grandCenter}>\n        <View style={styles.nextCard}>\n          <View>\n            <Text style={styles.nextKicker}>NEXT PRAYER</Text>\n            <Text style={styles.nextArabic}>{NAMES[nextPrayer].ar}</Text>\n            <Text style={styles.nextEnglish}>{NAMES[nextPrayer].en}</Text>\n          </View>\n          <View style={styles.nextRight}>\n            <Text style={styles.nextTime}>{formatPrayerTime(nextTime)}</Text>\n            {props.next ? <Text style={styles.countdown}>{countdown(props.next.secondsRemaining)} left</Text> : null}\n            <Text style={styles.nextIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text>\n          </View>\n        </View>\n        <View style={styles.grandSide}>\n          <JumuahPanel />\n          <AnnouncementPanel />\n        </View>\n      </View>\n      <PrayerCards />\n    </View>\n  );`;
const grandPattern = /  else if \(landscape\) body = [\s\S]*?\n  else if \(layout === "lobby"\)/;
if (!grandPattern.test(source)) throw new Error("Could not locate Grand Masjid landscape block");
source = source.replace(grandPattern, grandBlock + '\n  else if (layout === "lobby")');

const returnMarker = "\n\n  return <View style={[styles.screen, theme]}>";
if (!source.includes(returnMarker)) throw new Error("Missing Masjid TV return marker");
const functionText = `\n  const importScheduleFile = async () => {\n    try {\n      const [DocumentPicker, FileSystem] = await Promise.all([import("expo-document-picker"), import("expo-file-system/legacy")]);\n      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "application/json", "text/plain", "*/*"], copyToCacheDirectory: true, multiple: false });\n      if (result.canceled || !result.assets?.[0]?.uri) return;\n      const text = await FileSystem.readAsStringAsync(result.assets[0].uri);\n      const trimmed = text.trim();\n      if (!trimmed) throw new Error("The selected schedule file is empty.");\n      if (trimmed.startsWith("{")) {\n        const data = JSON.parse(trimmed);\n        update({ adhanByDate: data.adhanByDate || data.adhan || {}, iqamaByDate: data.iqamaByDate || data.iqama || {} });\n      } else {\n        update(csvToSchedule(trimmed));\n      }\n      Alert.alert("Schedule uploaded", result.assets[0].name + " was imported and saved for this mosque display.");\n    } catch (error) { Alert.alert("Schedule upload failed", String(error)); }\n  };\n`;
source = source.replace(returnMarker, functionText + returnMarker);

const uiMarker = '<Pressable onPress={importSchedule} style={styles.primary}><Text style={styles.primaryText}>Import & Save Schedule</Text></Pressable>';
if (!source.includes(uiMarker)) throw new Error("Missing schedule import button");
source = source.replace(uiMarker, '<Pressable onPress={() => void importScheduleFile()} style={styles.primary}><Text style={styles.primaryText}>Choose CSV / JSON Schedule File</Text></Pressable><Pressable onPress={importSchedule} style={styles.primary}><Text style={styles.primaryText}>Import Pasted Schedule</Text></Pressable>');

fs.writeFileSync(path, source);
console.log("Rebuilt Grand Masjid JSX and added mosque CSV/JSON schedule upload");
