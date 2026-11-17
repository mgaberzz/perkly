"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE } from "@/lib/i18n";
import { getSession } from "@/lib/auth";

export async function setLang(fd: FormData) {
  const lang = fd.get("lang") === "ar" ? "ar" : "en";
  (await cookies()).set(LANG_COOKIE, lang, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  // Signed in: remember it on the profile too, so emails (invites, password resets) come in this language
  const { supabase, user } = await getSession();
  if (user) await supabase.from("profiles").update({ lang }).eq("id", user.id);
  revalidatePath("/", "layout");
}
