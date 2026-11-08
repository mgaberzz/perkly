import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Badge, PageHeader } from "@/components/ui";
import { VerificationReview } from "@/components/verification-review";
import { date, dateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { reviewVerification } from "../actions";

export const metadata = { title: "Student verification" };

type Row = {
  id: string; status: "pending" | "approved" | "rejected"; student_number: string | null; id_card_path: string;
  reject_reason: string | null; created_at: string; reviewed_at: string | null;
  student: { full_name: string | null; phone: string | null; email: string | null; user_code: string; student_code: string | null; verified_until: string | null } | null;
  campus: { name: string; short_name: string | null } | null;
  reviewer: { full_name: string | null } | null;
};
const STATUSES = ["pending", "approved", "rejected"] as const;

export default async function VerificationsPage({ searchParams }: PageProps<"/admin/verifications">) {
  const { supabase } = await requireStaff("verifications");
  const t = await getT();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status) ?? "pending";

  const [{ data }, ...counts] = await Promise.all([
    supabase.from("student_verifications")
      .select("id, status, student_number, id_card_path, reject_reason, created_at, reviewed_at, student:profiles!student_verifications_user_id_fkey(full_name, phone, email, user_code, student_code, verified_until), campus:campuses(name, short_name), reviewer:profiles!student_verifications_reviewed_by_fkey(full_name)")
      .eq("status", status).order("created_at", { ascending: status === "pending" }).limit(60).returns<Row[]>(),
    ...STATUSES.map((s) => supabase.from("student_verifications").select("*", { count: "exact", head: true }).eq("status", s)),
  ]);
  const rows = data ?? [];
  // ID card photos are private: short-lived links, only for staff who may review
  const { data: signed } = rows.length
    ? await supabase.storage.from("student-ids").createSignedUrls(rows.map((r) => r.id_card_path), 60 * 10)
    : { data: [] };
  const photo = (path: string) => signed?.find((s) => s.path === path)?.signedUrl ?? null;

  return (
    <>
      <PageHeader title={t("Student verification")} subtitle={t("Check each student ID card against the student's name and campus. Approved students stay verified for 12 months.")} />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {STATUSES.map((s, i) => (
          <Link key={s} href={`/admin/verifications?status=${s}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${s === status ? "border-perk-purple text-perk-purple" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
            {t(s[0].toUpperCase() + s.slice(1))} <span className="ms-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{counts[i].count ?? 0}</span>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
          {status === "pending" ? t("All caught up: no ID cards waiting for review.") : t("Nothing here yet.")}
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const url = photo(r.id_card_path);
            return (
              <li key={r.id} className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="block bg-zinc-900" title={t("Open full size")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={t("Student ID card")} className="h-52 w-full object-contain" />
                  </a>
                ) : <div className="grid h-52 place-items-center bg-zinc-100 text-sm text-zinc-400">{t("Photo not available")}</div>}
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-bold">{r.student?.full_name ?? t("Deleted account")}</span>
                      {r.status !== "pending" && <Badge tone={r.status === "approved" ? "live" : "rejected"}>{t(r.status)}</Badge>}
                    </div>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-zinc-500">{t("Campus")}</dt><dd className="font-medium">{r.campus?.name ?? "—"}</dd>
                      <dt className="text-zinc-500">{t("Student number")}</dt><dd className="font-mono">{r.student_number ?? "—"}</dd>
                      <dt className="text-zinc-500">{t("Student ID")}</dt><dd className="font-mono">{r.student?.student_code ?? "—"} · {r.student?.user_code}</dd>
                      <dt className="text-zinc-500">{t("Contact")}</dt><dd className="truncate">{r.student?.phone ?? r.student?.email ?? "—"}</dd>
                      <dt className="text-zinc-500">{t("Sent")}</dt><dd>{dateTime(r.created_at)}</dd>
                    </dl>
                  </div>
                  {r.status === "pending" ? (
                    <div className="mt-auto"><VerificationReview id={r.id} action={reviewVerification} /></div>
                  ) : (
                    <p className="mt-auto text-xs text-zinc-500">
                      {r.status === "approved"
                        ? t("Verified until {date}", { date: r.student?.verified_until ? date(r.student.verified_until) : "—" })
                        : <>“{t(r.reject_reason ?? "")}”</>}
                      {" · "}{r.reviewer?.full_name ?? "—"}{r.reviewed_at && <> · {dateTime(r.reviewed_at)}</>}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
