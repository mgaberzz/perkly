import { PageTabs } from "@/components/page-tabs";
import { requireStaff } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Badge, PageHeader, Table, Td } from "@/components/ui";
import type { Campus } from "@/lib/types";
import { toggleCampus } from "../actions";

export const metadata = { title: "Campuses" };

export default async function CampusesPage() {
  const { supabase, can, role } = await requireStaff("campuses_view");
  const t = await getT();
  const editable = can("campuses_edit");
  let q = supabase.from("campuses").select("*").order("name");
  if (role === "account_manager") {
    // Only the campuses this account manager covers
    const { data: ids } = await supabase.rpc("staff_campus_ids");
    const list = ((ids ?? []) as string[]).filter(Boolean);
    q = q.in("id", list.length ? list : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data } = await q.returns<Campus[]>();
  return (
    <>
      <PageHeader title={role === "account_manager" ? t("My campuses") : t("Campuses")} subtitle={t("Students pick their campus during onboarding.")} />
      {editable && <PageTabs tabs={[{ href: "/admin/campuses", label: t("All campuses") }, { href: "/admin/campuses/new", label: t("New campus") }]} />}
      <div>
        <div>
          <Table head={[t("Campus"), t("City"), t("Type"), t("Location"), t("Status"), ""]}>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <Td className="font-semibold">{c.name} {c.short_name && <span className="text-zinc-500">({c.short_name})</span>}</Td>
                <Td phone="sum">{c.city}</Td><Td>{t(c.type)}</Td>
                <Td className="text-xs text-zinc-500">{c.lat != null ? `${c.lat.toFixed(3)}, ${c.lng?.toFixed(3)}` : "—"}</Td>
                <Td phone="sum"><Badge tone={c.is_active ? "active" : "paused"}>{c.is_active ? t("active") : t("hidden")}</Badge></Td>
                <Td>{editable && <form action={toggleCampus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={String(!c.is_active)} />
                  <button className="text-xs font-semibold text-perk-purple hover:underline">{c.is_active ? t("Hide") : t("Show")}</button></form>}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
