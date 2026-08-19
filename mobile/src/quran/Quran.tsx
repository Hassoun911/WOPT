import FeatureUnavailable from "../FeatureUnavailable";
import { useRemoteControl } from "../remoteControlStore";
import QuranV3 from "./QuranV3";
import type { QuranLocale } from "./quranData";

type Props = {
  locale: QuranLocale;
  onBackHome: () => void;
  onAppNavVisibilityChange?: (visible: boolean) => void;
  onLocalAudioSurfaceChange?: (visible: boolean) => void;
};

export default function Quran(props: Props) {
  const control = useRemoteControl();
  if (!control.features.quran || !control.quran.readerEnabled) {
    return (
      <FeatureUnavailable
        locale={props.locale}
        titleEn="Qur’an is temporarily unavailable"
        titleAr="القرآن غير متاح مؤقتاً"
        onBack={props.onBackHome}
      />
    );
  }
  return <QuranV3 {...props} />;
}
