import { resolveTenantThemeJsonById } from "./resolve-registered-tenant";

export type TenantPriorityTier = "low" | "normal" | "high";

const VALID_TIERS = new Set<TenantPriorityTier>(["low", "normal", "high"]);

/**
 * Parses `tenants.theme.priorityTier` (DEC-114 / SCAL-LIM-05).
 */
export function parsePriorityTierFromTheme(theme: unknown): TenantPriorityTier {
  if (theme === null || typeof theme !== "object") {
    return "normal";
  }
  const raw = (theme as Record<string, unknown>).priorityTier;
  if (typeof raw === "string" && VALID_TIERS.has(raw as TenantPriorityTier)) {
    return raw as TenantPriorityTier;
  }
  return "normal";
}

export async function resolveTenantPriorityTier(tenantId: string): Promise<TenantPriorityTier> {
  const theme = await resolveTenantThemeJsonById(tenantId);
  return parsePriorityTierFromTheme(theme);
}
