/**
 * WALLET-P3C — engagement seed for Denali Wallet pilot entitled member (dashboard integration).
 */
import { DENALI_WALLET_PILOT } from "../test/fixtures/denali-wallet-pilot-tenant";
import { createPrismaEngagementRepository } from "../src/workspace-engagement/infrastructure/prisma-engagement.repository";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";

const WORKSPACE_ID = "denali";

export async function seedDenaliWalletPilotEngagement(): Promise<void> {
  const repo = createPrismaEngagementRepository();
  await runWithTenantContext(DENALI_WALLET_PILOT.tenantId, () =>
    repo.awardPoints({
      tenantId: DENALI_WALLET_PILOT.tenantId,
      workspaceId: WORKSPACE_ID,
      userId: DENALI_WALLET_PILOT.entitledMemberUserId,
      pointsDelta: 50,
      sourceModule: "identity",
      sourceEventType: "profile.completed",
      dedupeKey: "engagement:denali-wallet-pilot:profile",
      reason: "Denali wallet pilot engagement integration seed",
    }),
  );
}
