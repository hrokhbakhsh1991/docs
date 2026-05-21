/** Split ISO datetime into Gregorian YMD + HH:mm for Jalali pickers. */
export function parseIsoToYmdAndTime(iso: string | undefined): { ymd: string; time: string } {
  if (!iso?.trim()) {
    return { ymd: "", time: "" };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { ymd: "", time: "" };
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { ymd: `${y}-${m}-${day}`, time: `${hh}:${mm}` };
}

/** Build ISO string from local YMD + 24h time (wizard stores UTC ISO). */
export function combineYmdAndTimeToIso(ymd: string, time: string): string | undefined {
  const datePart = ymd.trim();
  if (!datePart) return undefined;
  const timePart = time.trim() || "08:00";
  const [y, m, d] = datePart.split("-").map((x) => Number(x));
  const [hh, mm] = timePart.split(":").map((x) => Number(x));
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    return undefined;
  }
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString();
}
