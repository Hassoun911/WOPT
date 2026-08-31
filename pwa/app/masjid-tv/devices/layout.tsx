import type { ReactNode } from "react";
import TickerControl from "./TickerControl";
import SmartDisplayEditorEnhancer from "./SmartDisplayEditorEnhancer";
import LocalLogoAndScheduleImport from "./LocalLogoAndScheduleImport";

export default function DevicesLayout({children}:{children:ReactNode}){
  return <><TickerControl/>{children}<SmartDisplayEditorEnhancer /><LocalLogoAndScheduleImport /></>;
}
