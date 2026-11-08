"use client";
import { useEffect } from "react";

/** On phones, tapping a table card opens/closes it (taps on links, buttons and form fields work as usual). */
export function TableToggle() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (window.innerWidth >= 640) return;
      const el = e.target as HTMLElement;
      if (el.closest("a, button, input, select, textarea, label, form")) return;
      const tr = el.closest(".mtable tbody > tr");
      if (!tr || tr.querySelector(".mt-empty")) return;
      if (tr.hasAttribute("data-open")) tr.removeAttribute("data-open"); else tr.setAttribute("data-open", "");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
