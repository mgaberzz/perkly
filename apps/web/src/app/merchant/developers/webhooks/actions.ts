"use server";
import { revalidatePath } from "next/cache";
import { merchantCan, requireMerchant } from "@/lib/auth";
import type { ActionState } from "@/lib/types";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";

async function ctx() {
  const c = await requireMerchant();
  if (!merchantCan(c.memberRole, "developers")) throw new Error("Only owners and managers can manage webhooks.");
  return c;
}
const done = () => revalidatePath("/merchant/developers/webhooks");

export async function addWebhook(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { supabase, merchant } = await ctx();
    const url = String(fd.get("url") ?? "").trim();
    const events = WEBHOOK_EVENTS.filter((e) => fd.get(e) === "on");
    const { error } = await supabase.rpc("create_webhook", { p_merchant_id: merchant.id, p_url: url, p_events: events });
    if (error) return { error: error.message };
    done();
    return { ok: "Webhook added. Press \"Send test event\" to check it." };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function setWebhookActive(id: string, active: boolean) {
  const { supabase } = await ctx();
  await supabase.rpc("update_webhook", { p_id: id, p_events: null, p_active: active });
  done();
}

export async function removeWebhook(id: string) {
  const { supabase } = await ctx();
  await supabase.rpc("delete_webhook", { p_id: id });
  done();
}

export async function testWebhook(id: string) {
  const { supabase } = await ctx();
  await supabase.rpc("send_test_webhook", { p_id: id });
  done();
}

type Res = { ok?: string; error?: string; value?: string };
export async function revealWebhookSecret(id: string): Promise<Res> {
  try {
    const { supabase } = await ctx();
    const { data, error } = await supabase.rpc("webhook_secret", { p_id: id });
    return error ? { error: error.message } : { value: data as string };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function rotateWebhookSecret(id: string): Promise<Res> {
  try {
    const { supabase } = await ctx();
    const { error } = await supabase.rpc("rotate_webhook_secret", { p_id: id });
    if (error) return { error: error.message };
    done();
    return { ok: "New signing secret created. Update it in your system: events are now signed with the new one." };
  } catch (e) { return { error: (e as Error).message }; }
}
