import { Icon } from "@/components/icons";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { PageTabs } from "@/components/page-tabs";
import { merchantTabs } from "@/lib/merchant-tabs";
import { getT } from "@/lib/i18n/server";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";
import { adminAddMember, adminRemoveMember } from "../../../actions";

export const metadata = { title: "Portal access" };

export default async function MerchantAccessPage({ params }: PageProps<"/admin/merchants/[id]/access">) {
  const { id } = await params;
  const { supabase, can, merchantScope } = await requireStaff("merchants_view");
  if (merchantScope && !merchantScope.includes(id)) notFound();
  const t = await getT();
  const { data: merchant } = await supabase.from("merchants").select("id, name, merchant_code").eq("id", id).maybeSingle();
  if (!merchant) notFound();
  const editable = can("merchants_edit");
  const [{ data: members }, { data: branches }] = await Promise.all([
    supabase.from("merchant_members").select("user_id, member_role, branch_id").eq("merchant_id", id),
    supabase.from("merchant_branches").select("id, name").eq("merchant_id", id).order("name"),
  ]);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await createAdminClient().from("profiles").select("id, full_name, email, user_code").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; email: string | null; user_code: string }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  return (
    <>
      <PageHeader title={merchant.name} subtitle={<span className="font-mono">{merchant.merchant_code}</span>} />
      <PageTabs tabs={merchantTabs(id, editable, t)} />
        <Card title={t("Who can log in")} className="max-w-2xl">
          <ul className="mb-4 space-y-2">
            {(members ?? []).map((m) => {
              const p = byId.get(m.user_id);
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p?.full_name ?? p?.email ?? t("Invited")}</div>
                    <div className="truncate text-xs text-zinc-500">{p?.email} {p?.user_code && `· ${p.user_code}`}</div>
                    {m.branch_id && <div className="text-xs text-zinc-500"><Icon name="pin" size={12} className="me-1 inline-block align-[-2px]" />{branchName.get(m.branch_id)}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={m.member_role}>{t(MEMBER_ROLE_LABEL[m.member_role])}</Badge>
                    {editable && (
                      <form action={adminRemoveMember}>
                        <input type="hidden" name="merchant_id" value={id} /><input type="hidden" name="user_id" value={m.user_id} />
                        <ConfirmButton message={t("Remove portal access?")} className="text-xs text-red-600 hover:underline"><Icon name="x" size={14} /></ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
            {(members ?? []).length === 0 && <li className="text-sm text-zinc-500">{t("No one can log in for this merchant yet.")}</li>}
          </ul>
          {editable && (
            <ActionForm action={adminAddMember.bind(null, id)} className="space-y-3" resetOnSuccess>
              <Input name="email" type="email" placeholder="email@business.com" required />
              <Select name="member_role" defaultValue="owner">
                {Object.entries(MEMBER_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </Select>
              <Select name="branch_id" defaultValue="">
                <option value="">{t("Branch (for branch managers)")}</option>
                {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <SubmitButton variant="secondary" className="w-full">{t("Invite / add")}</SubmitButton>
            </ActionForm>
          )}
        </Card>

    </>
  );
}
