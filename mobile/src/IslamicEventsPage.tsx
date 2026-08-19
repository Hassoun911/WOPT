import FeatureUnavailable from "./FeatureUnavailable";
import IslamicEventsPageCore from "./IslamicEventsPageCore";
import { useRemoteControl } from "./remoteControlStore";

type Props = { locale: "en" | "ar"; todayKey: string; onBack: () => void };

export default function IslamicEventsPage(props: Props) {
  const control = useRemoteControl();
  if (!control.features.islamicEvents) {
    return (
      <FeatureUnavailable
        locale={props.locale}
        titleEn="Islamic Events are temporarily unavailable"
        titleAr="المناسبات الإسلامية غير متاحة مؤقتاً"
        onBack={props.onBack}
      />
    );
  }
  return <IslamicEventsPageCore {...props} />;
}
