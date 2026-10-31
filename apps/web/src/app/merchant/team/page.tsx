import { requireMerchant } from "@/lib/auth";
import { Badge, Card, Field, Input, PageHeader, Select, Table, Td } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { inviteStaff, removeStaff } from "../actions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { supabase, merchant, memberRole, user } = await requireMerchant();
  const { data: members } = await supabase.from("merchant_members").select("user_id, member_role, created_at")
    .eq("merchant_id", merchant.id).order("created_at");
  // Names/emails of teammates: profiles RLS only exposes your own row, so read them server-side.
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length
    ? await createAdminClient().from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  return (
    <>
      <PageHeader title="Team" subtitle="Owners manage everything · Managers edit perks & branches · Cashiers view redemptions." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={["Name", "Email", "Role", ""]}>
            {(members ?? []).map((m) => {
              const p = byId.get(m.user_id);
              return (
                <tr key={m.user_id}>
                  <Td className="font-semibold">{p?.full_name ?? "Invited"}{m.user_id === user.id && " (you)"}</Td>
                  <Td>{p?.email}</Td>
                  <Td><Badge>{m.member_role}</Badge></Td>
                  <Td className="text-right">
                    {memberRole === "owner" && m.user_id !== user.id && (
                      <form action={removeStaff}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <ConfirmButton message="Remove this person from your team?" className="text-sm font-semibold text-red-600 hover:underline">Remove</ConfirmButton>
                      </form>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>
        <Card title="Add staff">
          {memberRole === "owner" ? (
            <ActionForm action={inviteStaff} className="space-y-4" resetOnSuccess>
              <Field label="Email"><Input name="email" type="email" required /></Field>
              <Field label="Role">
                <Select name="member_role" defaultValue="cashier">
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </Select>
              </Field>
              <SubmitButton className="w-full">Send invite</SubmitButton>
            </ActionForm>
          ) : <p className="text-sm text-zinc-500">Only the owner can add staff.</p>}
        </Card>
      </div>
    </>
  );
}
