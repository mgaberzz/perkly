import { requireStaff } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Badge, Card, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import type { Campus } from "@/lib/types";
import { createCampus, toggleCampus } from "../actions";

export const metadata = { title: "Campuses" };

export default async function CampusesPage() {
  const { supabase, can } = await requireStaff("campuses_view");
  const t = await getT();
  const editable = can("campuses_edit");
  const { data } = await supabase.from("campuses").select("*").order("name").returns<Campus[]>();
  return (
    <>
      <PageHeader title={t("Campuses")} subtitle={t("Students pick their campus during onboarding.")} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={editable ? "lg:col-span-2" : "lg:col-span-3"}>
          <Table head={[t("Campus"), t("City"), t("Type"), t("Location"), t("Status"), ""]}>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <Td className="font-semibold">{c.name} {c.short_name && <span className="text-zinc-500">({c.short_name})</span>}</Td>
                <Td>{c.city}</Td><Td>{t(c.type)}</Td>
                <Td className="text-xs text-zinc-500">{c.lat != null ? `${c.lat.toFixed(3)}, ${c.lng?.toFixed(3)}` : "—"}</Td>
                <Td><Badge tone={c.is_active ? "active" : "paused"}>{c.is_active ? t("active") : t("hidden")}</Badge></Td>
                <Td>{editable && <form action={toggleCampus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={String(!c.is_active)} />
                  <button className="text-xs font-semibold text-perk-purple hover:underline">{c.is_active ? t("Hide") : t("Show")}</button></form>}</Td>
              </tr>
            ))}
          </Table>
        </div>
        {editable && <Card title={t("Add campus")}>
          <ActionForm action={createCampus} className="space-y-3" resetOnSuccess>
            <Field label={t("Name")}><Input name="name" required /></Field>
            <Field label={t("Short name")}><Input name="short_name" placeholder="AUC" /></Field>
            <Field label={t("City")}><Input name="city" required /></Field>
            <Field label={t("Type")}><Select name="type"><option value="university">{t("university")}</option><option value="school">{t("school")}</option><option value="hub">{t("hub")}</option></Select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("Latitude")}><Input name="lat" type="number" step="any" /></Field>
              <Field label={t("Longitude")}><Input name="lng" type="number" step="any" /></Field>
            </div>
            <SubmitButton className="w-full">{t("Add campus")}</SubmitButton>
          </ActionForm>
        </Card>}
      </div>
    </>
  );
}
