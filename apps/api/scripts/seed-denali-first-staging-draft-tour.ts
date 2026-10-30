import { Prisma } from "@prisma/client";
import { getPrismaAdmin, getPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { FIRST_STAGING_TENANT } from "./lib/denali-second-staging-fixtures";
import {
  assertFirstStagingDraftTourStoredStateMatches,
  buildFirstStagingDraftTourManifest,
  buildFirstStagingDraftTourPlan,
} from "./lib/denali-first-staging-draft-tour-plan";
import { assertFirstStagingDraftTourTarget } from "./lib/denali-first-staging-draft-tour-target";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";

async function seedTour(runId: string): Promise<void> {
  const plan = buildFirstStagingDraftTourPlan(runId);
  const admin = getPrismaAdmin();
  const app = getPrisma();
  try {
    const existingGlobal = await admin.tour.findUnique({
      where: { id: plan.tour.id },
      select: { id: true, tenantId: true, canonical: true },
    });
    if (existingGlobal !== null && existingGlobal.tenantId !== FIRST_STAGING_TENANT.id) {
      throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_COLLISION");
    }

    await runWithTenantContext(
      FIRST_STAGING_TENANT.id,
      async () => {
        await withTenantRls(
          FIRST_STAGING_TENANT.id,
          async (tx) => {
            const current = await tx.tour.findUnique({
              where: { tenantId_id: { tenantId: FIRST_STAGING_TENANT.id, id: plan.tour.id } },
              select: {
                tenantId: true,
                canonical: true,
                title: true,
                publishStatus: true,
                schemaVersion: true,
                rowVersion: true,
                createdAt: true,
              },
            });
            const exists = assertFirstStagingDraftTourStoredStateMatches(current, plan.tour);
            if (exists) return;
            await tx.tour.create({
              data: {
                id: plan.tour.id,
                tenantId: plan.tour.tenantId,
                canonical: plan.tour.canonical as unknown as Prisma.InputJsonValue,
                title: String(plan.tour.canonical.data.title ?? ""),
                publishStatus: "draft",
                publishedAt: null,
                schemaVersion: plan.tour.canonical.schemaVersion,
                rowVersion: plan.tour.rowVersion,
                createdAt: new Date(plan.tour.createdAt),
              },
            });
          },
          { isolationLevel: "Serializable" }
        );
      },
      { workspaceType: FIRST_STAGING_TENANT.workspaceType, tenantTier: "pool" }
    );
  } finally {
    await app.$disconnect();
    await admin.$disconnect();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args.at(-1);
  const apply = mode === "--apply";
  const manifestOnly = mode === "--manifest-only";
  const positional = apply || manifestOnly ? args.slice(0, -1) : args;
  if (positional.length !== 2 || positional[0] !== "--run-id") {
    throw new Error(
      "Usage: seed-denali-first-staging-draft-tour.ts --run-id <run-id> [--apply|--manifest-only]"
    );
  }
  const runId = positional[1]!;
  assertFirstStagingDraftTourTarget(process.env, apply, "seed");
  const plan = buildFirstStagingDraftTourPlan(runId);
  if (manifestOnly) {
    console.log(JSON.stringify(buildFirstStagingDraftTourManifest(plan)));
    return;
  }
  if (!apply) {
    console.log(
      `DENALI_FIRST_STAGING_DRAFT_TOUR_DRY_RUN_OK tenantId=${plan.tenantId} runId=${plan.runId} tours=1 registrations=0 payments=0 outbox=0`
    );
    return;
  }
  await seedTour(runId);
  console.error("DENALI_FIRST_STAGING_DRAFT_TOUR_SEED_OK");
  console.log(JSON.stringify(buildFirstStagingDraftTourManifest(plan)));
}

main().catch((error: unknown) => {
  const safeMessage =
    error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : undefined;
  console.error(safeMessage ?? "DENALI_FIRST_STAGING_DRAFT_TOUR_SEED_FAILED");
  process.exitCode = 1;
});
