"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type ActionState } from "@/lib/types";

const str = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max);
const url = (s: string) => (!s ? null : /^https?:\/\//i.test(s) ? s : `https://${s}`);

/** Public "Join Perkly" form. Anyone can submit: checked here, then again in submit_merchant_application (database). */
export async function submitApplication(_: ActionState, fd: FormData): Promise<ActionState> {
  // Bots fill every field, people never see this one
  if (str(fd, "company_fax")) redirect("/apply?sent=1");
  // …and bots submit instantly
  const started = Number(str(fd, "started"));
  if (!started || Date.now() - started < 3000) return { error: "Please check your details and try again." };

  const row = {
    business_name: str(fd, "business_name", 120),
    category: str(fd, "category", 40),
    channel: ["in_store", "online", "both"].includes(str(fd, "channel")) ? str(fd, "channel") : "in_store",
    branches: Math.min(500, Math.max(1, Math.round(Number(str(fd, "branches")) || 1))),
    area: str(fd, "area", 120) || null,
    address: str(fd, "address") || null,
    website_url: url(str(fd, "website_url")),
    social_url: url(str(fd, "social_url")),
    contact_name: str(fd, "contact_name", 120),
    contact_phone: str(fd, "contact_phone", 30).replace(/[^\d+ ]/g, ""),
    contact_email: str(fd, "contact_email", 200).toLowerCase(),
    student_offer: str(fd, "student_offer", 500) || null,
    message: str(fd, "message", 1000) || null,
  };
  if (row.business_name.length < 2) return { error: "Enter your business name." };
  if (!(CATEGORIES as readonly string[]).includes(row.category)) return { error: "Pick a category." };
  if (row.contact_name.length < 2) return { error: "Enter your name." };
  if (row.contact_phone.replace(/\D/g, "").length < 8) return { error: "Enter a valid phone number." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.contact_email)) return { error: "Enter a valid email." };
  if (fd.get("agree") !== "on") return { error: "Please accept the Terms of Use and Privacy Policy." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_merchant_application", { p: row });
  const res = data as { ok: boolean; error?: string } | null;
  if (error || !res?.ok) {
    if (res?.error === "duplicate") return { error: "We already have an application from this email. Our team will contact you soon." };
    if (res?.error === "busy") return { error: "We're getting a lot of applications right now. Please try again in an hour." };
    return { error: "Couldn't send your application. Please try again." };
  }
  redirect("/apply?sent=1");
}
