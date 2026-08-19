import type { ComponentProps } from "react";
import FeatureUnavailable from "../FeatureUnavailable";
import { useRemoteControl } from "../remoteControlStore";
import SmartMemorizeCore from "./SmartMemorizeCore";

type Props = ComponentProps<typeof SmartMemorizeCore>;

export default function SmartMemorize(props: Props) {
  const control = useRemoteControl();
  if (!control.features.memorize || !control.quran.memorizeEnabled) {
    return (
      <FeatureUnavailable
        locale={props.locale}
        titleEn="Smart Memorize is temporarily unavailable"
        titleAr="الحفظ الذكي غير متاح مؤقتاً"
        onBack={props.onBack}
      />
    );
  }
  return <SmartMemorizeCore {...props} />;
}
