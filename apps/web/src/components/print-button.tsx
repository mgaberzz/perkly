"use client";
import { Icon } from "@/components/icons";
export function PrintButton() {
  return <button onClick={() => window.print()} className="perk-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white"><Icon name="printer" size={16} className="me-1.5 inline-block align-[-2px]" />Print</button>;
}
