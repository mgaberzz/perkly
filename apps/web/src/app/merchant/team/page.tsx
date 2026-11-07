import { redirect } from "next/navigation";
import { requireMerchant } from "@/lib/auth";
import { Badge, Card, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/lib/i18n/server";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";
import { inviteStaff, removeStaff } from "../actions";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { supabase, merchant, memberRole, user, canManage } = await requireMerchant();
  if (!canManage) redirect("/merchant");
  const t = await getT();
  const [{ data: members }, { data: branches }] = await Promise.all([
    supabase.from("merchant_members").select("user_id, member_role, branch_id, created_at").eq("merchant_id", merchant.id).order("created_at"),
    supabase.from("merchant_branches").select("id, name").eq("merchant_id", merchant.id).order("name"),
  ]);
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  // Teammates' names: profiles RLS only exposes your own row, so read them server-side with the secret key (if configured).
  const ids = (members ?? []).map((m) => m.user_id);
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: people } = ids.length && hasKey
    ? await createAdminClient().from("profiles").select("id, full_name, email, user_code").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; email: string | null; user_code: string }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  return (
    <>
      <PageHeader title={t("Team")} subtitle={t("Owners manage everything · Managers edit perks & branches · Branch managers run one branch and request cashier QR codes · Cashiers view transactions.")} />
      {!hasKey && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {t("Add SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local to see teammates' names and send invites.")}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={[t("Name"), t("Email"), t("Role"), ""]}>
            {(members ?? []).map((m) => {
              const p = byId.get(m.user_id);
              return (
                <tr key={m.user_id}>
                  <Td className="font-semibold">{p?.full_name ?? t("Invited")}{m.user_id === user.id && ` (${t("you")})`}<div className="font-mono text-xs font-normal text-zinc-500">{p?.user_code}</div></Td>
                  <Td>{p?.email}</Td>
                  <Td><Badge tone={m.member_role}>{t(MEMBER_ROLE_LABEL[m.member_role])}</Badge>{m.branch_id && <div className="mt-1 text-xs text-zinc-500">📍 {branchName.get(m.branch_id)}</div>}</Td>
                  <Td className="text-end">
                    {memberRole === "owner" && m.user_id !== user.id && (
                      <form action={removeStaff}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <ConfirmButton message={t("Remove this person from your team?")} className="text-sm font-semibold text-red-600 hover:underline">{t("Remove")}</ConfirmButton>
                      </form>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>
        <Card title={t("Add staff")}>
          {memberRole === "owner" ? (
            <ActionForm action={inviteStaff} className="space-y-4" resetOnSuccess>
              <Field label={t("Email")}><Input name="email" type="email" required /></Field>
              <Field label={t("Role")}>
                <Select name="member_role" defaultValue="cashier">
                  {["cashier", "branch_manager", "manager"].map((r) => <option key={r} value={r}>{t(MEMBER_ROLE_LABEL[r])}</option>)}
                </Select>
              </Field>
              <Field label={t("Branch")} hint={t("Required for branch managers")}>
                <Select name="branch_id" defaultValue="">
                  <option value="">—</option>
                  {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <SubmitButton className="w-full">{t("Send invite")}</SubmitButton>
            </ActionForm>
          ) : <p className="text-sm text-zinc-500">{t("Only the owner can add staff.")}</p>}
        </Card>
      </div>
    </>
  );
}
