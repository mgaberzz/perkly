import { requireAdmin } from "@/lib/auth";
import { Badge, Card, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import type { Campus } from "@/lib/types";
import { createCampus, toggleCampus } from "../actions";

export const metadata = { title: "Campuses" };

export default async function CampusesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("campuses").select("*").order("name").returns<Campus[]>();
  return (
    <>
      <PageHeader title="Campuses" subtitle="Students pick their campus during onboarding." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={["Campus", "City", "Type", "Location", "Status", ""]}>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <Td className="font-semibold">{c.name} {c.short_name && <span className="text-zinc-500">({c.short_name})</span>}</Td>
                <Td>{c.city}</Td><Td className="capitalize">{c.type}</Td>
                <Td className="text-xs text-zinc-500">{c.lat != null ? `${c.lat.toFixed(3)}, ${c.lng?.toFixed(3)}` : "—"}</Td>
                <Td><Badge tone={c.is_active ? "active" : "paused"}>{c.is_active ? "active" : "hidden"}</Badge></Td>
                <Td><form action={toggleCampus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={String(!c.is_active)} />
                  <button className="text-xs font-semibold text-perk-purple hover:underline">{c.is_active ? "Hide" : "Show"}</button></form></Td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title="Add campus">
          <ActionForm action={createCampus} className="space-y-3" resetOnSuccess>
            <Field label="Name"><Input name="name" required /></Field>
            <Field label="Short name"><Input name="short_name" placeholder="AUC" /></Field>
            <Field label="City"><Input name="city" required /></Field>
            <Field label="Type"><Select name="type"><option value="university">University</option><option value="school">School</option><option value="hub">Hub</option></Select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Latitude"><Input name="lat" type="number" step="any" /></Field>
              <Field label="Longitude"><Input name="lng" type="number" step="any" /></Field>
            </div>
            <SubmitButton className="w-full">Add campus</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
