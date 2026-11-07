import type { Metadata } from "next";
import { I18nProvider } from "@/components/i18n";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Perkly Portal", template: "%s · Perkly" },
  description: "Perkly merchant and team portal",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="h-full">
      <body className="min-h-full"><I18nProvider lang={lang}>{children}</I18nProvider></body>
    </html>
  );
}
