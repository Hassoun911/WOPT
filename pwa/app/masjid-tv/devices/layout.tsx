import type { ReactNode } from "react";
import TickerControl from "./TickerControl";

export default function DevicesLayout({children}:{children:ReactNode}){
  return <><TickerControl/>{children}</>;
}
