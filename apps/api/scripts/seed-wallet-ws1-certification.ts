/**
 * WALLET-P3C — idempotent Postgres certification seed for wallet-ws1.
 * Certification-only — does not enable Wallet for Denali.
 *
 * @see docs/architecture/wallet-module-phase-0-contract.mdoc §8.3
 */
import { fileURLToPath } from "node:url";

import {
  WALLET_WS1_SMOKE_SUBDOMAIN,
  WALLET_WS1_SMOKE_TENANT_ID,
} from "@app-tour/workspace-wallet-ws1";

import { WALLET_WS1_CERTIFICATION } from "../test/fixtures/wallet-ws1-certification-tenant";
import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { ProvisioningService } from "../src/internal/provisioning.service";
import { logger } from "../src/observability/logger";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";
import { PrismaWalletRepository } from "../src/workspace-wallet/infrastructure/prisma-wallet.repository";
import { seedDenaliOperatorIdentity } from "./seed-denali-operator-identity";

const CERT_THEME = {
  primaryColor: "#6366f1",
  cssVariables: { "--color-primary": "#6366f1" },
  defaultLocale: "en",
  enabledModules: ["wallet"],
  portalModuleGrants: ["wallet"],
} as const;

function memberScope(userId: string) {
  return {
    tenantId: WALLET_WS1_CERTIFICATION.tenantId,
    workspaceId: WALLET_WS1_CERTIFICATION.workspaceId,
    userId,
  };
}

function actor(operatorId: string) {
  return { actorUserId: operatorId, actorRole: "operator" as const };
}

export async function ensureAppTourCanReadMigrationHead(): Promise<void> {
  const prisma = getPrismaAdmin();
  await prisma.$executeRawUnsafe(`GRANT SELECT ON TABLE "_prisma_migrations" TO app_tour`);
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

  await withTenantRls(WALLET_WS1_CERTIFICATION.tenantId, (tx) =>
    tx.userTenant.upsert({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: WALLET_WS1_CERTIFICATION.tenantId,
        },
      },
      create: {
        userId: input.userId,
        tenantId: WALLET_WS1_CERTIFICATION.tenantId,
        role: input.role,
        status: "ACTIVE",
        sessionVersion: 1,
        workspaceId: WALLET_WS1_CERTIFICATION.workspaceId,
        membershipMetadata,
      },
      update: {
        role: input.role,
        status: "ACTIVE",
        workspaceId: WALLET_WS1_CERTIFICATION.workspaceId,
        membershipMetadata,
      },
    })
  );
}

async function seedWalletLedgerHistory(): Promise<void> {
  const repo = new PrismaWalletRepository();
  const operatorId = WALLET_WS1_CERTIFICATION.ownerUserId;
  const entitledMemberId = WALLET_WS1_CERTIFICATION.entitledMemberUserId;
  const scope = memberScope(entitledMemberId);

  const existing = await runWithTenantContext(
    WALLET_WS1_CERTIFICATION.tenantId,
    () => repo.findMemberAccount(scope),
    { actorId: operatorId }
  );
  if (existing.ok && existing.value !== null) {
    const balance = await runWithTenantContext(
      WALLET_WS1_CERTIFICATION.tenantId,
      () => repo.getMemberBalance(scope, existing.value!.id),
      { actorId: entitledMemberId }
    );
    if (balance.ok && balance.value.balanceMinor === WALLET_WS1_CERTIFICATION.seededBalanceMinor) {
      logger.info(
        { event: "db.seed.wallet_ws1_certification.skip_wallet", accountId: existing.value.id },
        "wallet-ws1 certification wallet already seeded"
      );
      return;
    }
  }

  const account = await runWithTenantContext(
    WALLET_WS1_CERTIFICATION.tenantId,
    () =>
      repo.getOrCreateAccount({
        ...scope,
        currency: WALLET_WS1_CERTIFICATION.currency,
        accountId: WALLET_WS1_CERTIFICATION.accountId,
      }),
    { actorId: operatorId }
  );
  if (!account.ok) {
    throw new Error(`WALLET_WS1_SEED_ACCOUNT_FAILED:${account.error.code}`);
  }

  await runWithTenantContext(
    WALLET_WS1_CERTIFICATION.tenantId,
    () =>
      repo.operatorCredit({
        ...scope,
        accountId: account.value.id,
        amountMinor: "5000",
        currency: WALLET_WS1_CERTIFICATION.currency,
        creationIdempotencyKey: "wallet-ws1-cert-seed-credit-initial",
        reference: "certification-seed-initial",
        actor: actor(operatorId),
      }),
    { actorId: operatorId }
  );

  await runWithTenantContext(
    WALLET_WS1_CERTIFICATION.tenantId,
    () =>
      repo.operatorDebit({
        ...scope,
        accountId: account.value.id,
        amountMinor: "1000",
        currency: WALLET_WS1_CERTIFICATION.currency,
        creationIdempotencyKey: "wallet-ws1-cert-seed-debit-initial",
        reference: "certification-seed-debit",
        actor: actor(operatorId),
      }),
    { actorId: operatorId }
  );

  for (let index = 0; index < 22; index += 1) {
    const amountMinor = index % 2 === 0 ? "100" : "50";
    const kind = index % 2 === 0 ? "credit" : "debit";
    const idempotencyKey = `wallet-ws1-cert-seed-paginate-${kind}-${index}`;
    await runWithTenantContext(
      WALLET_WS1_CERTIFICATION.tenantId,
      () =>
        kind === "credit"
          ? repo.operatorCredit({
              ...scope,
              accountId: account.value.id,
              amountMinor,
              currency: WALLET_WS1_CERTIFICATION.currency,
              creationIdempotencyKey: idempotencyKey,
              reference: `certification-pagination-${index}`,
              actor: actor(operatorId),
            })
          : repo.operatorDebit({
              ...scope,
              accountId: account.value.id,
              amountMinor,
              currency: WALLET_WS1_CERTIFICATION.currency,
              creationIdempotencyKey: idempotencyKey,
              reference: `certification-pagination-${index}`,
              actor: actor(operatorId),
            }),
      { actorId: operatorId }
    );
  }

  const balance = await runWithTenantContext(
    WALLET_WS1_CERTIFICATION.tenantId,
    () => repo.getMemberBalance(scope, account.value.id),
    { actorId: entitledMemberId }
  );
  if (!balance.ok) {
    throw new Error(`WALLET_WS1_SEED_BALANCE_FAILED:${balance.error.code}`);
  }

  logger.info(
    {
      event: "db.seed.wallet_ws1_certification.wallet",
      accountId: account.value.id,
      balanceMinor: balance.value.balanceMinor,
    },
    "wallet-ws1 certification wallet seeded"
  );
}

export async function seedWalletWs1Certification(): Promise<void> {
  const service = new ProvisioningService();
  await service.seedWalletWs1CertificationTenant();

  await upsertUser(WALLET_WS1_CERTIFICATION.ownerUserId, WALLET_WS1_CERTIFICATION.ownerMobile);
  await upsertUser(
    WALLET_WS1_CERTIFICATION.entitledMemberUserId,
    WALLET_WS1_CERTIFICATION.entitledMemberMobile
  );
  await upsertUser(
    WALLET_WS1_CERTIFICATION.deniedMemberUserId,
    WALLET_WS1_CERTIFICATION.deniedMemberMobile
  );

  await upsertMembership({
    userId: WALLET_WS1_CERTIFICATION.ownerUserId,
    role: "owner",
  });
  await upsertMembership({
    userId: WALLET_WS1_CERTIFICATION.entitledMemberUserId,
    role: "member",
    portalModuleGrants: ["wallet"],
  });
  await upsertMembership({
    userId: WALLET_WS1_CERTIFICATION.deniedMemberUserId,
    role: "member",
  });

  await seedWalletLedgerHistory();

  const denali = await service.seedDenaliSmokeTenant();
  await seedDenaliOperatorIdentity();
  logger.info(
    {
      event: "db.seed.wallet_ws1_certification.complete",
      tenantId: WALLET_WS1_SMOKE_TENANT_ID,
      subdomain: WALLET_WS1_SMOKE_SUBDOMAIN,
      denaliTenantId: denali.id,
    },
    "wallet-ws1 certification seed complete"
  );
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error("WALLET_WS1_CERTIFICATION_REQUIRES_DATABASE_URL");
  }
  process.env.STORAGE_DRIVER = "prisma";
  await ensureAppTourCanReadMigrationHead();
  await seedWalletWs1Certification();
}

const isDirectWalletWs1SeedExecution =
  process.argv[1]?.endsWith("seed-wallet-ws1-certification.cjs") === true ||
  (typeof import.meta.url === "string" && process.argv[1] === fileURLToPath(import.meta.url));

if (isDirectWalletWs1SeedExecution) {
  main().catch((error: unknown) => {
    logger.error(
      {
        event: "db.seed.wallet_ws1_certification.failed",
        err: error instanceof Error ? error.message : String(error),
      },
      "wallet-ws1 certification seed failed"
    );
    process.exit(1);
  });
}
