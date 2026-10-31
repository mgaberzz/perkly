import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, accent = false }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${accent ? "perk-gradient text-white" : "border border-zinc-200 bg-white"}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-white/80" : "text-zinc-500"}`}>{label}</div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
      {hint && <div className={`mt-1 text-xs ${accent ? "text-white/80" : "text-zinc-500"}`}>{hint}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  live: "bg-emerald-100 text-emerald-700", active: "bg-emerald-100 text-emerald-700", success: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700", flagged: "bg-amber-100 text-amber-700",
  paused: "bg-zinc-200 text-zinc-700", expired: "bg-zinc-200 text-zinc-600",
  churned: "bg-red-100 text-red-700", rejected: "bg-red-100 text-red-700", reversed: "bg-red-100 text-red-700", banned: "bg-red-100 text-red-700",
  owner: "bg-perk-purple/10 text-perk-purple", manager: "bg-perk-blue/10 text-perk-blue", cashier: "bg-zinc-100 text-zinc-700",
  admin: "bg-perk-pink/10 text-perk-pink", merchant: "bg-perk-blue/10 text-perk-blue", student: "bg-perk-purple/10 text-perk-purple",
};

export function Badge({ children, tone, className = "" }: { children: ReactNode; tone?: string; className?: string }) {
  const style = STATUS_STYLES[tone ?? String(children)] ?? "bg-zinc-100 text-zinc-700";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style} ${className}`}>{children}</span>;
}

const BTN = {
  primary: "perk-gradient text-white hover:opacity-90",
  secondary: "border border-zinc-300 bg-white hover:bg-zinc-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "hover:bg-zinc-100",
};
export type ButtonVariant = keyof typeof BTN;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${className}`}
    />
  );
}

export function LinkButton({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${BTN[variant]} ${className}`}
    />
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const INPUT = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-perk-purple focus:ring-2 focus:ring-perk-purple/20";
export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${INPUT} ${props.className ?? ""}`} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${INPUT} ${props.className ?? ""}`} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={`${INPUT} ${props.className ?? ""}`} />;
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {hasRows ? children : (
            <tr><td colSpan={head.length} className="px-4 py-10 text-center text-zinc-500">{empty ?? "Nothing here yet."}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => (
  <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>
);

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const cls = { info: "bg-perk-blue/10 text-perk-blue", error: "bg-red-50 text-red-700", success: "bg-emerald-50 text-emerald-700" }[tone];
  return <div className={`rounded-xl px-4 py-3 text-sm font-medium ${cls}`}>{children}</div>;
}

/** Simple dependency-free bar chart. */
export function BarChart({ data, empty = "No data yet" }: { data: { label: string; value: number }[]; empty?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <div className="py-10 text-center text-sm text-zinc-500">{empty}</div>;
  return (
    <div className="flex h-44 items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="group flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.value}`}>
          <span className="text-[10px] font-semibold text-zinc-500 opacity-0 group-hover:opacity-100">{d.value}</span>
          <div className="w-full rounded-t-md perk-gradient" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 4 : 1 }} />
          <span className="max-w-full truncate text-[10px] text-zinc-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBarList({ data, format = (n: number) => String(n) }: { data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <div className="py-6 text-center text-sm text-zinc-500">No data yet</div>;
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={i}>
          <div className="mb-1 flex justify-between text-sm"><span className="truncate">{d.label}</span><span className="font-semibold">{format(d.value)}</span></div>
          <div className="h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full perk-gradient" style={{ width: `${(d.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
