/** Normalizes `user_tenants.labels` jsonb for CASL / capability alias resolution. */
export function normalizeMembershipLabels(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (typeof value === "string") {
    try {
      return normalizeMembershipLabels(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}
