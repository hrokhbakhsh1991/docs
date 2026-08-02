import type { PrismaClient } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";
import { metricsRegistry } from "../observability/metrics";

/**
 * PSR-5e — named reasons for platform control-plane admin pool access.
 * Expand as follow-up clusters migrate off raw getPrismaAdmin.
 */
export const PLATFORM_ADMIN_REASON = {
  PLATFORM_OPS_USER: "PLATFORM_OPS_USER",
  PLATFORM_AUDIT: "PLATFORM_AUDIT",
  PLATFORM_IMPERSONATION: "PLATFORM_IMPERSONATION",
  PLATFORM_TENANT_LIFECYCLE: "PLATFORM_TENANT_LIFECYCLE",
  PLATFORM_BILLING: "PLATFORM_BILLING",
  PLATFORM_WORKSPACE_DEFINITION: "PLATFORM_WORKSPACE_DEFINITION",
  PLATFORM_DOMAIN: "PLATFORM_DOMAIN",
  PLATFORM_GDPR: "PLATFORM_GDPR",
  PLATFORM_SITE_SURFACES: "PLATFORM_SITE_SURFACES",
  PLATFORM_PLAN: "PLATFORM_PLAN",
  PLATFORM_PROVISION: "PLATFORM_PROVISION",
  PLATFORM_TENANT: "PLATFORM_TENANT",
} as const;

export type PlatformAdminReason =
  (typeof PLATFORM_ADMIN_REASON)[keyof typeof PLATFORM_ADMIN_REASON];

/**
 * Thin control-plane admin client — records reason then returns admin Prisma pool.
 * Prefer this over raw {@link getPrismaAdmin} in platform/* (PSR-5 item 5).
 */
export function getPlatformAdminClient(reason: PlatformAdminReason): PrismaClient {
  metricsRegistry.increment("platform_admin_access_total", { reason });
  return getPrismaAdmin();
}
