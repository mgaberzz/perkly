import { requireAdmin } from "@/lib/auth";
import { Badge, Button, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { date, egp } from "@/lib/format";
import { setUserRole, setUserStatus } from "../actions";

export const metadata = { title: "Users" };

type Row = {
  id: string; full_name: string | null; email: string | null; phone: string | null; role: string; status: string; created_at: string;
  campus: { short_name: string | null; name: string } | null;
  stats: { total_xp: number; level: number; current_streak: number; total_redemptions: number; total_saved: number } | null;
};

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const role = typeof sp.role === "string" ? sp.role : "";
  const { supabase, user } = await requireAdmin();
  let query = supabase.from("profiles")
    .select("id, full_name, email, phone, role, status, created_at, campus:campuses(short_name, name), stats:user_stats(total_xp, level, current_streak, total_redemptions, total_saved)")
    .order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[,()]/g, "")}%,email.ilike.%${q.replace(/[,()]/g, "")}%,phone.ilike.%${q.replace(/[,()]/g, "")}%`);
  if (role) query = query.eq("role", role);
  const { data } = await query.returns<Row[]>();
  return (
    <>
      <PageHeader title="Users" subtitle="Students, merchant staff and admins." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Name, email or phone" className="max-w-xs" />
        <Select name="role" defaultValue={role} className="w-40"><option value="">All roles</option><option>student</option><option>merchant</option><option>admin</option></Select>
        <Button variant="secondary">Search</Button>
      </form>
      <Table head={["User", "Campus", "Level / XP", "Streak", "Redemptions", "Saved", "Joined", "Role", "Status", ""]}>
        {(data ?? []).map((u) => (
          <tr key={u.id}>
            <Td><div className="font-semibold">{u.full_name ?? "—"}</div><div className="text-xs text-zinc-500">{u.phone ?? u.email}</div></Td>
            <Td>{u.campus?.short_name ?? u.campus?.name ?? "—"}</Td>
            <Td>L{u.stats?.level ?? 1} · {u.stats?.total_xp ?? 0}</Td>
            <Td>{u.stats?.current_streak ?? 0}🔥</Td>
            <Td>{u.stats?.total_redemptions ?? 0}</Td>
            <Td>{egp(u.stats?.total_saved ?? 0)}</Td>
            <Td>{date(u.created_at)}</Td>
            <Td>
              {u.id === user.id ? <Badge>{u.role}</Badge> : (
                <form action={setUserRole} className="flex gap-1">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} className="rounded-lg border border-zinc-300 px-1 py-0.5 text-xs">
                    <option>student</option><option>merchant</option><option>admin</option>
                  </select>
                  <button className="text-xs font-semibold text-perk-purple">Set</button>
                </form>
              )}
            </Td>
            <Td><Badge>{u.status}</Badge></Td>
            <Td>
              {u.id !== user.id && (
                <form action={setUserStatus}>
                  <input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value={u.status === "active" ? "banned" : "active"} />
                  <button className={`text-xs font-semibold hover:underline ${u.status === "active" ? "text-red-600" : "text-emerald-700"}`}>{u.status === "active" ? "Ban" : "Unban"}</button>
                </form>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
