import Image from "next/image";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <Image src="/perkly-mark.png" alt="" width={32} height={32} className="h-8 w-8 rounded-xl shadow-sm ring-1 ring-white/30" priority />
      <span>Perkly</span>
    </span>
  );
}
