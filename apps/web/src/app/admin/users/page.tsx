import { requireAdmin } from "@/lib/auth";
import { Badge, Button, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { date, egp } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { ROLE_LABEL } from "@/lib/labels";
import { setUserRole, setUserStatus } from "../actions";

export const metadata = { title: "Users" };
const ROLES = ["student", "merchant", "admin", "operations", "account_manager", "finance"];

type Row = {
  id: string; full_name: string | null; email: string | null; phone: string | null; role: string; status: string; created_at: string;
  user_code: string; student_code: string | null;
  campus: { short_name: string | null; name: string } | null;
  stats: { total_xp: number; level: number; current_streak: number; total_redemptions: number; total_saved: number } | null;
};

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const role = typeof sp.role === "string" ? sp.role : "";
  const { supabase, user } = await requireAdmin();
  const t = await getT();
  let query = supabase.from("profiles")
    .select("id, full_name, email, phone, role, status, created_at, user_code, student_code, campus:campuses(short_name, name), stats:user_stats(total_xp, level, current_streak, total_redemptions, total_saved)")
    .order("created_at", { ascending: false }).limit(200);
  if (q) {
    const c = q.replace(/[,()%]/g, "");
    query = query.or(`full_name.ilike.%${c}%,email.ilike.%${c}%,phone.ilike.%${c}%,user_code.ilike.%${c}%,student_code.ilike.%${c}%`);
  }
  if (role) query = query.eq("role", role);
  const { data } = await query.returns<Row[]>();
  return (
    <>
      <PageHeader title={t("Users & roles")} subtitle={t("Every person gets a User ID (USR-…); students also get a Student ID (STU-…). Merchants have Merchant IDs (MER-…).")} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder={t("Name, email, phone, USR-… or STU-…")} className="max-w-xs" />
        <Select name="role" defaultValue={role} className="w-44"><option value="">{t("All roles")}</option>{ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r])}</option>)}</Select>
        <Button variant="secondary">{t("Search")}</Button>
      </form>
      <Table head={[t("User"), t("IDs"), t("Campus"), t("Level / XP"), t("Redemptions"), t("Saved"), t("Joined"), t("Role"), t("Status"), ""]} empty={t("No users.")}>
        {(data ?? []).map((u) => (
          <tr key={u.id}>
            <Td><div className="font-semibold">{u.full_name ?? "—"}</div><div className="text-xs text-zinc-500">{u.phone ?? u.email}</div></Td>
            <Td className="font-mono text-xs">{u.user_code}{u.student_code && <div className="text-perk-purple">{u.student_code}</div>}</Td>
            <Td>{u.campus?.short_name ?? u.campus?.name ?? "—"}</Td>
            <Td>L{u.stats?.level ?? 1} · {u.stats?.total_xp ?? 0}</Td>
            <Td>{u.stats?.total_redemptions ?? 0}</Td>
            <Td>{egp(u.stats?.total_saved ?? 0)}</Td>
            <Td>{date(u.created_at)}</Td>
            <Td>
              {u.id === user.id ? <Badge tone={u.role}>{t(ROLE_LABEL[u.role])}</Badge> : (
                <form action={setUserRole} className="flex gap-1">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} className="rounded-lg border border-zinc-300 px-1 py-0.5 text-xs">
                    {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r])}</option>)}
                  </select>
                  <button className="text-xs font-semibold text-perk-purple">{t("Set")}</button>
                </form>
              )}
            </Td>
            <Td><Badge tone={u.status}>{t(u.status)}</Badge></Td>
            <Td>
              {u.id !== user.id && (
                <form action={setUserStatus}>
                  <input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value={u.status === "active" ? "banned" : "active"} />
                  <button className={`text-xs font-semibold hover:underline ${u.status === "active" ? "text-red-600" : "text-emerald-700"}`}>{u.status === "active" ? t("Ban") : t("Unban")}</button>
                </form>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
