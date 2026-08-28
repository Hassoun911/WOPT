import fs from "node:fs";

const appPath = new URL("../App.tsx", import.meta.url);
let source = fs.readFileSync(appPath, "utf8");

const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) {
    if (source.includes(to)) return;
    throw new Error(`Missing expected source for ${label}`);
  }
  source = source.replace(from, to);
};

replaceOnce(
  '  View\n} from "react-native";',
  '  View,\n  useWindowDimensions\n} from "react-native";',
  "useWindowDimensions import"
);

replaceOnce(
  'import HomePrayerPanel from "./src/HomePrayerPanel";\n',
  'import HomePrayerPanel from "./src/HomePrayerPanel";\nimport TabletWallPrayerDisplay from "./src/TabletWallPrayerDisplay";\n',
  "tablet wall component import"
);

replaceOnce(
  '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n',
  '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();\n  const isPortraitWallTablet = activeTab === "home" && viewportWidth >= 600 && viewportHeight > viewportWidth;\n',
  "tablet portrait detection"
);

replaceOnce(
  '  const homeScreen = (\n',
  '  const phoneHomeScreen = (\n',
  "phone home screen rename"
);

replaceOnce(
  '\n  const alertsScreen = (\n',
  `\n  const homeScreen = isPortraitWallTablet ? (\n    <TabletWallPrayerDisplay\n      locale={locale}\n      now={now}\n      shortDate={shortDate}\n      hijriDate={hijriDate}\n      today={today}\n      next={next}\n      preferences={phoneAlertPreferences}\n      onTogglePrayer={(prayer) => void togglePrayerAudio(prayer)}\n      onOpenQibla={() => setActiveTab("qibla")}\n    />\n  ) : phoneHomeScreen;\n\n  const alertsScreen = (\n`,
  "tablet wall home selection"
);

fs.writeFileSync(appPath, source);
console.log("Applied portrait tablet wall Adhan display");
