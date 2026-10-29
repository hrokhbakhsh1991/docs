import { readFile } from "node:fs/promises";
import {
  assertNoSecondStagingFinancialDependencies,
  assertSecondStagingFixtureManifest,
  getSecondStagingCleanupRegistrationIds,
  type SecondStagingFixtureManifest,
} from "./lib/denali-second-staging-cleanup";
import {
  resolveSecondStagingCleanupIdentityIds,
  SECOND_STAGING_TENANT,
} from "./lib/denali-second-staging-fixtures";
import {
  assertSecondStagingFixtureRowMatches,
  buildSecondStagingDataPlan,
} from "./lib/denali-second-staging-data-plan";
import { buildSecondStagingRunFixtureIds } from "./lib/denali-second-staging-run-fixtures";
import { assertSecondTenantStagingTarget } from "./lib/denali-second-staging-target";
import { getPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";

type CleanupCounts = Readonly<{
  registrations: number;
  tours: number;
  equipment: number;
  presets: number;
  destinations: number;
  themes: number;
  regions: number;
}>;

function idsContain(value: unknown, id: string): boolean {
  return Array.isArray(value) && value.includes(id);
}

async function inspectAndMaybeDelete(
  manifest: SecondStagingFixtureManifest,
  apply: boolean
): Promise<CleanupCounts> {
  const plan = buildSecondStagingDataPlan({
    runId: manifest.runId,
    identityUserIds: manifest.identityIds,
  });
  const prisma = getPrisma();
  try {
    return await withTenantRls(
      SECOND_STAGING_TENANT.id,
      async (tx) => {
        const registrationRows = await tx.operatorRegistration.findMany({
          where: {
            tenantId: SECOND_STAGING_TENANT.id,
            id: { in: Object.values(plan.ids.registrations) },
          },
          select: {
            id: true,
            tenantId: true,
            tourId: true,
            tourTitle: true,
            guestLabel: true,
            guestEmail: true,
            guestPhone: true,
            partySize: true,
            status: true,
            paymentStatus: true,
            departureAt: true,
            submittedAt: true,
            submittedByUserId: true,
            registrationIntake: true,
            updatedAt: true,
          },
        });
        const expectedRegistrations = [plan.registrations.free, plan.registrations.paid];
        for (const row of registrationRows) {
          const expected = expectedRegistrations.find((item) => item.id === row.id);
          if (expected === undefined)
            throw new Error("DENALI_SECOND_STAGING_CLEANUP_ROW_COLLISION");
          assertSecondStagingFixtureRowMatches(
            {
              ...row,
              departureAt: row.departureAt.toISOString(),
              submittedAt: row.submittedAt.toISOString(),
            },
            {
              ...expected,
              departureAt: expected.departureAt.toISOString(),
              submittedAt: expected.submittedAt.toISOString(),
            },
            [
              "id",
              "tenantId",
              "tourId",
              "tourTitle",
              "guestLabel",
              "guestEmail",
              "guestPhone",
              "partySize",
              "status",
              "paymentStatus",
              "departureAt",
              "submittedAt",
              "submittedByUserId",
              "registrationIntake",
            ],
            "DENALI_SECOND_STAGING_CLEANUP_ROW_COLLISION"
          );
        }

        const tourRows = await tx.tour.findMany({
          where: { tenantId: SECOND_STAGING_TENANT.id },
          select: { id: true, canonical: true, rowVersion: true, createdAt: true },
        });
        const plannedTourIds = new Set(Object.values(plan.ids.tours));
        const allFixtureResourceIds = [...Object.values(plan.ids.resources)];
        for (const tour of tourRows) {
          const canonical = JSON.stringify(tour.canonical);
          if (
            !plannedTourIds.has(tour.id) &&
            allFixtureResourceIds.some((id) => canonical.includes(id))
          ) {
            throw new Error("DENALI_SECOND_STAGING_CLEANUP_DEPENDENCY_FOUND");
          }
        }
        for (const expected of [plan.tours.free, plan.tours.paid]) {
          const current = tourRows.find((row) => row.id === expected.id);
          if (current !== undefined) {
            assertSecondStagingFixtureRowMatches(
              { canonical: current.canonical },
              { canonical: expected.canonical },
              ["canonical"],
              "DENALI_SECOND_STAGING_CLEANUP_ROW_COLLISION"
            );
          }
        }

        const extraRegistrations = await tx.operatorRegistration.count({
          where: {
            tenantId: SECOND_STAGING_TENANT.id,
            tourId: { in: Object.values(plan.ids.tours) },
            id: { notIn: Object.values(plan.ids.registrations) },
          },
        });
        const urbanRegistrations = await tx.urbanRegistration.count({
          where: {
            tenantId: SECOND_STAGING_TENANT.id,
            tourId: { in: Object.values(plan.ids.tours) },
          },
        });
        const allocations = await tx.transportAllocation.count({
          where: {
            tenantId: SECOND_STAGING_TENANT.id,
            tourId: { in: Object.values(plan.ids.tours) },
          },
        });
        const rosterFreezes = await tx.transportRosterFreeze.count({
          where: {
            tenantId: SECOND_STAGING_TENANT.id,
            tourId: { in: Object.values(plan.ids.tours) },
          },
        });
        if (extraRegistrations + urbanRegistrations + allocations + rosterFreezes > 0) {
          throw new Error("DENALI_SECOND_STAGING_CLEANUP_DEPENDENCY_FOUND");
        }

        const registrationIds = getSecondStagingCleanupRegistrationIds(plan.ids.registrations);
        const financialDependencies = {
          payments: await tx.payment.count({
            where: { tenantId: SECOND_STAGING_TENANT.id, registrationId: { in: registrationIds } },
          }),
          refunds: await tx.financeRefund.count({
            where: { tenantId: SECOND_STAGING_TENANT.id, registrationId: { in: registrationIds } },
          }),
          reconciliationFindings: await tx.financeReconFinding.count({
            where: { tenantId: SECOND_STAGING_TENANT.id, registrationId: { in: registrationIds } },
          }),
          schedules: await tx.financeSchedule.count({
            where: { tenantId: SECOND_STAGING_TENANT.id, registrationId: { in: registrationIds } },
          }),
          commercialQuotes: await tx.financeCommercialQuote.count({
            where: { tenantId: SECOND_STAGING_TENANT.id, registrationId: { in: registrationIds } },
          }),
          paymentHolds: await tx.financePaymentHold.count({
            where: { tenantId: SECOND_STAGING_TENANT.id, registrationId: { in: registrationIds } },
          }),
        };
        assertNoSecondStagingFinancialDependencies(financialDependencies);

        const equipmentRows = await tx.workspaceEquipment.findMany({
          where: { tenantId: SECOND_STAGING_TENANT.id },
          select: { id: true, themeIds: true },
        });
        if (
          equipmentRows.some(
            (row) =>
              row.id !== plan.ids.resources.equipment &&
              idsContain(row.themeIds, plan.ids.resources.theme)
          )
        ) {
          throw new Error("DENALI_SECOND_STAGING_CLEANUP_DEPENDENCY_FOUND");
        }
        const presetRows = await tx.workspaceTourPreset.findMany({
          where: { tenantId: SECOND_STAGING_TENANT.id },
          select: { id: true, themeId: true },
        });
        if (
          presetRows.some(
            (row) =>
              row.id !== plan.ids.resources.preset && row.themeId === plan.ids.resources.theme
          )
        ) {
          throw new Error("DENALI_SECOND_STAGING_CLEANUP_DEPENDENCY_FOUND");
        }
        const extraDestinations = await tx.workspaceDestination.count({
          where: {
            tenantId: SECOND_STAGING_TENANT.id,
            regionId: plan.ids.resources.region,
            id: { not: plan.ids.resources.destination },
          },
        });
        if (extraDestinations > 0)
          throw new Error("DENALI_SECOND_STAGING_CLEANUP_DEPENDENCY_FOUND");

        const resourceRows = [
          {
            read: () =>
              tx.workspaceEquipment.findFirst({
                where: { id: plan.ids.resources.equipment, tenantId: SECOND_STAGING_TENANT.id },
              }),
            expected: plan.catalogs.equipment,
            fields: [
              "id",
              "tenantId",
              "name",
              "category",
              "iconKey",
              "themeIds",
              "sortOrder",
              "createdAt",
              "updatedAt",
            ],
          },
          {
            read: () =>
              tx.workspaceTourTheme.findFirst({
                where: { id: plan.ids.resources.theme, tenantId: SECOND_STAGING_TENANT.id },
              }),
            expected: plan.catalogs.theme,
            fields: [
              "id",
              "tenantId",
              "name",
              "slug",
              "formProfile",
              "iconKey",
              "isActive",
              "sortOrder",
              "createdAt",
              "updatedAt",
            ],
          },
          {
            read: () =>
              tx.workspaceRegion.findFirst({
                where: { id: plan.ids.resources.region, tenantId: SECOND_STAGING_TENANT.id },
              }),
            expected: plan.catalogs.region,
            fields: [
              "id",
              "tenantId",
              "name",
              "country",
              "isActive",
              "sortOrder",
              "createdAt",
              "updatedAt",
            ],
          },
          {
            read: () =>
              tx.workspaceDestination.findFirst({
                where: { id: plan.ids.resources.destination, tenantId: SECOND_STAGING_TENANT.id },
              }),
            expected: plan.catalogs.destination,
            fields: [
              "id",
              "tenantId",
              "regionId",
              "name",
              "locationType",
              "altitudeM",
              "typicalTrailDistanceKm",
              "isActive",
              "sortOrder",
              "createdAt",
              "updatedAt",
            ],
          },
          {
            read: () =>
              tx.workspaceTourPreset.findFirst({
                where: { id: plan.ids.resources.preset, tenantId: SECOND_STAGING_TENANT.id },
              }),
            expected: plan.catalogs.preset,
            fields: [
              "id",
              "tenantId",
              "name",
              "description",
              "themeId",
              "isActive",
              "sortOrder",
              "createdAt",
              "updatedAt",
            ],
          },
        ] as const;
        const found = new Map<string, boolean>();
        const resourceSnapshots = new Map<
          string,
          { name: string; createdAt: Date; updatedAt: Date }
        >();
        for (const resource of resourceRows) {
          const row = await resource.read();
          found.set(resource.expected.id, row !== null);
          if (row !== null) {
            assertSecondStagingFixtureRowMatches(
              row as Readonly<Record<string, unknown>>,
              resource.expected,
              resource.fields,
              "DENALI_SECOND_STAGING_CLEANUP_ROW_COLLISION"
            );
            resourceSnapshots.set(resource.expected.id, {
              name: row.name,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            });
          }
        }

        const counts: CleanupCounts = {
          registrations: registrationRows.length,
          tours: tourRows.filter((row) => plannedTourIds.has(row.id)).length,
          equipment: Number(found.get(plan.ids.resources.equipment) ?? false),
          themes: Number(found.get(plan.ids.resources.theme) ?? false),
          regions: Number(found.get(plan.ids.resources.region) ?? false),
          destinations: Number(found.get(plan.ids.resources.destination) ?? false),
          presets: Number(found.get(plan.ids.resources.preset) ?? false),
        };
        if (!apply) return counts;

        const registrationDelete = await tx.operatorRegistration.deleteMany({
          where: {
            tenantId: SECOND_STAGING_TENANT.id,
            OR: registrationRows.map((row) => ({ id: row.id, updatedAt: row.updatedAt })),
          },
        });
        if (registrationDelete.count !== registrationRows.length) {
          throw new Error("DENALI_SECOND_STAGING_CLEANUP_CONCURRENT_CHANGE");
        }

        const toursToDelete = tourRows.filter((row) => plannedTourIds.has(row.id));
        const tourDelete = await tx.tour.deleteMany({
          where: {
            tenantId: SECOND_STAGING_TENANT.id,
            OR: toursToDelete.map((row) => ({
              id: row.id,
              rowVersion: row.rowVersion,
              createdAt: row.createdAt,
            })),
          },
        });
        if (tourDelete.count !== toursToDelete.length) {
          throw new Error("DENALI_SECOND_STAGING_CLEANUP_CONCURRENT_CHANGE");
        }

        const deleteResource = async (
          id: string,
          runDelete: (where: {
            tenantId: string;
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
          }) => Promise<{ count: number }>
        ): Promise<void> => {
          const snapshot = resourceSnapshots.get(id);
          if (snapshot === undefined) return;
          const result = await runDelete({
            tenantId: SECOND_STAGING_TENANT.id,
            id,
            name: snapshot.name,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
          });
          if (result.count !== 1)
            throw new Error("DENALI_SECOND_STAGING_CLEANUP_CONCURRENT_CHANGE");
        };
        await deleteResource(plan.ids.resources.preset, (where) =>
          tx.workspaceTourPreset.deleteMany({ where })
        );
        await deleteResource(plan.ids.resources.equipment, (where) =>
          tx.workspaceEquipment.deleteMany({ where })
        );
        await deleteResource(plan.ids.resources.destination, (where) =>
          tx.workspaceDestination.deleteMany({ where })
        );
        await deleteResource(plan.ids.resources.theme, (where) =>
          tx.workspaceTourTheme.deleteMany({ where })
        );
        await deleteResource(plan.ids.resources.region, (where) =>
          tx.workspaceRegion.deleteMany({ where })
        );
        return counts;
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
  if (positional.length !== 2 || positional[0] !== "--manifest") {
    throw new Error(
      "Usage: cleanup-denali-second-staging-fixtures.ts --manifest <seed-manifest.json> [--apply]"
    );
  }
  assertSecondTenantStagingTarget(process.env, apply, "cleanup");
  let value: unknown;
  try {
    value = JSON.parse(await readFile(positional[1]!, "utf8"));
  } catch {
    throw new Error("DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED");
  }
  const record = value as Record<string, unknown>;
  const runId = record.runId;
  if (typeof runId !== "string") throw new Error("DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED");
  const identityIds = resolveSecondStagingCleanupIdentityIds(record.identityIds);
  const expected = buildSecondStagingRunFixtureIds({
    tenantId: SECOND_STAGING_TENANT.id,
    runId,
    identityUserIds: identityIds,
  });
  assertSecondStagingFixtureManifest(value, expected);
  const counts = await inspectAndMaybeDelete(value, apply);
  console.log(
    JSON.stringify({
      status: apply
        ? "DENALI_SECOND_STAGING_CLEANUP_APPLIED"
        : "DENALI_SECOND_STAGING_CLEANUP_DRY_RUN_OK",
      tenantId: SECOND_STAGING_TENANT.id,
      runId,
      counts,
      preserved: ["tenant", "identities", "wizard_template", "other tenant data"],
    })
  );
}

main().catch((error: unknown) => {
  const safeMessage =
    error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : undefined;
  console.error(safeMessage ?? "DENALI_SECOND_STAGING_CLEANUP_FAILED");
  process.exitCode = 1;
});
