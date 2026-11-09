import { Icon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { PageTabs } from "@/components/page-tabs";
import { getT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/labels";
import { removeAssignment } from "../actions";

export const metadata = { title: "Team" };

const WHAT: Record<string, string> = {
  admin: "Everything, including users, roles and settings.",
  operations: "Creates and edits merchants, campaigns, campuses and quests; reviews transactions; approves cashier QR codes.",
  account_manager: "Manages only the merchants and campuses assigned to them: merchant details, team, branches, QR approvals and campaigns.",
  finance: "Read-only view of merchants and transactions; settlements, payouts, cashback approvals and Excel/CSV exports.",
};

type Staff = { id: string; full_name: string | null; email: string | null; role: string; user_code: string };
type Assignment = { id: string; user_id: string; merchant: { name: string; merchant_code: string } | null; campus: { name: string } | null };

export default async function TeamPage() {
  const { supabase } = await requireAdmin();
  const t = await getT();
  const [{ data: staff }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, user_code").in("role", ["admin", "operations", "account_manager", "finance"]).order("role").returns<Staff[]>(),
    supabase.from("staff_assignments").select("id, user_id, merchant:merchants(name, merchant_code), campus:campuses(name)").returns<Assignment[]>(),
  ]);
  return (
    <>
      <PageHeader title={t("Team & assignments")} subtitle={t("Give someone a team role in Users & roles. Account managers only see the merchants and campuses assigned to them.")} />
      <PageTabs tabs={[{ href: "/admin/team", label: t("Team") }, { href: "/admin/team/assign", label: t("Assign") }]} />
      <details className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-zinc-700">{t("What can each role do?")}</summary>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {Object.entries(WHAT).map(([r, d]) => (
            <div key={r}><dt><Badge tone={r}>{t(ROLE_LABEL[r])}</Badge></dt><dd className="mt-1 text-zinc-600">{t(d)}</dd></div>
          ))}
        </dl>
      </details>
      <div className="space-y-3">
        {(staff ?? []).map((s) => {
          const mine = (assignments ?? []).filter((a) => a.user_id === s.id);
          return (
            <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><span className="font-semibold">{s.full_name ?? s.email}</span> <span className="font-mono text-xs text-zinc-500">{s.user_code}</span><div className="truncate text-xs text-zinc-500">{s.email}</div></div>
                <div className="flex items-center gap-2">
                  <Badge tone={s.role}>{t(ROLE_LABEL[s.role])}</Badge>
                  {s.role === "account_manager" && <Link href={`/admin/team/assign?am=${s.id}`} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-perk-purple hover:bg-perk-purple/5">{t("Assign")}</Link>}
                </div>
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
    </>
  );
}
