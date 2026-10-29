import { readFile } from "node:fs/promises";
import { getPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { FIRST_STAGING_TENANT } from "./lib/denali-second-staging-fixtures";
import {
  assertFirstStagingDraftTourHasNoDependencies,
  assertFirstStagingDraftTourManifest,
  assertFirstStagingDraftTourStoredStateMatches,
  buildFirstStagingDraftTourManifest,
  buildFirstStagingDraftTourPlan,
} from "./lib/denali-first-staging-draft-tour-plan";
import { assertFirstStagingDraftTourTarget } from "./lib/denali-first-staging-draft-tour-target";

async function inspectAndMaybeDelete(runId: string, manifestPath: string, apply: boolean) {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_MANIFEST_REJECTED");
  }
  const plan = buildFirstStagingDraftTourPlan(runId);
  const expectedManifest = buildFirstStagingDraftTourManifest(plan);
  assertFirstStagingDraftTourManifest(value, expectedManifest);

  const prisma = getPrisma();
  try {
    return await withTenantRls(
      FIRST_STAGING_TENANT.id,
      async (tx) => {
        const row = await tx.tour.findFirst({
          where: { id: plan.tour.id, tenantId: FIRST_STAGING_TENANT.id },
          select: {
            id: true,
            tenantId: true,
            canonical: true,
            title: true,
            publishStatus: true,
            schemaVersion: true,
            rowVersion: true,
            createdAt: true,
          },
        });
        const exists = assertFirstStagingDraftTourStoredStateMatches(row, plan.tour);

        const dependencies = {
          operatorRegistrations: await tx.operatorRegistration.count({
            where: { tenantId: FIRST_STAGING_TENANT.id, tourId: plan.tour.id },
          }),
          urbanRegistrations: await tx.urbanRegistration.count({
            where: { tenantId: FIRST_STAGING_TENANT.id, tourId: plan.tour.id },
          }),
          transportAllocations: await tx.transportAllocation.count({
            where: { tenantId: FIRST_STAGING_TENANT.id, tourId: plan.tour.id },
          }),
          rosterFreezes: await tx.transportRosterFreeze.count({
            where: { tenantId: FIRST_STAGING_TENANT.id, tourId: plan.tour.id },
          }),
          outboxEvents: await tx.outboxEvent.count({
            where: { tenantId: FIRST_STAGING_TENANT.id, aggregateId: plan.tour.id },
          }),
          exposureReminderActivations: await tx.denaliExposureReminderActivation.count({
            where: { tenantId: FIRST_STAGING_TENANT.id, tourId: plan.tour.id },
          }),
        };
        assertFirstStagingDraftTourHasNoDependencies(dependencies);
        if (!apply || !exists || row === null) return { tour: Number(exists), dependencies };

        const deleted = await tx.tour.deleteMany({
          where: {
            id: plan.tour.id,
            tenantId: FIRST_STAGING_TENANT.id,
            rowVersion: row.rowVersion,
            createdAt: row.createdAt,
          },
        });
        if (deleted.count !== 1) {
          throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_CONCURRENT_CHANGE");
        }
        return { tour: 1, dependencies };
      },
      { isolationLevel: "Serializable" }
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.at(-1) === "--apply";
  const positional = apply ? args.slice(0, -1) : args;
  if (positional.length !== 4 || positional[0] !== "--run-id" || positional[2] !== "--manifest") {
    throw new Error(
      "Usage: cleanup-denali-first-staging-draft-tour.ts --run-id <run-id> --manifest <manifest.json> [--apply]"
    );
  }
  const runId = positional[1]!;
  assertFirstStagingDraftTourTarget(process.env, apply, "cleanup");
  const counts = await inspectAndMaybeDelete(runId, positional[3]!, apply);
  console.log(
    JSON.stringify({
      status: apply
        ? "DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_APPLIED"
        : "DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_DRY_RUN_OK",
      tenantId: FIRST_STAGING_TENANT.id,
      runId,
      counts,
      preserved: ["tenant A", "all B rows", "all registrations and finance data"],
    })
  );
}

main().catch((error: unknown) => {
  const safeMessage =
    error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : undefined;
  console.error(safeMessage ?? "DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_FAILED");
  process.exitCode = 1;
});
