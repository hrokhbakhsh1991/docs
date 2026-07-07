const VALID_ROLES = new Set(["owner", "admin", "support"]);

export function parsePlatformOpsSeed(input?: string): Array<{ phone: string; role: string }> {
  const csv = input ?? process.env.PLATFORM_OPS_SEED ?? "";
  if (!csv.trim()) return [];
  return csv
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [phone, role = "owner"] = entry.split(":").map((part) => part.trim());
      if (!phone) return null;
      if (!VALID_ROLES.has(role)) {
        throw new Error(`invalid role in PLATFORM_OPS_SEED entry: ${entry}`);
      }
      return { phone, role };
    })
    .filter((row): row is { phone: string; role: string } => row !== null);
}
