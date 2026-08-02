import type { PrismaClient } from "@prisma/client";

import { getPrismaAdmin } from "./prisma";
import { metricsRegistry } from "../observability/metrics";

/**
 * PSR-5f — named reasons for background/repair admin pool access.
 * Expand as follow-up clusters migrate off raw getPrismaAdmin.
 */
export const BACKGROUND_ADMIN_REASON = {
  BG_OUTBOX_OPS: "BG_OUTBOX_OPS",
  BG_OUTBOX_REPLAY: "BG_OUTBOX_REPLAY",
  BG_OUTBOX_RECLAIM: "BG_OUTBOX_RECLAIM",
  BG_OUTBOX_RELAY: "BG_OUTBOX_RELAY",
  BG_OUTBOX_RECONCILE: "BG_OUTBOX_RECONCILE",
  BG_FINANCE_RECON: "BG_FINANCE_RECON",
  BG_INTEGRATION_MIGRATION: "BG_INTEGRATION_MIGRATION",
  BG_INTEGRATION_DELIVERY: "BG_INTEGRATION_DELIVERY",
  BG_INTEGRATION_WORKER: "BG_INTEGRATION_WORKER",
  BG_HTTP_IDEMPOTENCY_RECLAIM: "BG_HTTP_IDEMPOTENCY_RECLAIM",
  BG_EVENTS: "BG_EVENTS",
} as const;

export type BackgroundAdminReason =
  (typeof BACKGROUND_ADMIN_REASON)[keyof typeof BACKGROUND_ADMIN_REASON];

/**
 * Thin background/repair admin client — records reason then returns admin Prisma pool.
 */
export function getBackgroundAdminClient(reason: BackgroundAdminReason): PrismaClient {
  metricsRegistry.increment("background_admin_access_total", { reason });
  return getPrismaAdmin();
}
