import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PageTabs } from "@/components/page-tabs";
import { AssignForm } from "@/components/assign-form";
import { getT } from "@/lib/i18n/server";
import { addAssignment } from "../../actions";

export const metadata = { title: "Assign" };

export default async function AssignPage({ searchParams }: PageProps<"/admin/team/assign">) {
  const { supabase } = await requireAdmin();
  const t = await getT();
  const sp = await searchParams;
  const [{ data: ams }, { data: merchants }, { data: campuses }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("role", "account_manager").order("full_name"),
    supabase.from("merchants").select("id, name, merchant_code").order("name").limit(2000),
    supabase.from("campuses").select("id, name").order("name"),
  ]);
  return (
    <>
      <PageHeader title={t("Team & assignments")} subtitle={t("Account managers only see the merchants and campuses assigned to them.")} />
      <PageTabs tabs={[{ href: "/admin/team", label: t("Team") }, { href: "/admin/team/assign", label: t("Assign") }]} />
      <Card className="max-w-xl">
        {(ams ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">{t("No account managers yet.")} <Link href="/admin/users" className="font-semibold text-perk-purple hover:underline">{t("Set someone's role to Account manager in Users & roles.")}</Link></p>
        ) : (
          <AssignForm action={addAssignment}
            defaultManager={typeof sp.am === "string" ? sp.am : undefined}
            managers={(ams ?? []).map((a) => ({ id: a.id, label: a.full_name ?? a.email ?? "—" }))}
            merchants={(merchants ?? []).map((m) => ({ value: m.id, label: m.name, keywords: m.merchant_code }))}
            campuses={campuses ?? []} />
        )}
      </Card>
    </>
  );
}
