import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { LEDGER_ACCOUNTS } from "../ledger/ledger-accounts";
import { postDoubleEntryJournal } from "../ledger/post-double-entry-journal";
import { TypeOrmInvoiceReadModelRepository } from "../repositories/typeorm-invoice-read-model.repository";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bookingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const bookingWalletId = `booking:${bookingId}`;

function buildRepository(input: {
  snapshot: {
    snapshotId: string;
    computedTotalMinor: string;
    currency: string;
    pricingRuleVersion: string;
    listPriceMinor: string;
    createdAt: Date;
  } | null;
  ledgerLineRows: Array<Record<string, unknown>>;
}) {
  const snapshots = {
    createQueryBuilder() {
      const state = { tenantId, bookingId };
      return {
        where(_: string, params: { tenantId: string; bookingId: string }) {
          Object.assign(state, params);
          return this;
        },
        andWhere(_: string, params: { bookingId: string }) {
          Object.assign(state, params);
          return this;
        },
        orderBy() {
          return this;
        },
        addOrderBy() {
          return this;
        },
        async getOne() {
          if (!input.snapshot) {
            return null;
          }
          return {
            snapshotId: input.snapshot.snapshotId,
            tenantId: state.tenantId,
            bookingId: state.bookingId,
            computedTotalMinor: input.snapshot.computedTotalMinor,
            currency: input.snapshot.currency,
            pricingRuleVersion: input.snapshot.pricingRuleVersion,
            listPriceMinor: input.snapshot.listPriceMinor,
            createdAt: input.snapshot.createdAt,
          };
        },
      };
    },
  };

  const ledgerLines = {
    async find(opts: { where: { tenantId: string; account: string } }) {
      if (
        opts.where.tenantId !== tenantId ||
        opts.where.account !== bookingWalletId
      ) {
        return [];
      }
      return input.ledgerLineRows;
    },
  };

  return new TypeOrmInvoiceReadModelRepository(snapshots as never, ledgerLines as never);
}

test("getDerivedInvoice compiles snapshot + ledger lines at runtime", async () => {
  const { lines } = postDoubleEntryJournal({
    tenantId,
    debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
    creditAccount: bookingWalletId,
    amount_minor: "2500",
    currency: "USD",
    correlationId: "registration:test:leader_payment",
    idempotencyKey: "repo-test:receive",
  });

  const repo = buildRepository({
    snapshot: {
      snapshotId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      computedTotalMinor: "9999",
      currency: "USD",
      pricingRuleVersion: "pv:1",
      listPriceMinor: "10000",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
    },
    ledgerLineRows: lines.map((line) => ({
      id: line.id,
      tenantId: line.tenantId,
      journalId: line.journalId,
      account: line.account,
      side: line.side,
      amountMinor: line.amount_minor,
      currency: line.currency,
      correlationId: line.correlationId,
      idempotencyKey: line.idempotencyKey,
      createdAt: new Date(line.createdAt),
      reversesLineId: line.reversesLineId ?? null,
      metadata: line.metadata ?? null,
    })),
  });

  const view = await repo.getDerivedInvoice(bookingWalletId, tenantId);
  assert.equal(view.bookingId, bookingId);
  assert.equal(view.invoiceTotalMinor, "9999");
  assert.equal(view.paidAmountMinor, "2500");
  assert.equal(view.balanceDueMinor, "7499");
  assert.equal(view.invoice.derivedArtifact, true);
  assert.equal(view.invoice.ledgerLines.length, 1);
});

test("getDerivedInvoice rejects missing snapshot in tenant scope", async () => {
  const repo = buildRepository({ snapshot: null, ledgerLineRows: [] });
  await assert.rejects(
    () => repo.getDerivedInvoice(bookingWalletId, tenantId),
    (error: unknown) => error instanceof NotFoundException
  );
});
