export function readPlatformOpsPhones(input?: string): string[] {
  const csv = input ?? process.env.PLATFORM_OPS_PHONES ?? "";
  if (!csv.trim()) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
