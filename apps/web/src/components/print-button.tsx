"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="perk-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white">🖨️ Print</button>;
}
