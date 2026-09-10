/**
 * WALLET-V1 — idempotent Postgres seed for Denali default club wallet (tenant …000003).
 */
import { fileURLToPath } from "node:url";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { DENALI_DEFAULT_WALLET } from "../test/fixtures/denali-default-wallet-tenant";
import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { ProvisioningService } from "../src/internal/provisioning.service";
import { logger } from "../src/observability/logger";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";
import { PrismaWalletRepository } from "../src/workspace-wallet/infrastructure/prisma-wallet.repository";
import { seedDenaliOperatorIdentity } from "./seed-denali-operator-identity";
import { seedDenaliDefaultWalletEngagement } from "./seed-denali-default-wallet-engagement";
import { ensureAppTourCanReadMigrationHead } from "./seed-wallet-ws1-certification";

function memberScope(userId: string) {
  return {
    tenantId: DENALI_DEFAULT_WALLET.tenantId,
    workspaceId: DENALI_DEFAULT_WALLET.workspaceId,
    userId,
  };
}

function actor(operatorId: string) {
  return { actorUserId: operatorId, actorRole: "operator" as const };
}

async function upsertUser(userId: string, mobile: string): Promise<void> {
  const prisma = getPrismaAdmin();
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, mobile },
    update: { mobile },
  });
}

async function upsertMembership(input: {
  readonly userId: string;
  readonly role: "owner" | "member";
  readonly portalModuleGrants?: readonly string[];
}): Promise<void> {
  const membershipMetadata =
    input.portalModuleGrants !== undefined && input.portalModuleGrants.length > 0
      ? { portalModuleGrants: [...input.portalModuleGrants] }
      : {};

  await withTenantRls(DENALI_DEFAULT_WALLET.tenantId, (tx) =>
    tx.userTenant.upsert({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: DENALI_DEFAULT_WALLET.tenantId,
        },
      },
      create: {
        userId: input.userId,
        tenantId: DENALI_DEFAULT_WALLET.tenantId,
        role: input.role,
        status: "ACTIVE",
        sessionVersion: 1,
        workspaceId: DENALI_DEFAULT_WALLET.workspaceId,
        membershipMetadata,
      },
      update: {
        role: input.role,
        status: "ACTIVE",
        workspaceId: DENALI_DEFAULT_WALLET.workspaceId,
        membershipMetadata,
      },
    }),
  );
}

async function seedWalletLedgerHistory(): Promise<void> {
  const repo = new PrismaWalletRepository();
  const operatorId = DENALI_DEFAULT_WALLET.ownerUserId;
  const entitledMemberId = DENALI_DEFAULT_WALLET.entitledMemberUserId;
  const scope = memberScope(entitledMemberId);

  const existing = await runWithTenantContext(
    DENALI_DEFAULT_WALLET.tenantId,
    () => repo.findMemberAccount(scope),
    { actorId: operatorId },
  );
  if (existing.ok && existing.value !== null) {
    logger.info(
      { event: "db.seed.denali_default_wallet.skip_wallet", accountId: existing.value.id },
      "denali default wallet ledger already seeded",
    );
    return;
  }

  const account = await runWithTenantContext(
    DENALI_DEFAULT_WALLET.tenantId,
    () =>
      repo.getOrCreateAccount({
        ...scope,
        currency: DENALI_DEFAULT_WALLET.currency,
        accountId: DENALI_DEFAULT_WALLET.accountId,
      }),
    { actorId: operatorId },
  );
  if (!account.ok) {
    throw new Error(`DENALI_DEFAULT_WALLET_SEED_ACCOUNT_FAILED:${account.error.code}`);
  }

  await runWithTenantContext(
    DENALI_DEFAULT_WALLET.tenantId,
    () =>
      repo.operatorCredit({
        ...scope,
        accountId: account.value.id,
        amountMinor: "50000",
        currency: DENALI_DEFAULT_WALLET.currency,
        creationIdempotencyKey: "denali-default-wallet-seed-credit-initial",
        reference: "default-seed-initial",
        actor: actor(operatorId),
      }),
    { actorId: operatorId },
  );

  await runWithTenantContext(
    DENALI_DEFAULT_WALLET.tenantId,
    () =>
      repo.operatorDebit({
        ...scope,
        accountId: account.value.id,
        amountMinor: "10000",
        currency: DENALI_DEFAULT_WALLET.currency,
        creationIdempotencyKey: "denali-default-wallet-seed-debit-initial",
        reference: "default-seed-debit",
        actor: actor(operatorId),
      }),
    { actorId: operatorId },
  );

  const balance = await runWithTenantContext(
    DENALI_DEFAULT_WALLET.tenantId,
    () => repo.getMemberBalance(scope, account.value.id),
    { actorId: entitledMemberId },
  );
  if (!balance.ok) {
    throw new Error(`DENALI_DEFAULT_WALLET_SEED_BALANCE_FAILED:${balance.error.code}`);
  }

  logger.info(
    {
      event: "db.seed.denali_default_wallet.wallet",
      accountId: account.value.id,
      balanceMinor: balance.value.balanceMinor,
      currency: balance.value.currency,
    },
    "denali default club wallet seeded",
  );
}

export async function seedDenaliDefaultWallet(): Promise<void> {
  const service = new ProvisioningService();
  await service.seedDenaliSmokeTenant();
  await seedDenaliOperatorIdentity();

  await upsertUser(
    DENALI_DEFAULT_WALLET.entitledMemberUserId,
    DENALI_DEFAULT_WALLET.entitledMemberMobile,
  );
  await upsertUser(
    DENALI_DEFAULT_WALLET.deniedMemberUserId,
    DENALI_DEFAULT_WALLET.deniedMemberMobile,
  );

  await upsertMembership({
    userId: DENALI_DEFAULT_WALLET.ownerUserId,
    role: "owner",
  });
  await upsertMembership({
    userId: DENALI_DEFAULT_WALLET.entitledMemberUserId,
    role: "member",
    portalModuleGrants: ["wallet"],
  });
  await upsertMembership({
    userId: DENALI_DEFAULT_WALLET.deniedMemberUserId,
    role: "member",
  });

  await seedWalletLedgerHistory();
  await seedDenaliDefaultWalletEngagement();

  logger.info(
    {
      event: "db.seed.denali_default_wallet.complete",
      tenantId: DENALI_SMOKE_TENANT_ID,
      subdomain: DENALI_DEFAULT_WALLET.subdomain,
    },
    "denali default wallet seed complete",
  );
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error("DENALI_DEFAULT_WALLET_REQUIRES_DATABASE_URL");
  }
  process.env.STORAGE_DRIVER = "prisma";
  await ensureAppTourCanReadMigrationHead();
  await seedDenaliDefaultWallet();
}

const isDirectSeedExecution =
  process.argv[1]?.endsWith("seed-denali-default-wallet.cjs") === true ||
  (typeof import.meta.url === "string" && process.argv[1] === fileURLToPath(import.meta.url));

if (isDirectSeedExecution) {
  main().catch((error: unknown) => {
    logger.error(
      {
        event: "db.seed.denali_default_wallet.failed",
        err: error instanceof Error ? error.message : String(error),
      },
      "denali default wallet seed failed",
    );
    process.exit(1);
  });
}
