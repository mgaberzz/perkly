import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Badge, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageTabs } from "@/components/page-tabs";
import { FilterBar } from "@/components/filter-bar";
import { Avatar } from "@/components/expand-list";
import { dateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { BRAND_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/labels";
import { merchantListTabs } from "@/lib/merchant-tabs";
import { BRAND_TYPES } from "@/lib/types";
import { SITE_URL } from "@/lib/env";
import { approveApplication, rejectApplication } from "../../actions";

export const metadata = { title: "Merchant applications" };

type App = {
  id: string; business_name: string; category: string; channel: string; branches: number; area: string | null; address: string | null;
  website_url: string | null; social_url: string | null; contact_name: string; contact_phone: string; contact_email: string;
  student_offer: string | null; message: string | null; status: string; merchant_id: string | null; review_note: string | null;
  created_at: string; reviewed_at: string | null; reviewer: { full_name: string | null; email: string | null } | null;
};

export default async function ApplicationsPage({ searchParams }: PageProps<"/admin/merchants/applications">) {
  const { supabase } = await requireStaff("merchants_create");
  const t = await getT();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "pending";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  let query = supabase.from("merchant_applications").select("*, reviewer:profiles!reviewed_by(full_name, email)")
    .order("created_at", { ascending: false }).limit(200);
  if (status !== "all") query = query.eq("status", status);
  if (q) { const c = q.replace(/[,()%]/g, ""); query = query.or(`business_name.ilike.%${c}%,contact_email.ilike.%${c}%,contact_phone.ilike.%${c}%,area.ilike.%${c}%`); }
  const [{ data }, { count: pending }] = await Promise.all([
    query.returns<App[]>(),
    supabase.from("merchant_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const apply = `${SITE_URL}/apply`;

  return (
    <>
      <PageHeader title={t("Merchants")} subtitle={<>{t("Shops apply at")} <Link href={apply} target="_blank" className="font-semibold text-perk-purple hover:underline">{apply.replace(/^https?:\/\//, "")}</Link>{t(". Approving creates the merchant and emails the owner a portal invite.")}</>} />
      <PageTabs tabs={merchantListTabs(t, pending ?? 0)} />
      <FilterBar path="/admin/merchants/applications" search={{ name: "q", value: q, placeholder: t("Search business, email, phone or area") }} fields={[
        { name: "status", label: t("Status"), type: "select", value: status === "pending" ? undefined : status, all: t("Pending"),
          options: [{ value: "approved", label: t("Approved") }, { value: "rejected", label: t("Rejected") }, { value: "all", label: t("All statuses") }] },
      ]} />
      {!data?.length && (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          {status === "pending" && !q ? t("No applications waiting. New ones from the Join Perkly page show up here.") : t("Nothing matches these filters.")}
        </div>
      )}
      <ul className="space-y-3">
        {(data ?? []).map((a) => (
          <li key={a.id}>
            <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm" open={(data?.length ?? 0) === 1}>
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <Avatar name={a.business_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.business_name}</span>
                    <Badge>{t(a.category)}</Badge>
                    {a.status !== "pending" && <Badge tone={a.status}>{t(a.status === "approved" ? "Approved" : "Rejected")}</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {a.contact_name} · {a.area ?? t(CHANNEL_LABEL[a.channel])} · {dateTime(a.created_at)}
                  </div>
                </div>
                <span className="text-xs font-semibold text-perk-purple group-open:hidden">{t("Open")}</span>
                <span className="hidden text-xs font-semibold text-zinc-500 group-open:inline">{t("Close")}</span>
              </summary>
              <div className="border-t border-zinc-100 p-4">
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Row label={t("Contact")}>{a.contact_name}</Row>
                  <Row label={t("Mobile number")}><a href={`tel:${a.contact_phone}`} className="text-perk-purple hover:underline">{a.contact_phone}</a>
                    {" · "}<a href={`https://wa.me/${waNumber(a.contact_phone)}`} target="_blank" rel="noreferrer" className="text-perk-purple hover:underline">WhatsApp</a></Row>
                  <Row label={t("Email")}><a href={`mailto:${a.contact_email}`} className="text-perk-purple hover:underline">{a.contact_email}</a></Row>
                  <Row label={t("Sells")}>{t(CHANNEL_LABEL[a.channel])} · {t("{n} branches", { n: a.branches })}</Row>
                  {a.area && <Row label={t("Area / city")}>{a.area}</Row>}
                  {a.address && <Row label={t("Address")}>{a.address}</Row>}
                  {a.website_url && <Row label={t("Website")}><Ext href={a.website_url} /></Row>}
                  {a.social_url && <Row label={t("Instagram or Facebook page")}><Ext href={a.social_url} /></Row>}
                  {a.student_offer && <Row label={t("Suggested student offer")} wide>{a.student_offer}</Row>}
                  {a.message && <Row label={t("Message")} wide><span className="whitespace-pre-line">{a.message}</span></Row>}
                </dl>
                {a.status === "pending" ? (
                  <div className="mt-5 grid gap-4 border-t border-zinc-100 pt-4 lg:grid-cols-2">
                    <ActionForm action={approveApplication} className="space-y-3 rounded-xl bg-zinc-50 p-3">
                      <input type="hidden" name="id" value={a.id} />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={t("Brand type")}>
                          <Select name="brand_type" defaultValue={a.branches > 1 ? "chain" : "local"}>
                            {BRAND_TYPES.map((b) => <option key={b} value={b}>{t(BRAND_TYPE_LABEL[b])}</option>)}
                          </Select>
                        </Field>
                        <Field label={t("Commission %")}><Input name="commission_pct" type="number" step="0.1" min="0" max="100" defaultValue={5} /></Field>
                      </div>
                      <SubmitButton className="w-full">{t("Approve & invite owner")}</SubmitButton>
                      <p className="text-xs text-zinc-500">{t("Creates the merchant as Pending. Add branches and perks, then set it Live.")}</p>
                    </ActionForm>
                    <ActionForm action={rejectApplication} className="space-y-3 rounded-xl bg-zinc-50 p-3">
                      <input type="hidden" name="id" value={a.id} />
                      <Field label={t("Reason (for the team only)")}><Input name="note" maxLength={500} placeholder={t("e.g. outside our campuses")} /></Field>
                      <SubmitButton variant="secondary" className="w-full">{t("Reject")}</SubmitButton>
                    </ActionForm>
                  </div>
                ) : (
                  <p className="mt-5 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                    {t(a.status === "approved" ? "Approved" : "Rejected")} · {dateTime(a.reviewed_at)}{a.reviewer && ` · ${a.reviewer.full_name ?? a.reviewer.email}`}
                    {a.review_note && <> · “{a.review_note}”</>}
                    {a.merchant_id && <> · <Link href={`/admin/merchants/${a.merchant_id}`} className="font-semibold text-perk-purple hover:underline">{t("Open merchant")}</Link></>}
                  </p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}

function Row({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-xs text-zinc-400">{label}</dt><dd className="mt-0.5 break-words">{children}</dd></div>;
}
function Ext({ href }: { href: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-perk-purple hover:underline">{href.replace(/^https?:\/\//, "")}</a>;
}
/** Egyptian mobile 01xxxxxxxxx → 201xxxxxxxxx for wa.me */
function waNumber(p: string) {
  const d = p.replace(/\D/g, "");
  return d.startsWith("0") ? `2${d}` : d;
}
