import type { ReactNode } from "react";
import TickerControl from "./TickerControl";
import SmartDisplayEditorEnhancer from "./SmartDisplayEditorEnhancer";
import LocalLogoAndScheduleImport from "./LocalLogoAndScheduleImport";
import PreviewLogoSync from "./PreviewLogoSync";
import DevicesScrollFix from "./DevicesScrollFix";

export default function DevicesLayout({children}:{children:ReactNode}){
  return <><DevicesScrollFix/><TickerControl/>{children}<SmartDisplayEditorEnhancer /><LocalLogoAndScheduleImport /><PreviewLogoSync /></>;
}
