export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="perk-gradient grid h-8 w-8 place-items-center rounded-xl text-white">P</span>
      <span>Perkly</span>
    </span>
  );
}
