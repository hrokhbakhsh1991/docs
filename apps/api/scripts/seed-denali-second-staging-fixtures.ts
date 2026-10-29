import { Prisma } from "@prisma/client";
import {
  SECOND_STAGING_IDENTITY_IDS,
  assertSecondStagingFixtureIdentityMembership,
  assertSecondStagingIdentityLoginPolicy,
  SECOND_STAGING_TENANT,
} from "./lib/denali-second-staging-fixtures";
import {
  assertSecondStagingFixtureRowMatches,
  buildSecondStagingDataPlan,
  isSecondStagingWizardTemplateReady,
} from "./lib/denali-second-staging-data-plan";
import { assertSecondTenantStagingTarget } from "./lib/denali-second-staging-target";
import { getPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS } from "../src/settings/workspace-dev-bootstrap-bindings.generated";
import { PrismaTourRepository } from "../src/storage/prisma-tour.repository";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";

async function seedResourcesAndWizard(
  tx: Prisma.TransactionClient,
  plan: ReturnType<typeof buildSecondStagingDataPlan>
): Promise<void> {
  const { catalogs } = plan;
  const equipment = catalogs.equipment;
  const existingEquipment = await tx.workspaceEquipment.findUnique({
    where: { id: equipment.id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      category: true,
      iconKey: true,
      themeIds: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const equipmentExists = assertSecondStagingFixtureRowMatches(
    existingEquipment,
    equipment,
    [
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
    "DENALI_SECOND_STAGING_FIXTURE_EQUIPMENT_COLLISION"
  );
  if (!equipmentExists) {
    await tx.workspaceEquipment.create({
      data: {
        ...equipment,
        themeIds: [...equipment.themeIds] as Prisma.InputJsonArray,
        createdAt: new Date(equipment.createdAt),
        updatedAt: new Date(equipment.updatedAt),
      },
    });
  }

  const theme = catalogs.theme;
  const existingTheme = await tx.workspaceTourTheme.findUnique({
    where: { id: theme.id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      slug: true,
      formProfile: true,
      iconKey: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const themeExists = assertSecondStagingFixtureRowMatches(
    existingTheme,
    theme,
    [
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
    "DENALI_SECOND_STAGING_FIXTURE_THEME_COLLISION"
  );
  if (!themeExists) {
    await tx.workspaceTourTheme.create({
      data: {
        ...theme,
        createdAt: new Date(theme.createdAt),
        updatedAt: new Date(theme.updatedAt),
      },
    });
  }

  const region = catalogs.region;
  const existingRegion = await tx.workspaceRegion.findUnique({
    where: { id: region.id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      country: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const regionExists = assertSecondStagingFixtureRowMatches(
    existingRegion,
    region,
    ["id", "tenantId", "name", "country", "isActive", "sortOrder", "createdAt", "updatedAt"],
    "DENALI_SECOND_STAGING_FIXTURE_REGION_COLLISION"
  );
  if (!regionExists) {
    await tx.workspaceRegion.create({
      data: {
        ...region,
        createdAt: new Date(region.createdAt),
        updatedAt: new Date(region.updatedAt),
      },
    });
  }

  const destination = catalogs.destination;
  const existingDestination = await tx.workspaceDestination.findUnique({
    where: { id: destination.id },
    select: {
      id: true,
      tenantId: true,
      regionId: true,
      name: true,
      locationType: true,
      altitudeM: true,
      typicalTrailDistanceKm: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const destinationExists = assertSecondStagingFixtureRowMatches(
    existingDestination,
    destination,
    [
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
    "DENALI_SECOND_STAGING_FIXTURE_DESTINATION_COLLISION"
  );
  if (!destinationExists) {
    await tx.workspaceDestination.create({
      data: {
        ...destination,
        createdAt: new Date(destination.createdAt),
        updatedAt: new Date(destination.updatedAt),
      },
    });
  }

  const preset = catalogs.preset;
  const existingPreset = await tx.workspaceTourPreset.findUnique({
    where: { id: preset.id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      description: true,
      themeId: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const presetExists = assertSecondStagingFixtureRowMatches(
    existingPreset,
    preset,
    [
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
    "DENALI_SECOND_STAGING_FIXTURE_PRESET_COLLISION"
  );
  if (!presetExists) {
    await tx.workspaceTourPreset.create({
      data: {
        ...preset,
        createdAt: new Date(preset.createdAt),
        updatedAt: new Date(preset.updatedAt),
      },
    });
  }

  for (const label of Object.keys(
    SECOND_STAGING_IDENTITY_IDS
  ) as (keyof typeof SECOND_STAGING_IDENTITY_IDS)[]) {
    const membership = await tx.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: SECOND_STAGING_IDENTITY_IDS[label],
          tenantId: SECOND_STAGING_TENANT.id,
        },
      },
      select: { userId: true, role: true, status: true, workspaceId: true },
    });
    assertSecondStagingFixtureIdentityMembership(label, membership);
  }

  const wizardBinding = WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS.find(
    (binding) => binding.workspaceId === SECOND_STAGING_TENANT.workspaceType
  );
  if (wizardBinding === undefined) {
    throw new Error("DENALI_SECOND_STAGING_WIZARD_BINDING_MISSING");
  }
  const existingWizard = await tx.tenantConfig.findUnique({
    where: {
      tenantId_configKey: {
        tenantId: SECOND_STAGING_TENANT.id,
        configKey: "wizard_template",
      },
    },
    select: { payload: true },
  });
  if (existingWizard !== null) {
    if (
      !isSecondStagingWizardTemplateReady(existingWizard.payload, wizardBinding.minPublishedSteps)
    ) {
      throw new Error("DENALI_SECOND_STAGING_WIZARD_TEMPLATE_COLLISION");
    }
  } else {
    await tx.tenantConfig.create({
      data: {
        tenantId: SECOND_STAGING_TENANT.id,
        configKey: "wizard_template",
        configVersion: 1,
        payload: wizardBinding.buildPayload() as Prisma.InputJsonValue,
      },
    });
  }
}

async function seedTours(plan: ReturnType<typeof buildSecondStagingDataPlan>): Promise<void> {
  await runWithTenantContext(
    SECOND_STAGING_TENANT.id,
    async () => {
      const repo = new PrismaTourRepository();
      for (const tour of [plan.tours.free, plan.tours.paid]) {
        const existing = await repo.getById(tour.id, SECOND_STAGING_TENANT.id);
        if (existing !== null) {
          assertSecondStagingFixtureRowMatches(
            { canonical: existing.canonical },
            { canonical: tour.canonical },
            ["canonical"],
            "DENALI_SECOND_STAGING_FIXTURE_TOUR_COLLISION"
          );
          continue;
        }
        await repo.save(tour);
      }
    },
    { workspaceType: SECOND_STAGING_TENANT.workspaceType, tenantTier: "pool" }
  );
}

async function seedRegistrations(
  plan: ReturnType<typeof buildSecondStagingDataPlan>
): Promise<void> {
  await withTenantRls(SECOND_STAGING_TENANT.id, async (tx) => {
    for (const registration of [plan.registrations.free, plan.registrations.paid]) {
      const existing = await tx.operatorRegistration.findUnique({
        where: { id: registration.id },
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
        },
      });
      const expected = {
        ...registration,
        departureAt: registration.departureAt.toISOString(),
        submittedAt: registration.submittedAt.toISOString(),
      };
      const actual =
        existing === null
          ? null
          : {
              ...existing,
              departureAt: existing.departureAt.toISOString(),
              submittedAt: existing.submittedAt.toISOString(),
            };
      const exists = assertSecondStagingFixtureRowMatches(
        actual,
        expected,
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
        "DENALI_SECOND_STAGING_FIXTURE_REGISTRATION_COLLISION"
      );
      if (!exists) {
        await tx.operatorRegistration.create({
          data: {
            ...registration,
            registrationIntake: registration.registrationIntake as Prisma.InputJsonValue,
          },
        });
      }
    }
  });
}

async function applyFixturePlan(
  plan: ReturnType<typeof buildSecondStagingDataPlan>
): Promise<void> {
  const prisma = getPrisma();
  try {
    await withTenantRls(SECOND_STAGING_TENANT.id, (tx) => seedResourcesAndWizard(tx, plan));
    await seedTours(plan);
    await seedRegistrations(plan);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.at(-1) === "--apply";
  const positional = apply ? args.slice(0, -1) : args;
  if (positional.length !== 2 || positional[0] !== "--run-id") {
    throw new Error("Usage: seed-denali-second-staging-fixtures.ts --run-id <run-id> [--apply]");
  }

  const runId = positional[1]!;
  assertSecondTenantStagingTarget(process.env, apply, "fixtures");
  const plan = buildSecondStagingDataPlan({ runId, identityUserIds: SECOND_STAGING_IDENTITY_IDS });
  if (!apply) {
    console.log(
      `DENALI_SECOND_STAGING_FIXTURES_DRY_RUN_OK tenantId=${plan.ids.tenantId} runId=${plan.ids.runId} resources=5 tours=2 registrations=2 wizard=tenant-config outbox=none`
    );
    return;
  }

  assertSecondStagingIdentityLoginPolicy(process.env);
  await applyFixturePlan(plan);
  console.log(
    JSON.stringify({
      status: "DENALI_SECOND_STAGING_FIXTURES_SEED_OK",
      manifestVersion: 1,
      source: "denali-second-staging-fixtures",
      tenantId: plan.ids.tenantId,
      runId: plan.ids.runId,
      identityIds: plan.ids.identities,
      resources: plan.ids.resources,
      tours: plan.ids.tours,
      registrations: plan.ids.registrations,
      resourceIds: Object.values(plan.ids.resources),
      tourIds: Object.values(plan.ids.tours),
      registrationIds: Object.values(plan.ids.registrations),
      wizard: "wizard_template",
      outboxWrites: 0,
    })
  );
}

main().catch((error: unknown) => {
  const safeMessage =
    error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : undefined;
  console.error(safeMessage ?? "DENALI_SECOND_STAGING_FIXTURES_SEED_FAILED");
  process.exitCode = 1;
});
