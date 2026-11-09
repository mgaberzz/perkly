import { Icon } from "@/components/icons";
import { PageTabs } from "@/components/page-tabs";
import { redirect } from "next/navigation";
import { requireMerchantArea } from "@/lib/auth";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import { ConfirmButton } from "@/components/action-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { getT } from "@/lib/i18n/server";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";
import { removeStaff } from "../actions";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { supabase, merchant, memberRole, user, canManage } = await requireMerchantArea("team");
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
      {memberRole === "owner" && <PageTabs tabs={[{ href: "/merchant/team", label: t("Team") }, { href: "/merchant/team/new", label: t("Add staff") }]} />}
      {!hasKey && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {t("Add SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local to see teammates' names and send invites.")}
        </div>
      )}
      <div>
        <div>
          <Table head={[t("Name"), t("Email"), t("Role"), ""]}>
            {(members ?? []).map((m) => {
              const p = byId.get(m.user_id);
              return (
                <tr key={m.user_id}>
                  <Td className="font-semibold">{p?.full_name ?? t("Invited")}{m.user_id === user.id && ` (${t("you")})`}<div className="font-mono text-xs font-normal text-zinc-500">{p?.user_code}</div></Td>
                  <Td>{p?.email}</Td>
                  <Td phone="sum"><Badge tone={m.member_role}>{t(MEMBER_ROLE_LABEL[m.member_role])}</Badge>{m.branch_id && <div className="mt-1 text-xs text-zinc-500"><Icon name="pin" size={12} className="me-1 inline-block align-[-2px]" />{branchName.get(m.branch_id)}</div>}</Td>
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
      </div>
    </>
  );
}
