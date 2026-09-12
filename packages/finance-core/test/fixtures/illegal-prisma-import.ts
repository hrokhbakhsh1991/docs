/**
 * NEGATIVE FIXTURE — intentional finance-core boundary breach (Phase 2.2.2).
 * Must NOT be imported by production src. Excluded from monorepo depcruise crawl
 * when DEPCRUISE_MONOREPO_GUARD=1. Scoped cruise must report finance-core-no-prisma.
 */
import { PrismaClient } from "@prisma/client";

/** Keeps the Prisma import as a real type dependency for dependency-cruiser. */
export const illegalPrismaClient = new PrismaClient();
