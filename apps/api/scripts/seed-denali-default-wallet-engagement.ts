/**
 * WALLET-P3C — engagement seed for Denali default club entitled member.
 */
import { DENALI_DEFAULT_WALLET } from "../test/fixtures/denali-default-wallet-tenant";
import { createPrismaEngagementRepository } from "../src/workspace-engagement/infrastructure/prisma-engagement.repository";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";

const WORKSPACE_ID = "denali";

export async function seedDenaliDefaultWalletEngagement(): Promise<void> {
  const repo = createPrismaEngagementRepository();
  await runWithTenantContext(DENALI_DEFAULT_WALLET.tenantId, () =>
    repo.awardPoints({
      tenantId: DENALI_DEFAULT_WALLET.tenantId,
      workspaceId: WORKSPACE_ID,
      userId: DENALI_DEFAULT_WALLET.entitledMemberUserId,
      pointsDelta: 50,
      sourceModule: "identity",
      sourceEventType: "profile.completed",
      dedupeKey: "engagement:denali-default-wallet:profile",
      reason: "Denali default club wallet integration seed",
    }),
  );
}
