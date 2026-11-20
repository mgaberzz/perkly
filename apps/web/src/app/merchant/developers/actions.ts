"use server";
import { revalidatePath } from "next/cache";
import { merchantCan, requireMerchant } from "@/lib/auth";
import { decryptSecret, encryptSecret, hashSecret, newPublicKey, newSecretKey } from "@/lib/api-keys";

type Result = { ok?: string; error?: string; value?: string };

async function ctx() {
  const c = await requireMerchant();
  if (!merchantCan(c.memberRole, "developers")) throw new Error("Only owners and managers can manage API keys.");
  return c;
}

/** First set of keys, or recreate one of them. The old key stops working immediately. */
export async function saveKeys(which: "both" | "public" | "secret"): Promise<Result> {
  try {
    const { supabase, merchant } = await ctx();
    const secret = which === "public" ? null : newSecretKey();
    const { error } = await supabase.rpc("save_api_credentials", {
      p_merchant_id: merchant.id,
      p_public: which === "secret" ? null : newPublicKey(),
      p_secret_hash: secret ? hashSecret(secret) : null,
      p_secret_enc: secret ? encryptSecret(secret) : null,
    });
    if (error) return { error: error.message };
    revalidatePath("/merchant/developers");
    return { ok: which === "both" ? "API keys created." : which === "public" ? "New public key created." : "New secret key created. Update it in your systems: the old one no longer works." };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Owners and managers can see the secret again (row security limits who can read it). */
export async function revealSecret(): Promise<Result> {
  try {
    const { supabase, merchant } = await ctx();
    const { data, error } = await supabase.from("merchant_api_credentials").select("secret_enc").eq("merchant_id", merchant.id).maybeSingle();
    if (error || !data) return { error: error?.message ?? "No keys yet." };
    try { return { value: decryptSecret(data.secret_enc) }; }
    catch { return { error: "This secret can't be shown any more. Recreate it to get a new one." }; }
  } catch (e) { return { error: (e as Error).message }; }
}
