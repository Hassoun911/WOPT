import fs from "node:fs";

const path = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Missing source for ${label}`);
  source = source.replace(from, to);
}

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

replaceOnce(
  '<View style={styles.footer}><Text style={styles.footerText}>{settings.mosqueSubtitle}</Text><Text style={styles.footerStatus}>{remoteOnline ? "● Connected" : "○ Offline-safe"}</Text></View>',
  '<View style={styles.footer}><Text style={styles.footerText}>{settings.mosqueSubtitle}</Text><Text style={styles.footerCopyright}>© Hassoun</Text><Text style={styles.footerStatus}>{remoteOnline ? "● Connected" : "○ Offline-safe"}</Text></View>',
  'footer copyright'
);

replaceOnce(
  'footer: { height: 38, borderTopWidth: 1, borderTopColor: "#78672E", paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, footerText: { color: "#E4D49C", fontSize: 15 }, footerStatus: { color: "#8CD7B9", fontSize: 13 },',
  'footer: { height: 38, borderTopWidth: 1, borderTopColor: "#78672E", paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, footerText: { color: "#E4D49C", fontSize: 15 }, footerCopyright: { color: "#B8AB7E", fontSize: 11 }, footerStatus: { color: "#8CD7B9", fontSize: 13 },',
  'footer copyright style'
);

fs.writeFileSync(path, source);
console.log("Applied click-clock Masjid setup and mosque-first branding with Hassoun copyright");
