import Link from "next/link";
import { egp, short } from "@/lib/format";

/** Brand-friendly palette for up to 6 series / slices (+ grey for "Other") */
export const SERIES_COLORS = ["#7B2FF7", "#FF3EA5", "#2F80FF", "#F59E0B", "#10B981", "#14B8A6"];
const OTHER = "#A1A1AA";

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / (v / p > 5 ? 2 : 1)) * p * (v / p > 5 ? 2 : 1);
};

/**
 * Daily combo chart: bars (e.g. GMV) + line (e.g. net revenue), each with its own scale.
 * Bars are links (e.g. to that day's transactions); hover shows exact values.
 */
export function ComboChart({ days, barLabel, lineLabel, empty }: {
  days: { label: string; bar: number; line: number; href?: string; title?: string }[];
  barLabel: string; lineLabel: string; empty: string;
}) {
  if (!days.length || days.every((d) => !d.bar && !d.line)) return <div className="py-10 text-center text-sm text-zinc-500">{empty}</div>;
  const W = 720, H = 220, L = 46, R = 46, T = 12, B = 26;
  const w = (W - L - R) / days.length;
  const bMax = niceMax(Math.max(...days.map((d) => d.bar)));
  const lMax = niceMax(Math.max(...days.map((d) => d.line)));
  const y = (v: number, max: number) => T + (H - T - B) * (1 - v / max);
  const path = days.map((d, i) => `${i ? "L" : "M"}${L + w * i + w / 2},${y(d.line, lMax)}`).join(" ");
  const every = Math.ceil(days.length / 10);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(bMax * f, bMax)} y2={y(bMax * f, bMax)} stroke="#E4E4E7" strokeDasharray="3 3" />
            <text x={L - 6} y={y(bMax * f, bMax) + 4} textAnchor="end" fontSize="10" fill="#7B2FF7">{short(bMax * f)}</text>
            <text x={W - R + 6} y={y(lMax * f, lMax) + 4} fontSize="10" fill="#FF3EA5">{short(lMax * f)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const bar = (
            <g>
              <title>{d.title ?? `${d.label}\n${barLabel}: ${egp(d.bar)}\n${lineLabel}: ${egp(d.line)}`}</title>
              <rect x={L + w * i + w * 0.15} y={y(d.bar, bMax)} width={w * 0.7} height={Math.max(0, H - B - y(d.bar, bMax))} rx={3} fill="#7B2FF7" opacity={0.25} />
              <rect x={L + w * i} y={T} width={w} height={H - T - B} fill="transparent" />
            </g>
          );
          return (
            <g key={i}>
              {d.href && d.bar ? <a href={d.href} className="cursor-pointer [&:hover_rect:first-of-type]:opacity-60">{bar}</a> : bar}
              {i % every === 0 && <text x={L + w * i + w / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#71717A">{d.label}</text>}
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#FF3EA5" strokeWidth={2.5} strokeLinejoin="round" />
        {days.map((d, i) => d.line > 0 && <circle key={i} cx={L + w * i + w / 2} cy={y(d.line, lMax)} r={3} fill="#FF3EA5"><title>{`${d.label} · ${lineLabel}: ${egp(d.line)}`}</title></circle>)}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-perk-purple/30" />{barLabel}</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-perk-pink" />{lineLabel}</span>
      </div>
    </div>
  );
}

/** Donut of shares; every slice and legend row is a link. */
export function DonutChart({ slices, empty, format = egp, otherLabel = "Other" }: {
  slices: { label: string; value: number; href?: string }[]; empty: string; format?: (n: number) => string; otherLabel?: string;
}) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((a, s) => a + s.value, 0);
  if (!total) return <div className="py-10 text-center text-sm text-zinc-500">{empty}</div>;
  const top = data.slice(0, 6);
  const rest = data.slice(6).reduce((a, s) => a + s.value, 0);
  const parts = [...top.map((s, i) => ({ ...s, color: SERIES_COLORS[i] })), ...(rest > 0 ? [{ label: otherLabel, value: rest, color: OTHER, href: undefined }] : [])];
  const R = 70, r = 44, C = 90;
  let a0 = -Math.PI / 2;
  const arc = (from: number, to: number) => {
    const big = to - from > Math.PI ? 1 : 0;
    const p = (ang: number, rad: number) => `${C + rad * Math.cos(ang)},${C + rad * Math.sin(ang)}`;
    return `M${p(from, R)} A${R},${R} 0 ${big} 1 ${p(to, R)} L${p(to, r)} A${r},${r} 0 ${big} 0 ${p(from, r)} Z`;
  };
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0">
        {parts.length === 1 ? <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={parts[0].color} strokeWidth={R - r} /> :
          parts.map((s, i) => {
            const a1 = a0 + (2 * Math.PI * s.value) / total;
            const d = arc(a0, a1); a0 = a1;
            const el = <path d={d} fill={s.color}><title>{`${s.label}: ${format(s.value)} (${Math.round((100 * s.value) / total)}%)`}</title></path>;
            return s.href ? <a key={i} href={s.href} className="cursor-pointer hover:opacity-80">{el}</a> : <g key={i}>{el}</g>;
          })}
        <text x={C} y={C - 2} textAnchor="middle" fontSize="15" fontWeight="800" fill="#16131F">{short(total)}</text>
        <text x={C} y={C + 14} textAnchor="middle" fontSize="9" fill="#71717A">EGP</text>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {parts.map((s, i) => {
          const row = (
            <span className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-50">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="text-zinc-500">{Math.round((100 * s.value) / total)}%</span>
              <span className="w-20 text-end font-semibold" title={egp(s.value)}>{short(s.value)}</span>
            </span>
          );
          return <li key={i}>{s.href ? <Link href={s.href}>{row}</Link> : row}</li>;
        })}
      </ul>
    </div>
  );
}

/** Multi-line trend (one line per series), with clickable legend. */
export function LineChart({ labels, series, empty }: {
  labels: string[]; series: { label: string; values: number[]; href?: string }[]; empty: string;
}) {
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  if (!series.length || max <= 1 && series.every((s) => s.values.every((v) => !v))) return <div className="py-10 text-center text-sm text-zinc-500">{empty}</div>;
  const W = 720, H = 200, L = 46, R = 12, T = 10, B = 24;
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, labels.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const every = Math.ceil(labels.length / 10);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#E4E4E7" strokeDasharray="3 3" />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="#71717A">{short(max * f)}</text>
          </g>
        ))}
        {labels.map((l, i) => i % every === 0 && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#71717A">{l}</text>)}
        {series.map((s, si) => (
          <g key={si}>
            <path d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} fill="none" stroke={SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth={2.2} strokeLinejoin="round" />
            {s.values.map((v, i) => v > 0 && <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={SERIES_COLORS[si % SERIES_COLORS.length]}><title>{`${s.label} · ${labels[i]}: ${egp(v)}`}</title></circle>)}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s, si) => {
          const item = <span className="flex items-center gap-1.5 text-zinc-600 hover:text-perk-purple"><span className="h-0.5 w-4" style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }} />{s.label}</span>;
          return s.href ? <Link key={si} href={s.href}>{item}</Link> : <span key={si}>{item}</span>;
        })}
      </div>
    </div>
  );
}
