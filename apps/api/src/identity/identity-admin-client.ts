import type { PrismaClient } from "@prisma/client";

import { getPrismaAdmin } from "../db/prisma";
import { metricsRegistry } from "../observability/metrics";

/**
 * PSR-5g — named reasons for identity FORCE-RLS admin pool access
 * (pre-tenant user / OTP / invite accept / session bump).
 */
export const IDENTITY_ADMIN_REASON = {
  ID_USER_READ: "ID_USER_READ",
  ID_USER_WRITE: "ID_USER_WRITE",
  ID_OTP: "ID_OTP",
  ID_PENDING_INVITE: "ID_PENDING_INVITE",
  ID_SESSION_BUMP: "ID_SESSION_BUMP",
} as const;

export type IdentityAdminReason =
  (typeof IDENTITY_ADMIN_REASON)[keyof typeof IDENTITY_ADMIN_REASON];

/**
 * Thin identity admin client — records reason then returns admin Prisma pool.
 * Prefer this over raw {@link getPrismaAdmin} in prisma-identity.repository (PSR-5g).
 */
export function getIdentityAdminClient(reason: IdentityAdminReason): PrismaClient {
  metricsRegistry.increment("identity_admin_access_total", { reason });
  return getPrismaAdmin();
}
