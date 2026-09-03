/**
 * Phase 2 — idempotent Postgres seed for Denali Wallet pilot tenant only.
 * Does not enable Wallet for club smoke (denali …000003) or operator smoke (…000014).
 *
 * @see docs/architecture/wallet-module-phase-0-contract.mdoc §10
 */
import { fileURLToPath } from "node:url";

import {
  DENALI_WALLET_PILOT_SUBDOMAIN,
  DENALI_WALLET_PILOT_TENANT_ID,
} from "@app-tour/workspace-denali";

import { DENALI_WALLET_PILOT } from "../test/fixtures/denali-wallet-pilot-tenant";
import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { ProvisioningService } from "../src/internal/provisioning.service";
import { logger } from "../src/observability/logger";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";
import { PrismaWalletRepository } from "../src/workspace-wallet/infrastructure/prisma-wallet.repository";
import { ensureAppTourCanReadMigrationHead } from "./seed-wallet-ws1-certification";

function memberScope(userId: string) {
  return {
    tenantId: DENALI_WALLET_PILOT.tenantId,
    workspaceId: DENALI_WALLET_PILOT.workspaceId,
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

  await withTenantRls(DENALI_WALLET_PILOT.tenantId, (tx) =>
    tx.userTenant.upsert({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: DENALI_WALLET_PILOT.tenantId,
        },
      },
      create: {
        userId: input.userId,
        tenantId: DENALI_WALLET_PILOT.tenantId,
        role: input.role,
        status: "ACTIVE",
        sessionVersion: 1,
        workspaceId: DENALI_WALLET_PILOT.workspaceId,
        membershipMetadata,
      },
      update: {
        role: input.role,
        status: "ACTIVE",
        workspaceId: DENALI_WALLET_PILOT.workspaceId,
        membershipMetadata,
      },
    })
  );
}

async function seedWalletLedgerHistory(): Promise<void> {
  const repo = new PrismaWalletRepository();
  const operatorId = DENALI_WALLET_PILOT.ownerUserId;
  const entitledMemberId = DENALI_WALLET_PILOT.entitledMemberUserId;
  const scope = memberScope(entitledMemberId);

  const existing = await runWithTenantContext(
    DENALI_WALLET_PILOT.tenantId,
    () => repo.findMemberAccount(scope),
    { actorId: operatorId }
  );
  if (existing.ok && existing.value !== null) {
    logger.info(
      { event: "db.seed.denali_wallet_pilot.skip_wallet", accountId: existing.value.id },
      "denali wallet pilot ledger already seeded"
    );
    return;
  }

  const account = await runWithTenantContext(
    DENALI_WALLET_PILOT.tenantId,
    () =>
      repo.getOrCreateAccount({
        ...scope,
        currency: DENALI_WALLET_PILOT.currency,
        accountId: DENALI_WALLET_PILOT.accountId,
      }),
    { actorId: operatorId }
  );
  if (!account.ok) {
    throw new Error(`DENALI_WALLET_PILOT_SEED_ACCOUNT_FAILED:${account.error.code}`);
  }

  await runWithTenantContext(
    DENALI_WALLET_PILOT.tenantId,
    () =>
      repo.operatorCredit({
        ...scope,
        accountId: account.value.id,
        amountMinor: "50000",
        currency: DENALI_WALLET_PILOT.currency,
        creationIdempotencyKey: "denali-wallet-pilot-seed-credit-initial",
        reference: "pilot-seed-initial",
        actor: actor(operatorId),
      }),
    { actorId: operatorId }
  );

  await runWithTenantContext(
    DENALI_WALLET_PILOT.tenantId,
    () =>
      repo.operatorDebit({
        ...scope,
        accountId: account.value.id,
        amountMinor: "10000",
        currency: DENALI_WALLET_PILOT.currency,
        creationIdempotencyKey: "denali-wallet-pilot-seed-debit-initial",
        reference: "pilot-seed-debit",
        actor: actor(operatorId),
      }),
    { actorId: operatorId }
  );

  const balance = await runWithTenantContext(
    DENALI_WALLET_PILOT.tenantId,
    () => repo.getMemberBalance(scope, account.value.id),
    { actorId: entitledMemberId }
  );
  if (!balance.ok) {
    throw new Error(`DENALI_WALLET_PILOT_SEED_BALANCE_FAILED:${balance.error.code}`);
  }

  logger.info(
    {
      event: "db.seed.denali_wallet_pilot.wallet",
      accountId: account.value.id,
      balanceMinor: balance.value.balanceMinor,
      currency: balance.value.currency,
    },
    "denali wallet pilot wallet seeded"
  );
}

export async function seedDenaliWalletPilot(): Promise<void> {
  const service = new ProvisioningService();
  await service.seedDenaliWalletPilotTenant();

  await upsertUser(DENALI_WALLET_PILOT.ownerUserId, DENALI_WALLET_PILOT.ownerMobile);
  await upsertUser(
    DENALI_WALLET_PILOT.entitledMemberUserId,
    DENALI_WALLET_PILOT.entitledMemberMobile
  );
  await upsertUser(DENALI_WALLET_PILOT.deniedMemberUserId, DENALI_WALLET_PILOT.deniedMemberMobile);

  await upsertMembership({
    userId: DENALI_WALLET_PILOT.ownerUserId,
    role: "owner",
  });
  await upsertMembership({
    userId: DENALI_WALLET_PILOT.entitledMemberUserId,
    role: "member",
    portalModuleGrants: ["wallet"],
  });
  await upsertMembership({
    userId: DENALI_WALLET_PILOT.deniedMemberUserId,
    role: "member",
  });

  await seedWalletLedgerHistory();

  logger.info(
    {
      event: "db.seed.denali_wallet_pilot.complete",
      tenantId: DENALI_WALLET_PILOT_TENANT_ID,
      subdomain: DENALI_WALLET_PILOT_SUBDOMAIN,
    },
    "denali wallet pilot seed complete"
  );
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error("DENALI_WALLET_PILOT_REQUIRES_DATABASE_URL");
  }
  process.env.STORAGE_DRIVER = "prisma";
  await ensureAppTourCanReadMigrationHead();
  await seedDenaliWalletPilot();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    logger.error(
      {
        event: "db.seed.denali_wallet_pilot.failed",
        err: error instanceof Error ? error.message : String(error),
      },
      "denali wallet pilot seed failed"
    );
    process.exit(1);
  });
}
