import { Icon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, Field, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { getT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/labels";
import { addAssignment, removeAssignment } from "../actions";

export const metadata = { title: "Team" };

const WHAT: Record<string, string> = {
  admin: "Everything, including users, roles and settings.",
  operations: "Creates and edits merchants, campaigns, campuses and quests; reviews transactions; approves cashier QR codes.",
  account_manager: "Manages only the merchants and campuses assigned below: merchant details, team, branches, QR approvals and campaigns.",
  finance: "Read-only view of merchants and transactions; settlements, payouts, cashback approvals and Excel/CSV exports.",
};

type Staff = { id: string; full_name: string | null; email: string | null; role: string; user_code: string };
type Assignment = { id: string; user_id: string; merchant: { name: string; merchant_code: string } | null; campus: { name: string } | null };

export default async function TeamPage() {
  const { supabase } = await requireAdmin();
  const t = await getT();
  const [{ data: staff }, { data: assignments }, { data: merchants }, { data: campuses }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, user_code").in("role", ["admin", "operations", "account_manager", "finance"]).order("role").returns<Staff[]>(),
    supabase.from("staff_assignments").select("id, user_id, merchant:merchants(name, merchant_code), campus:campuses(name)").returns<Assignment[]>(),
    supabase.from("merchants").select("id, name, merchant_code").order("name").limit(1000),
    supabase.from("campuses").select("id, name").order("name"),
  ]);
  const ams = (staff ?? []).filter((s) => s.role === "account_manager");
  return (
    <>
      <PageHeader title={t("Team & assignments")} subtitle={t("Give someone a team role from Users & roles, then assign account managers their merchants and campuses here.")} />
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(WHAT).map(([r, d]) => (
          <div key={r} className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
            <Badge tone={r}>{t(ROLE_LABEL[r])}</Badge>
            <p className="mt-2 text-zinc-600">{t(d)}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {(staff ?? []).map((s) => {
            const mine = (assignments ?? []).filter((a) => a.user_id === s.id);
            return (
              <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><span className="font-semibold">{s.full_name ?? s.email}</span> <span className="font-mono text-xs text-zinc-500">{s.user_code}</span><div className="text-xs text-zinc-500">{s.email}</div></div>
                  <Badge tone={s.role}>{t(ROLE_LABEL[s.role])}</Badge>
                </div>
                {s.role === "account_manager" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mine.map((a) => (
                      <form key={a.id} action={removeAssignment} className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold">
                        <input type="hidden" name="id" value={a.id} />
                        {a.merchant ? <><Icon name="store" size={14} className="me-1 inline-block align-[-2px]" />{a.merchant.name}</> : <><Icon name="school" size={14} className="me-1 inline-block align-[-2px]" />{a.campus?.name}</>}
                        <button className="text-zinc-400 hover:text-red-600" title={t("Remove")}><Icon name="x" size={16} /></button>
                      </form>
                    ))}
                    {mine.length === 0 && <span className="text-xs text-amber-600">{t("Nothing assigned yet — they can't see any merchant.")}</span>}
                  </div>
                )}
              </div>
            );
          })}
          {(staff ?? []).length === 0 && <p className="text-sm text-zinc-500">{t("No team members yet.")}</p>}
        </div>
        <Card title={t("Assign to an account manager")}>
          {ams.length === 0 ? <p className="text-sm text-zinc-500">{t("Set someone's role to Account manager first.")}</p> : (
            <ActionForm action={addAssignment} className="space-y-3" resetOnSuccess>
              <Field label={t("Account manager")}><Select name="user_id">{ams.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? a.email}</option>)}</Select></Field>
              <Field label={t("Merchant")}><Select name="merchant_id" defaultValue=""><option value="">—</option>{(merchants ?? []).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.merchant_code}</option>)}</Select></Field>
              <Field label={t("or Campus")} hint={t("A campus gives them every merchant with a branch there.")}><Select name="campus_id" defaultValue=""><option value="">—</option>{(campuses ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
              <SubmitButton className="w-full">{t("Assign")}</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
