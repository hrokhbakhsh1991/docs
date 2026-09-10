/**
 * WALLET-P3C — Postgres certification flows (HTTP-level isolation + idempotency).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { WALLET_WS1_CERTIFICATION } from "../../test/fixtures/wallet-ws1-certification-tenant";
import { disconnectPrisma } from "../db/prisma";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import {
  seedWalletWs1Certification,
  ensureAppTourCanReadMigrationHead,
} from "../../scripts/seed-wallet-ws1-certification";
import { PrismaWalletRepository } from "./infrastructure/prisma-wallet.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip = !hasDatabase ? "WALLET_WS1_CERTIFICATION_REQUIRES_DATABASE" : false;

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

describe(
  "wallet-ws1-certification.postgres.spec.ts — WALLET-P3C",
  { skip: postgresSkip, concurrency: false },
  () => {
    const repo = new PrismaWalletRepository();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await ensureAppTourCanReadMigrationHead();
      await seedWalletWs1Certification();
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      await disconnectPrisma();
    });

    it("CERT-PG-01 entitled member reads own balance", async () => {
      const balance = await runWithTenantContext(
        WALLET_WS1_CERTIFICATION.tenantId,
        () =>
          repo.getMemberBalance(
            memberScope(WALLET_WS1_CERTIFICATION.entitledMemberUserId),
            WALLET_WS1_CERTIFICATION.accountId
          ),
        { actorId: WALLET_WS1_CERTIFICATION.entitledMemberUserId }
      );
      assert.equal(balance.ok, true);
      if (!balance.ok) return;
      assert.match(balance.value.balanceMinor, /^\d+$/);
    });

    it("CERT-PG-02 member cannot read another member account by id", async () => {
      const balance = await runWithTenantContext(
        WALLET_WS1_CERTIFICATION.tenantId,
        () =>
          repo.getMemberBalance(
            memberScope(WALLET_WS1_CERTIFICATION.deniedMemberUserId),
            WALLET_WS1_CERTIFICATION.accountId
          ),
        { actorId: WALLET_WS1_CERTIFICATION.deniedMemberUserId }
      );
      assert.equal(balance.ok, false);
      if (balance.ok) return;
      assert.equal(balance.error.code, "WALLET_OWNERSHIP_MISMATCH");
    });

    it("CERT-PG-03 operator credit idempotency replays same transaction", async () => {
      const scope = memberScope(WALLET_WS1_CERTIFICATION.entitledMemberUserId);
      const key = `wallet-cert-pg-idem-${Date.now()}`;
      const first = await runWithTenantContext(
        WALLET_WS1_CERTIFICATION.tenantId,
        () =>
          repo.operatorCredit({
            ...scope,
            accountId: WALLET_WS1_CERTIFICATION.accountId,
            amountMinor: "50",
            currency: WALLET_WS1_CERTIFICATION.currency,
            creationIdempotencyKey: key,
            reference: "cert-pg-idem",
            actor: actor(WALLET_WS1_CERTIFICATION.ownerUserId),
          }),
        { actorId: WALLET_WS1_CERTIFICATION.ownerUserId }
      );
      const second = await runWithTenantContext(
        WALLET_WS1_CERTIFICATION.tenantId,
        () =>
          repo.operatorCredit({
            ...scope,
            accountId: WALLET_WS1_CERTIFICATION.accountId,
            amountMinor: "50",
            currency: WALLET_WS1_CERTIFICATION.currency,
            creationIdempotencyKey: key,
            reference: "cert-pg-idem",
            actor: actor(WALLET_WS1_CERTIFICATION.ownerUserId),
          }),
        { actorId: WALLET_WS1_CERTIFICATION.ownerUserId }
      );
      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      if (!first.ok || !second.ok) return;
      assert.equal(first.value.transaction.id, second.value.transaction.id);
    });

    it("CERT-PG-04 operator debit rejects insufficient funds", async () => {
      const scope = memberScope(WALLET_WS1_CERTIFICATION.entitledMemberUserId);
      const debit = await runWithTenantContext(
        WALLET_WS1_CERTIFICATION.tenantId,
        () =>
          repo.operatorDebit({
            ...scope,
            accountId: WALLET_WS1_CERTIFICATION.accountId,
            amountMinor: "999999999",
            currency: WALLET_WS1_CERTIFICATION.currency,
            creationIdempotencyKey: `wallet-cert-pg-insufficient-${Date.now()}`,
            reference: "cert-pg-insufficient",
            actor: actor(WALLET_WS1_CERTIFICATION.ownerUserId),
          }),
        { actorId: WALLET_WS1_CERTIFICATION.ownerUserId }
      );
      assert.equal(debit.ok, false);
      if (debit.ok) return;
      assert.equal(debit.error.code, "WALLET_INSUFFICIENT_FUNDS");
    });
  }
);
