/**
 * WALLET-P2C — Prisma wallet persistence + RLS integration (Postgres required).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { integrationTenantId } from "../../test/test-helpers";
import { PrismaWalletRepository } from "./infrastructure/prisma-wallet.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const hasPrismaDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase() === "prisma";

const postgresSkip = !hasDatabase
  ? "WALLET_PERSISTENCE_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN"
  : !hasPrismaDriver
    ? "WALLET_PERSISTENCE_REQUIRES_STORAGE_DRIVER=prisma"
    : false;

function actor(operatorId: string) {
  return { actorUserId: operatorId, actorRole: "operator" as const };
}

function memberScope(tenantId: string, workspaceId: string, userId: string) {
  return { tenantId, workspaceId, userId };
}

describe(
  "wallet-persistence.postgres.spec.ts — WALLET-P2C",
  { skip: postgresSkip, concurrency: false },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const workspaceA = "wallet-ws1";
    const workspaceB = "wallet-ws1-b";
    const operatorId = randomUUID();
    const repo = new PrismaWalletRepository();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantA,
            subdomain: `wallet-a-${tenantA.slice(0, 8)}`,
            workspaceType: "wallet-ws1",
            theme: {},
          },
          {
            id: tenantB,
            subdomain: `wallet-b-${tenantB.slice(0, 8)}`,
            workspaceType: "wallet-ws1",
            theme: {},
          },
        ],
      });

      const posture = await admin.$queryRaw<
        Array<{ relname: string; rls: boolean; force_rls: boolean }>
      >`
        SELECT c.relname::text AS relname,
               c.relrowsecurity AS rls,
               c.relforcerowsecurity AS force_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('wallet_accounts', 'wallet_transactions', 'wallet_ledger_entries')
        ORDER BY 1
      `;
      assert.equal(posture.length, 3);
      for (const row of posture) {
        assert.equal(row.rls, true, `${row.relname} must ENABLE RLS`);
        assert.equal(row.force_rls, true, `${row.relname} must FORCE RLS`);
      }
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      try {
        // Append-only trigger blocks DELETE; TRUNCATE is test-teardown only (postgres admin).
        await admin.$executeRawUnsafe(
          "TRUNCATE wallet_ledger_entries, wallet_transactions, wallet_accounts",
        );
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only",
        );
        try {
          await admin.auditEvent.deleteMany({
            where: { tenantId: { in: [tenantA, tenantB] } },
          });
        } finally {
          await admin.$executeRawUnsafe(
            "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only",
          );
        }
        await admin.outboxEvent.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      } finally {
        await disconnectPrisma();
      }
    });

    it("creates account and credits balance", async () => {
      const userId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const credit = await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorCredit({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            amountMinor: "2500",
            currency: "USD",
            creationIdempotencyKey: `credit-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );
      assert.equal(credit.ok, true);
      if (!credit.ok) return;

      const balance = await runWithTenantContext(
        tenantA,
        () =>
          repo.getMemberBalance(memberScope(tenantA, workspaceA, userId), account.value.id),
        { actorId: userId },
      );
      assert.equal(balance.ok, true);
      if (!balance.ok) return;
      assert.equal(balance.value.balanceMinor, "2500");
    });

    it("debits with sufficient funds and rejects insufficient funds", async () => {
      const userId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "EUR",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorCredit({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            amountMinor: "1000",
            currency: "EUR",
            creationIdempotencyKey: `credit-eur-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );

      const debit = await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorDebit({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            amountMinor: "400",
            currency: "EUR",
            creationIdempotencyKey: `debit-eur-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );
      assert.equal(debit.ok, true);

      const overdraft = await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorDebit({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            amountMinor: "900",
            currency: "EUR",
            creationIdempotencyKey: `debit-fail-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );
      assert.equal(overdraft.ok, false);
      if (overdraft.ok) return;
      assert.equal(overdraft.error.code, "WALLET_INSUFFICIENT_FUNDS");
    });

    it("serializes concurrent debits — cannot overspend", async () => {
      const userId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "GBP",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorCredit({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            amountMinor: "1000",
            currency: "GBP",
            creationIdempotencyKey: `credit-gbp-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );

      const [first, second] = await Promise.all([
        runWithTenantContext(
          tenantA,
          () =>
            repo.operatorDebit({
              ...memberScope(tenantA, workspaceA, userId),
              accountId: account.value.id,
              amountMinor: "700",
              currency: "GBP",
              creationIdempotencyKey: `race-1-${randomUUID()}`,
              reference: null,
              actor: actor(operatorId),
            }),
          { actorId: operatorId },
        ),
        runWithTenantContext(
          tenantA,
          () =>
            repo.operatorDebit({
              ...memberScope(tenantA, workspaceA, userId),
              accountId: account.value.id,
              amountMinor: "700",
              currency: "GBP",
              creationIdempotencyKey: `race-2-${randomUUID()}`,
              reference: null,
              actor: actor(operatorId),
            }),
          { actorId: operatorId },
        ),
      ]);

      const successes = [first, second].filter((result) => result.ok);
      const failures = [first, second].filter((result) => !result.ok);
      assert.equal(successes.length, 1);
      assert.equal(failures.length, 1);
      assert.equal(failures[0]?.error.code, "WALLET_INSUFFICIENT_FUNDS");

      const balance = await runWithTenantContext(
        tenantA,
        () =>
          repo.getMemberBalance(memberScope(tenantA, workspaceA, userId), account.value.id),
        { actorId: userId },
      );
      assert.equal(balance.ok, true);
      if (!balance.ok) return;
      assert.equal(balance.value.balanceMinor, "300");
    });

    it("reverses posted credit and restores prior balance", async () => {
      const userId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const before = await runWithTenantContext(
        tenantA,
        () =>
          repo.getMemberBalance(memberScope(tenantA, workspaceA, userId), account.value.id),
        { actorId: userId },
      );
      assert.equal(before.ok, true);
      if (!before.ok) return;

      const credit = await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorCredit({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            amountMinor: "500",
            currency: "USD",
            creationIdempotencyKey: `rev-credit-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );
      assert.equal(credit.ok, true);
      if (!credit.ok) return;

      const reversal = await runWithTenantContext(
        tenantA,
        () =>
          repo.reverseTransaction({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            originalTransactionId: credit.value.transaction.id,
            creationIdempotencyKey: `rev-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );
      assert.equal(reversal.ok, true);
      if (!reversal.ok) return;

      const after = await runWithTenantContext(
        tenantA,
        () =>
          repo.getMemberBalance(memberScope(tenantA, workspaceA, userId), account.value.id),
        { actorId: userId },
      );
      assert.equal(after.ok, true);
      if (!after.ok) return;
      assert.equal(after.value.balanceMinor, before.value.balanceMinor);
    });

    it("replays duplicate idempotency key and rejects fingerprint conflict", async () => {
      const userId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const idem = `idem-${randomUUID()}`;
      const input = {
        ...memberScope(tenantA, workspaceA, userId),
        accountId: account.value.id,
        amountMinor: "100",
        currency: "USD",
        creationIdempotencyKey: idem,
        reference: null,
        actor: actor(operatorId),
      };

      const first = await runWithTenantContext(
        tenantA,
        () => repo.operatorCredit(input),
        { actorId: operatorId },
      );
      const replay = await runWithTenantContext(
        tenantA,
        () => repo.operatorCredit(input),
        { actorId: operatorId },
      );
      assert.equal(first.ok, true);
      assert.equal(replay.ok, true);
      if (!first.ok || !replay.ok) return;
      assert.equal(replay.value.transaction.id, first.value.transaction.id);

      const conflict = await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorCredit({
            ...input,
            amountMinor: "200",
          }),
        { actorId: operatorId },
      );
      assert.equal(conflict.ok, false);
      if (conflict.ok) return;
      assert.equal(conflict.error.code, "WALLET_IDEMPOTENCY_CONFLICT");
    });

    it("rejects currency mismatch on credit", async () => {
      const userId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const mismatch = await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorCredit({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            amountMinor: "100",
            currency: "EUR",
            creationIdempotencyKey: `mismatch-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );
      assert.equal(mismatch.ok, false);
      if (mismatch.ok) return;
      assert.equal(mismatch.error.code, "WALLET_CURRENCY_MISMATCH");
    });

    it("enforces member ownership on balance reads", async () => {
      const ownerId = randomUUID();
      const otherId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, ownerId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const denied = await runWithTenantContext(
        tenantA,
        () =>
          repo.getMemberBalance(memberScope(tenantA, workspaceA, otherId), account.value.id),
        { actorId: otherId },
      );
      assert.equal(denied.ok, false);
      if (denied.ok) return;
      assert.equal(denied.error.code, "WALLET_OWNERSHIP_MISMATCH");
    });

    it("isolates workspace within one tenant", async () => {
      const userId = randomUUID();
      const accountA = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      const accountB = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceB, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(accountA.ok, true);
      assert.equal(accountB.ok, true);
      if (!accountA.ok || !accountB.ok) return;
      assert.notEqual(accountA.value.id, accountB.value.id);
    });

    it("denies cross-tenant read and insert under RLS", async () => {
      const userId = randomUUID();
      const accountA = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(accountA.ok, true);
      if (!accountA.ok) return;

      const foreignRead = await runWithTenantContext(
        tenantB,
        () => repo.findAccountById(tenantB, accountA.value.id),
        { actorId: operatorId },
      );
      assert.equal(foreignRead, null);

      let rejected = false;
      try {
        await runWithTenantContext(
          tenantB,
          () =>
            withTenantRls(tenantB, async (tx) => {
              await tx.walletAccount.create({
                data: {
                  id: randomUUID(),
                  tenantId: tenantA,
                  workspaceId: workspaceA,
                  userId,
                  currency: "USD",
                  status: "active",
                },
              });
            }),
          { actorId: operatorId },
        );
      } catch {
        rejected = true;
      }
      assert.equal(rejected, true, "WITH CHECK must reject cross-tenant INSERT");
    });

    it("failed transaction rows do not affect derived balance", async () => {
      const userId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const admin = getPrismaAdmin();
      await admin.walletTransaction.create({
        data: {
          id: randomUUID(),
          tenantId: tenantA,
          workspaceId: workspaceA,
          accountId: account.value.id,
          kind: "operator_credit",
          status: "failed",
          amountMinor: "9999",
          currency: "USD",
          creationIdempotencyKey: `failed-${randomUUID()}`,
          commandFingerprint: "failed-fp",
          actorUserId: operatorId,
          actorRole: "operator",
          postedAt: null,
        },
      });

      const balance = await runWithTenantContext(
        tenantA,
        () =>
          repo.getMemberBalance(memberScope(tenantA, workspaceA, userId), account.value.id),
        { actorId: userId },
      );
      assert.equal(balance.ok, true);
      if (!balance.ok) return;
      assert.equal(balance.value.balanceMinor, "0");
    });

    it("rejects direct ledger UPDATE and DELETE (append-only trigger)", async () => {
      const userId = randomUUID();
      const account = await runWithTenantContext(
        tenantA,
        () =>
          repo.getOrCreateAccount({
            ...memberScope(tenantA, workspaceA, userId),
            currency: "USD",
          }),
        { actorId: operatorId },
      );
      assert.equal(account.ok, true);
      if (!account.ok) return;

      const credit = await runWithTenantContext(
        tenantA,
        () =>
          repo.operatorCredit({
            ...memberScope(tenantA, workspaceA, userId),
            accountId: account.value.id,
            amountMinor: "50",
            currency: "USD",
            creationIdempotencyKey: `append-${randomUUID()}`,
            reference: null,
            actor: actor(operatorId),
          }),
        { actorId: operatorId },
      );
      assert.equal(credit.ok, true);
      if (!credit.ok) return;
      const entryId = credit.value.ledgerEntries[0]?.id;
      assert.ok(entryId);

      let updateRejected = false;
      try {
        await runWithTenantContext(
          tenantA,
          () =>
            withTenantRls(tenantA, async (tx) => {
              await tx.$executeRawUnsafe(
                `UPDATE wallet_ledger_entries SET amount_minor = '1' WHERE id = '${entryId}'::uuid`,
              );
            }),
          { actorId: operatorId },
        );
      } catch {
        updateRejected = true;
      }
      assert.equal(updateRejected, true);

      let deleteRejected = false;
      try {
        await runWithTenantContext(
          tenantA,
          () =>
            withTenantRls(tenantA, async (tx) => {
              await tx.$executeRawUnsafe(
                `DELETE FROM wallet_ledger_entries WHERE id = '${entryId}'::uuid`,
              );
            }),
          { actorId: operatorId },
        );
      } catch {
        deleteRejected = true;
      }
      assert.equal(deleteRejected, true);
    });
  },
);
