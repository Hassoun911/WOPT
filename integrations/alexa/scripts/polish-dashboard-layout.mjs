import fs from 'node:fs';

const path = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(path, 'utf8');

const replacements = [
  ['  width: "18.4%",\n  height: "84dp",', '  width: "18.4%",\n  height: "92dp",'],
  ['fontSize: "14dp", fontWeight: 700, color:', 'fontSize: "13dp", fontWeight: 700, color:'],
  ['fontSize: "21dp", fontWeight: 700, color:', 'fontSize: "22dp", fontWeight: 700, color:'],
  ['height: "356dp",\n              marginTop: "10dp",', 'height: "334dp",\n              marginTop: "12dp",'],
  ['width: "66%",\n                  height: "356dp",', 'width: "65%",\n                  height: "334dp",'],
  ['width: "34%",\n                  height: "356dp",\n                  paddingLeft: "14dp",', 'width: "35%",\n                  height: "334dp",\n                  paddingLeft: "18dp",'],
  ['height: "136dp",', 'height: "130dp",'],
  ['height: "208dp",\n                      marginTop: "12dp",', 'height: "192dp",\n                      marginTop: "12dp",'],
  ['fontSize: "60dp", fontWeight: 700', 'fontSize: "56dp", fontWeight: 700'],
  ['fontSize: "31dp", fontWeight: 700, color: "#FFFFFF", paddingTop: "2dp"', 'fontSize: "30dp", fontWeight: 700, color: "#FFFFFF", paddingTop: "2dp"'],
  ['                      { type: "Text", text: "${hassounData.nextPrayer.timeUntil}", fontSize: "22dp", fontWeight: 600, color: "#D8EFE8", paddingTop: "3dp" },\n', ''],
  ['height: "84dp",\n              justifyContent: "spaceBetween",\n              marginTop: "10dp",', 'height: "92dp",\n              justifyContent: "spaceBetween",\n              marginTop: "18dp",'],
  ['fontSize: "12dp", fontStyle: "italic", color: "#6C837A", paddingTop: "8dp"', 'fontSize: "13dp", fontStyle: "italic", fontWeight: 600, color: "#59736A", paddingTop: "10dp"']
];

for (const [from, to] of replacements) {
  if (!text.includes(from)) throw new Error(`Dashboard polish anchor missing: ${from.slice(0, 70)}`);
  text = text.replace(from, to);
}

fs.writeFileSync(path, text);
console.log('Polished Hassoun Echo Show dashboard layout.');
