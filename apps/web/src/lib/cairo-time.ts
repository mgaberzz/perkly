const TZ = "Africa/Cairo";

/** Offset (minutes) of Africa/Cairo at a given instant (handles Egypt's DST). */
function cairoOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at).reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "2026-11-01T18:00" typed as Cairo local time → ISO string (UTC). */
export function cairoLocalToISO(value: string | null | undefined): string | null {
  if (!value) return null;
  const naive = new Date(value + "Z");
  if (Number.isNaN(naive.getTime())) return null;
  const offset = cairoOffsetMinutes(new Date(naive.getTime()));
  return new Date(naive.getTime() - offset * 60000).toISOString();
}

/** ISO → "YYYY-MM-DDTHH:mm" in Cairo time, for datetime-local inputs. */
export function isoToCairoLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() + cairoOffsetMinutes(d) * 60000);
  return local.toISOString().slice(0, 16);
}
