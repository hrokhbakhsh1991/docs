const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoToYmdAndTime(iso: string): { ymd: string; time: string } {
  const trimmed = iso.trim();
  if (trimmed.length === 0) {
    return { ymd: "", time: "" };
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    const [ymd = "", time = ""] = trimmed.split("T");
    return { ymd: YMD_RE.test(ymd) ? ymd : "", time };
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return { ymd: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}
