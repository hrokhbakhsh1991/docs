import assert from "node:assert/strict";
import test from "node:test";
import { FinanceReportsService } from "../../src/modules/finance/reports/finance-reports.service";

const configTest = { getNodeEnv: () => "test" } as never;

test("getSummary aggregates payment and receipt counts", async () => {
  let countCalls = 0;
  const service = new FinanceReportsService(
    {
      runInTenantScope: async (_tenantId, fn) =>
        fn({
          count: async () => {
            countCalls += 1;
            if (countCalls === 1) return 2;
            if (countCalls === 2) return 3;
            if (countCalls === 3) return 10;
            return 1;
          }
        } as never)
    } as never,
    configTest,
    null
  );

  const summary = await service.getSummary("tenant-1");
  assert.equal(summary.pendingManualPayments, 2);
  assert.equal(summary.pendingReceiptReviews, 3);
  assert.equal(summary.paidPayments, 10);
  assert.equal(summary.failedPayments, 1);
  assert.equal(countCalls, 4);
});

test("listLedgerEvents maps finance.ledger outbox rows", async () => {
  const service = new FinanceReportsService(
    {
      runInTenantScope: async (_tenantId, fn) =>
        fn({
          find: async () => [
            {
              id: "outbox-1",
              eventType: "finance.ledger.double_entry_applied",
              aggregateId: "journal-1",
              domainEventId: "finance.ledger:reg-1:key-1",
              createdAt: new Date("2030-01-01T00:00:00.000Z"),
              payload: {
                registrationId: "reg-1",
                journalId: "journal-1",
                lines: [
                  {
                    id: "line-1",
                    journalId: "journal-1",
                    tenantId: "tenant-1",
                    account: "booking:reg-1",
                    side: "debit",
                    amount_minor: "1000",
                    currency: "IRR",
                    correlationId: "corr-1",
                    idempotencyKey: "idem-1",
                    createdAt: "2030-01-01T00:00:00.000Z"
                  },
                  {
                    id: "line-2",
                    journalId: "journal-1",
                    tenantId: "tenant-1",
                    account: "gl:clearing",
                    side: "credit",
                    amount_minor: "1000",
                    currency: "IRR",
                    correlationId: "corr-1",
                    idempotencyKey: "idem-2",
                    createdAt: "2030-01-01T00:00:00.000Z"
                  }
                ]
              }
            }
          ]
        } as never)
    } as never,
    configTest,
    null
  );

  const events = await service.listLedgerEvents("tenant-1");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.journalId, "journal-1");
  assert.equal(events[0]?.registrationId, "reg-1");
  assert.equal(events[0]?.lineCount, 2);
});
