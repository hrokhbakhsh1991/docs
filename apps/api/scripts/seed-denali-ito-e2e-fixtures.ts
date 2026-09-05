/**
 * ITO-C04/C07 + portal E2E — idempotent Denali club execution fixtures (tenant …000003).
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { DENALI_CLUB_DEV_PUBLISHED_TOUR_ID } from "../src/fixtures/operator-smoke-published-tour.fixture";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { ProvisioningService } from "../src/internal/provisioning.service";
import { processOutboxRelayForTenantOnce } from "../src/outbox/outbox-relay";
import { seedWorkspaceWizardTemplateForTenant } from "../src/settings/seed-workspace-wizard-template";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { DENALI_DEFAULT_WALLET } from "../test/fixtures/denali-default-wallet-tenant";
import {
  getOrBootstrapTourExecution,
  lockTourExecutionManifest,
  patchTourExecutionSchedule,
  patchTourExecutionLocation,
  patchTourExecutionTourLeader,
  transitionTourExecutionState,
} from "../src/tour-execution/tour-execution.service";

import { seedDenaliDevCatalogStaging } from "./seed-denali-dev-catalog-staging";
import { seedDenaliDefaultWallet } from "./seed-denali-default-wallet";
import { DENALI_DEV_OWNER_USER_ID, seedDenaliOperatorIdentity } from "./seed-denali-operator-identity";

export const DENALI_ITO_E2E_REGISTRATION_ID =
  "00000000-0000-4000-8000-000000000501" as const;

export const DENALI_ITO_E2E_TOUR_ID = DENALI_CLUB_DEV_PUBLISHED_TOUR_ID;

function ownerAuth(): TenantAuthContext {
  return {
    tenantId: DENALI_SMOKE_TENANT_ID,
    userId: DENALI_DEV_OWNER_USER_ID,
    role: "owner",
    status: "ACTIVE",
    workspaceId: DENALI_DEFAULT_WALLET.workspaceId,
  };
}

async function upsertApprovedMemberRegistration(): Promise<void> {
  await withTenantRls(DENALI_SMOKE_TENANT_ID, (tx) =>
    tx.operatorRegistration.upsert({
      where: { id: DENALI_ITO_E2E_REGISTRATION_ID },
      create: {
        id: DENALI_ITO_E2E_REGISTRATION_ID,
        tenantId: DENALI_SMOKE_TENANT_ID,
        tourId: DENALI_ITO_E2E_TOUR_ID,
        tourTitle: "North Ridge Trek",
        guestLabel: "ITO E2E Member Guest",
        guestPhone: DENALI_DEFAULT_WALLET.entitledMemberMobile,
        partySize: 1,
        status: "approved",
        paymentStatus: "paid",
        departureAt: new Date("2026-09-10T08:00:00.000Z"),
        submittedAt: new Date("2026-08-01T10:00:00.000Z"),
        submittedByUserId: DENALI_DEFAULT_WALLET.entitledMemberUserId,
        approvedAt: new Date("2026-08-02T10:00:00.000Z"),
        registrationIntake: { insuranceStatus: "confirmed", tourCapacityMax: 20 },
      },
      update: {
        tourId: DENALI_ITO_E2E_TOUR_ID,
        status: "approved",
        paymentStatus: "paid",
        submittedByUserId: DENALI_DEFAULT_WALLET.entitledMemberUserId,
        guestLabel: "ITO E2E Member Guest",
        guestPhone: DENALI_DEFAULT_WALLET.entitledMemberMobile,
        registrationIntake: { insuranceStatus: "confirmed", tourCapacityMax: 20 },
      },
    }),
  );
}

async function seedTourExecutionDesk(): Promise<void> {
  const auth = ownerAuth();
  await getOrBootstrapTourExecution(auth, DENALI_ITO_E2E_TOUR_ID);
  await lockTourExecutionManifest(auth, DENALI_ITO_E2E_TOUR_ID);
  await patchTourExecutionTourLeader({
    auth,
    tourId: DENALI_ITO_E2E_TOUR_ID,
    tourLeaderUserId: DENALI_DEV_OWNER_USER_ID,
    idempotencyKey: "ito-e2e-leader",
  });
  await patchTourExecutionSchedule({
    auth,
    tourId: DENALI_ITO_E2E_TOUR_ID,
    scheduledMeetingAt: new Date("2026-09-10T07:30:00.000Z").toISOString(),
    idempotencyKey: "ito-e2e-schedule",
  });
  await patchTourExecutionLocation({
    auth,
    tourId: DENALI_ITO_E2E_TOUR_ID,
    meetingLocation: "Denali club gate — ITO E2E meeting point",
    idempotencyKey: "ito-e2e-location",
  });

  let view = await getOrBootstrapTourExecution(auth, DENALI_ITO_E2E_TOUR_ID);
  if (view.state === "manifest_locked") {
    view = await transitionTourExecutionState({
      auth,
      tourId: DENALI_ITO_E2E_TOUR_ID,
      targetState: "pre_tour",
      expectedVersion: view.rowVersion,
    });
  }
  if (view.state === "pre_tour") {
    view = await transitionTourExecutionState({
      auth,
      tourId: DENALI_ITO_E2E_TOUR_ID,
      targetState: "in_progress",
      expectedVersion: view.rowVersion,
    });
  }

  await processOutboxRelayForTenantOnce(DENALI_SMOKE_TENANT_ID);
}

export async function seedDenaliItoE2eFixtures(): Promise<void> {
  await new ProvisioningService().seedDenaliSmokeTenant();
  await seedWorkspaceWizardTemplateForTenant(DENALI_SMOKE_TENANT_ID);
  await seedDenaliOperatorIdentity();
  await seedDenaliDefaultWallet();
  await seedDenaliDevCatalogStaging();
  await upsertApprovedMemberRegistration();
  await runWithTenantContext(
    DENALI_SMOKE_TENANT_ID,
    () => seedTourExecutionDesk(),
    { actorId: DENALI_DEV_OWNER_USER_ID },
  );
}

async function main(): Promise<void> {
  await seedDenaliItoE2eFixtures();
  console.log(
    JSON.stringify({
      tenantId: DENALI_SMOKE_TENANT_ID,
      tourId: DENALI_ITO_E2E_TOUR_ID,
      registrationId: DENALI_ITO_E2E_REGISTRATION_ID,
      memberUserId: DENALI_DEFAULT_WALLET.entitledMemberUserId,
      leaderUserId: DENALI_DEV_OWNER_USER_ID,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
