import Link from "next/link";
import { requireMerchantArea } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/env";

export const metadata = { title: "API documentation" };

const Code = ({ children }: { children: string }) => (
  <pre dir="ltr" className="mt-2 overflow-x-auto rounded-xl bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100"><code>{children}</code></pre>
);

export default async function ApiDocs() {
  await requireMerchantArea("developers");
  const t = await getT();
  const base = `${SITE_URL}/api/v1`;
  const ep = [
    { m: "GET", p: "/me", d: t("Your business: name, merchant code, status.") },
    { m: "GET", p: "/verify?code=7F3K", d: t("Cashier check: is the 4-character code on the student's screen a real redemption at your business in the last 30 minutes?") },
    { m: "GET", p: "/transactions", d: t("Your transactions, newest first. Filters: from, to (YYYY-MM-DD, Cairo time), branch_id, status (success, flagged, reversed), limit (1–200, default 50), before (for the next page).") },
    { m: "GET", p: "/transactions/9000000018", d: t("One transaction by its 10-digit transaction ID.") },
    { m: "GET", p: "/perks", d: t("Your perks. Add ?status=all to include paused and expired ones.") },
    { m: "GET", p: "/branches", d: t("Your branches with their IDs.") },
  ];
  return (
    <>
      <PageHeader title={t("API documentation")} subtitle={t("Connect your cashier system, website or reports to Perkly.")}
        actions={<Link href="/merchant/developers" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50">← {t("API keys")}</Link>} />
      <div className="max-w-4xl space-y-6">
        <Card title={t("1. Sign in every request")}>
          <p className="text-sm text-zinc-600">{t("Send your secret key in the Authorization header. Requests without it, with an old key, or while API access is off get a 401 error.")}</p>
          <Code>{`curl ${base}/me \\\n  -H "Authorization: Bearer sk_live_YOUR_SECRET_KEY"`}</Code>
          <p className="mt-3 text-sm text-zinc-600">{t("Base URL")}: <code dir="ltr" className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{base}</code>. {t("All answers are JSON. Amounts are in EGP.")}</p>
        </Card>
        <Card title={t("2. Endpoints")}>
          <div className="divide-y divide-zinc-100">
            {ep.map((e) => (
              <div key={e.p} className="py-3">
                <div dir="ltr" className="font-mono text-sm"><span className="me-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-bold text-emerald-700">{e.m}</span>{e.p}</div>
                <p className="mt-1 text-sm text-zinc-600">{e.d}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t("3. Example: check a code at the cashier")}>
          <Code>{`curl "${base}/verify?code=7F3K" -H "Authorization: Bearer sk_live_…"`}</Code>
          <Code>{`{
  "valid": true,
  "data": {
    "id": "9000000018", "code": "7F3K", "created_at": "2026-11-20T12:30:00Z",
    "status": "success", "payment": "cashier",
    "bill": 200, "discount": 40, "paid": 160, "currency": "EGP",
    "new_customer": false, "receipt_ref": null,
    "branch": { "id": "…", "name": "Main branch" }, "cashier": "Cashier 1",
    "perk": { "id": "…", "title": "20% off all drinks" }, "settlement": "pending"
  }
}`}</Code>
          <p className="mt-3 text-sm text-zinc-600">{t("valid is false if there's no match in the last 30 minutes, or the transaction was reversed. payment \"in_app\" means the student already paid in the app: don't take money again.")}</p>
        </Card>
        <Card title={t("4. Example: transactions for a month")}>
          <Code>{`curl "${base}/transactions?from=2026-11-01&to=2026-11-30&limit=200" \\\n  -H "Authorization: Bearer sk_live_…"`}</Code>
          <p className="mt-3 text-sm text-zinc-600">{t("If next_before isn't null, ask again with before=<next_before> to get the next page.")}</p>
        </Card>
        <Card title={t("5. Errors")}>
          <Code>{`{ "error": { "code": "unauthorized", "message": "…" } }`}</Code>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-zinc-600">
            <li><b>400 bad_request</b>: {t("a filter is wrong (the message says which).")}</li>
            <li><b>401 unauthorized</b>: {t("missing, old or recreated key, or API access is off.")}</li>
            <li><b>404 not_found</b>: {t("no such transaction at your business.")}</li>
          </ul>
          <p className="mt-3 text-sm text-zinc-600">{t("The API only reads data. Students' names and phone numbers are never included.")}</p>
        </Card>
      </div>
    </>
  );
}
