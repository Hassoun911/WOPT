import type { ReactNode } from "react";
import TickerControl from "./TickerControl";
import SmartDisplayEditorEnhancer from "./SmartDisplayEditorEnhancer";
import LocalLogoAndScheduleImport from "./LocalLogoAndScheduleImport";
import ScheduleIntentEnhancer from "./ScheduleIntentEnhancer";
import YearScheduleManager from "./YearScheduleManager";
import PreviewLogoSync from "./PreviewLogoSync";
import DevicesScrollFix from "./DevicesScrollFix";
import IslamicCalendarControls from "./IslamicCalendarControls";
import PreviewFooterSync from "./PreviewFooterSync";

export default function DevicesLayout({children}:{children:ReactNode}){
  return <><DevicesScrollFix/><TickerControl/>{children}<SmartDisplayEditorEnhancer /><LocalLogoAndScheduleImport /><ScheduleIntentEnhancer /><YearScheduleManager /><PreviewLogoSync /><IslamicCalendarControls /><PreviewFooterSync /></>;
}
