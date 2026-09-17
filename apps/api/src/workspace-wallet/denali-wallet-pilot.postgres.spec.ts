/**
 * Phase 2 — Denali Wallet pilot Postgres flows (IRR currency + isolation).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { DENALI_WALLET_PILOT } from "../../test/fixtures/denali-wallet-pilot-tenant";
import { disconnectPrisma } from "../db/prisma";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { seedDenaliDefaultWallet } from "../../scripts/seed-denali-default-wallet";
import { seedDenaliWalletPilot } from "../../scripts/seed-denali-wallet-pilot";
import { ensureAppTourCanReadMigrationHead } from "../../scripts/seed-wallet-ws1-certification";
import { assertWalletWorkspaceGate } from "./assert-wallet-access";
import { PrismaWalletRepository } from "./infrastructure/prisma-wallet.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip = !hasDatabase ? "DENALI_WALLET_PILOT_REQUIRES_DATABASE" : false;

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

describe(
  "denali-wallet-pilot.postgres.spec.ts — Phase 2",
  { skip: postgresSkip, concurrency: false },
  () => {
    const repo = new PrismaWalletRepository();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await ensureAppTourCanReadMigrationHead();
      await seedDenaliDefaultWallet();
      await seedDenaliWalletPilot();
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      await disconnectPrisma();
    });

    it("PILOT-PG-01 pilot tenant passes wallet workspace gate", async () => {
      const gate = await assertWalletWorkspaceGate(DENALI_WALLET_PILOT.tenantId);
      assert.equal(gate.workspaceType, "denali");
    });

    it("PILOT-PG-02 club smoke tenant passes wallet gate when theme enables module", async () => {
      const gate = await assertWalletWorkspaceGate(DENALI_SMOKE_TENANT_ID);
      assert.equal(gate.workspaceType, "denali");
    });

    it("PILOT-PG-03 entitled member reads IRR balance", async () => {
      const balance = await runWithTenantContext(
        DENALI_WALLET_PILOT.tenantId,
        () =>
          repo.getMemberBalance(
            memberScope(DENALI_WALLET_PILOT.entitledMemberUserId),
            DENALI_WALLET_PILOT.accountId
          ),
        { actorId: DENALI_WALLET_PILOT.entitledMemberUserId }
      );
      assert.equal(balance.ok, true);
      if (!balance.ok) return;
      assert.equal(balance.value.currency, "IRR");
      assert.match(balance.value.balanceMinor, /^\d+$/);
      assert.notEqual(balance.value.balanceMinor, "0");
    });

    it("PILOT-PG-04 non-entitled member cannot read another account", async () => {
      const balance = await runWithTenantContext(
        DENALI_WALLET_PILOT.tenantId,
        () =>
          repo.getMemberBalance(
            memberScope(DENALI_WALLET_PILOT.deniedMemberUserId),
            DENALI_WALLET_PILOT.accountId
          ),
        { actorId: DENALI_WALLET_PILOT.deniedMemberUserId }
      );
      assert.equal(balance.ok, false);
      if (balance.ok) return;
      assert.equal(balance.error.code, "WALLET_OWNERSHIP_MISMATCH");
    });

    it("PILOT-PG-05 operator credit idempotency replays same transaction", async () => {
      const scope = memberScope(DENALI_WALLET_PILOT.entitledMemberUserId);
      const key = `denali-pilot-pg-idem-${Date.now()}`;
      const first = await runWithTenantContext(
        DENALI_WALLET_PILOT.tenantId,
        () =>
          repo.operatorCredit({
            ...scope,
            accountId: DENALI_WALLET_PILOT.accountId,
            amountMinor: "1000",
            currency: DENALI_WALLET_PILOT.currency,
            creationIdempotencyKey: key,
            reference: "refundId: pilot-refund-sample",
            actor: actor(DENALI_WALLET_PILOT.ownerUserId),
          }),
        { actorId: DENALI_WALLET_PILOT.ownerUserId }
      );
      const second = await runWithTenantContext(
        DENALI_WALLET_PILOT.tenantId,
        () =>
          repo.operatorCredit({
            ...scope,
            accountId: DENALI_WALLET_PILOT.accountId,
            amountMinor: "1000",
            currency: DENALI_WALLET_PILOT.currency,
            creationIdempotencyKey: key,
            reference: "refundId: pilot-refund-sample",
            actor: actor(DENALI_WALLET_PILOT.ownerUserId),
          }),
        { actorId: DENALI_WALLET_PILOT.ownerUserId }
      );
      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      if (!first.ok || !second.ok) return;
      assert.equal(first.value.transaction.id, second.value.transaction.id);
    });

    it("PILOT-PG-06 operator debit rejects insufficient funds", async () => {
      const scope = memberScope(DENALI_WALLET_PILOT.entitledMemberUserId);
      const debit = await runWithTenantContext(
        DENALI_WALLET_PILOT.tenantId,
        () =>
          repo.operatorDebit({
            ...scope,
            accountId: DENALI_WALLET_PILOT.accountId,
            amountMinor: "999999999",
            currency: DENALI_WALLET_PILOT.currency,
            creationIdempotencyKey: `denali-pilot-pg-insufficient-${Date.now()}`,
            reference: "pilot-insufficient",
            actor: actor(DENALI_WALLET_PILOT.ownerUserId),
          }),
        { actorId: DENALI_WALLET_PILOT.ownerUserId }
      );
      assert.equal(debit.ok, false);
      if (debit.ok) return;
      assert.equal(debit.error.code, "WALLET_INSUFFICIENT_FUNDS");
    });
  }
);
