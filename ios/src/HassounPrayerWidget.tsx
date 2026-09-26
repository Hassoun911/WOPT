import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type HassounPrayerWidgetProps = {
  locale: "en" | "ar";
  location: string;
  nextPrayer: string;
  nextTime: string;
  countdown: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

const HassounPrayerWidgetView = (props: HassounPrayerWidgetProps, environment: WidgetEnvironment) => {
  "widget";
  const isArabic = props.locale === "ar";
  const nextLabel = isArabic ? "الصلاة القادمة" : "NEXT PRAYER";
  const locationLabel = props.location || (isArabic ? "موقع GPS" : "GPS location");

  if (environment.widgetFamily === "accessoryInline") {
    return <Text>{props.nextPrayer} · {props.nextTime}</Text>;
  }

  if (environment.widgetFamily === "accessoryCircular") {
    return (
      <VStack spacing={1} alignment="center">
        <Text modifiers={[font({ size: 10, weight: "bold" })]}>{props.nextPrayer}</Text>
        <Text modifiers={[font({ size: 13, weight: "bold" })]}>{props.nextTime}</Text>
      </VStack>
    );
  }

  if (environment.widgetFamily === "accessoryRectangular") {
    return (
      <VStack spacing={2} alignment="leading">
        <Text modifiers={[font({ size: 11, weight: "bold" })]}>{props.nextPrayer} · {props.nextTime}</Text>
        <Text modifiers={[font({ size: 10 })]}>{props.countdown}</Text>
        <Text modifiers={[font({ size: 9 })]}>{locationLabel}</Text>
      </VStack>
    );
  }

  if (environment.widgetFamily === "systemSmall") {
    return (
      <VStack spacing={5} alignment="leading" modifiers={[padding({ all: 4 })]}>
        <Text modifiers={[font({ size: 10, weight: "bold" }), foregroundStyle("#B88B2D")]}>{nextLabel}</Text>
        <Text modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle("#0B654F")]}>{props.nextPrayer}</Text>
        <Text modifiers={[font({ size: 18, weight: "bold" })]}>{props.nextTime}</Text>
        <Text modifiers={[font({ size: 11 })]}>{props.countdown}</Text>
        <Text modifiers={[font({ size: 9 })]}>{locationLabel}</Text>
      </VStack>
    );
  }

  return (
    <VStack spacing={7} alignment="leading" modifiers={[padding({ all: 5 })]}>
      <HStack spacing={8} alignment="center">
        <VStack spacing={2} alignment="leading">
          <Text modifiers={[font({ size: 10, weight: "bold" }), foregroundStyle("#B88B2D")]}>{nextLabel}</Text>
          <Text modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle("#0B654F")]}>{props.nextPrayer}</Text>
        </VStack>
        <Spacer />
        <VStack spacing={2} alignment="trailing">
          <Text modifiers={[font({ size: 19, weight: "bold" })]}>{props.nextTime}</Text>
          <Text modifiers={[font({ size: 10 })]}>{props.countdown}</Text>
        </VStack>
      </HStack>
      <HStack spacing={8} alignment="center">
        <VStack spacing={1} alignment="center"><Text modifiers={[font({ size: 9, weight: "bold" })]}>Fajr</Text><Text modifiers={[font({ size: 10 })]}>{props.fajr}</Text></VStack>
        <Spacer />
        <VStack spacing={1} alignment="center"><Text modifiers={[font({ size: 9, weight: "bold" })]}>Dhuhr</Text><Text modifiers={[font({ size: 10 })]}>{props.dhuhr}</Text></VStack>
        <Spacer />
        <VStack spacing={1} alignment="center"><Text modifiers={[font({ size: 9, weight: "bold" })]}>Asr</Text><Text modifiers={[font({ size: 10 })]}>{props.asr}</Text></VStack>
        <Spacer />
        <VStack spacing={1} alignment="center"><Text modifiers={[font({ size: 9, weight: "bold" })]}>Maghrib</Text><Text modifiers={[font({ size: 10 })]}>{props.maghrib}</Text></VStack>
        <Spacer />
        <VStack spacing={1} alignment="center"><Text modifiers={[font({ size: 9, weight: "bold" })]}>Isha</Text><Text modifiers={[font({ size: 10 })]}>{props.isha}</Text></VStack>
      </HStack>
      <Text modifiers={[font({ size: 9 })]}>{locationLabel}</Text>
    </VStack>
  );
};

export default createWidget<HassounPrayerWidgetProps>("HassounPrayerWidget", HassounPrayerWidgetView);
