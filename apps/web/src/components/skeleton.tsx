/** Shown instantly while a portal page loads, so taps feel immediate. */
export function PageSkeleton() {
  const b = "animate-pulse rounded-2xl bg-zinc-200/70";
  return (
    <div aria-busy="true" className="space-y-5">
      <div className={`${b} h-8 w-48`} />
      <div className={`${b} h-4 w-72 max-w-full`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={`${b} h-24`} />)}</div>
      <div className={`${b} h-56`} />
      <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className={`${b} h-16`} />)}</div>
    </div>
  );
}
