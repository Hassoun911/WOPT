import fs from "node:fs";

const path = new URL("../src/WallRemoteController.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const oldButton = '{tab !== "status" ? <Pressable disabled={busy} onPress={() => void apply()} style={styles.applyButton}><Text style={styles.applyText}>{busy ? "Sending…" : "Apply to wall display"}</Text></Pressable> : null}';
const expectedButton = '{tab !== "status" ? <Pressable disabled={busy} onPress={() => void apply()} style={styles.saveButton}><Text style={styles.saveText}>Apply changes</Text></Pressable> : null}';
if (source.includes(oldButton)) source = source.replace(oldButton, expectedButton);
else if (!source.includes(expectedButton) && !source.includes('Changes apply automatically')) throw new Error('Could not prepare remote apply button');

const oldStyles = 'applyButton: { marginTop: 16, backgroundColor: "#07503F", borderRadius: 14, paddingVertical: 14, alignItems: "center" }, applyText: { color: "#FFF", fontWeight: "900" }';
const newStyles = 'saveButton: { marginTop: 16, backgroundColor: "#07503F", borderRadius: 14, paddingVertical: 14, alignItems: "center" }, saveText: { color: "#FFF", fontWeight: "900" }';
if (source.includes(oldStyles)) source = source.replace(oldStyles, newStyles);

fs.writeFileSync(path, source);
console.log('Prepared remote editor for instant-apply patch');
