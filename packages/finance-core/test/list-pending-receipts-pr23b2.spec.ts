/**
 * PR23-B2 — pending receipt queue scope-before-limit + cursor (domain/in-memory).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  encodePendingReceiptCursor,
  paginatePendingReceiptRows,
} from "../src/domain/pending-receipt-queue.ts";
import type { FinanceReceiptRow } from "../src/ports/finance-repository.port.ts";
import { InMemoryFinanceRepository } from "./isolation/in-memory-finance.repository.ts";
import { createFakeBookingPort } from "./isolation/fakes.ts";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REG_TARGET = "11111111-1111-4111-8111-111111111111";
const REG_OTHER = "22222222-2222-4222-8222-222222222222";
const TOUR_A = "33333333-3333-4333-8333-333333333333";

function receipt(input: {
  id: string;
  tenantId: string;
  registrationId: string;
  createdAt: string;
}): FinanceReceiptRow & { tenantId: string } {
  return {
    id: input.id,
    tenantId: input.tenantId,
    paymentId: `pay-${input.id}`,
    fileKey: `receipts/${input.id}.jpg`,
    status: "Pending",
    note: null,
    reviewNote: null,
    reviewedAt: null,
    ledgerJournalId: null,
    createdAt: new Date(input.createdAt),
    payment: {
      id: `pay-${input.id}`,
      registrationId: input.registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      status: "Pending",
      provider: "manual",
      paidAt: null,
      createdAt: new Date(input.createdAt),
    },
  };
}

describe("list-pending-receipts PR23-B2", () => {
  it("B2-A — registration scoped receipt beyond first global page is returned", () => {
    const rows = [];
    for (let i = 0; i < 5; i += 1) {
      rows.push(
        receipt({
          id: `00000000-0000-4000-8000-00000000000${i}`,
          tenantId: TENANT_A,
          registrationId: REG_OTHER,
          createdAt: `2026-01-0${i + 1}T10:00:00.000Z`,
        })
      );
    }
    const target = receipt({
      id: "00000000-0000-4000-8000-000000000099",
      tenantId: TENANT_A,
      registrationId: REG_TARGET,
      createdAt: "2026-01-10T10:00:00.000Z",
    });
    rows.push(target);

    const global = paginatePendingReceiptRows({
      rows,
      tenantId: TENANT_A,
      limit: 5,
    });
    assert.equal(global.rows.length, 5);
    assert.equal(
      global.rows.some((row) => row.payment?.registrationId === REG_TARGET),
      false
    );

    const scoped = paginatePendingReceiptRows({
      rows,
      tenantId: TENANT_A,
      limit: 5,
      registrationId: REG_TARGET,
    });
    assert.equal(scoped.rows.length, 1);
    assert.equal(scoped.rows[0]?.id, target.id);
  });

  it("B2-B — tour scoped via registrationIds before limit", () => {
    const rows = [
      receipt({
        id: "00000000-0000-4000-8000-000000000001",
        tenantId: TENANT_A,
        registrationId: REG_OTHER,
        createdAt: "2026-01-01T10:00:00.000Z",
      }),
      receipt({
        id: "00000000-0000-4000-8000-000000000002",
        tenantId: TENANT_A,
        registrationId: REG_TARGET,
        createdAt: "2026-01-02T10:00:00.000Z",
      }),
    ];
    const page = paginatePendingReceiptRows({
      rows,
      tenantId: TENANT_A,
      limit: 1,
      registrationIds: [REG_TARGET],
    });
    assert.equal(page.rows.length, 1);
    assert.equal(page.rows[0]?.payment?.registrationId, REG_TARGET);
    void TOUR_A;
  });

  it("B2-C — tenant isolation preserved", () => {
    const rows = [
      receipt({
        id: "00000000-0000-4000-8000-000000000001",
        tenantId: TENANT_A,
        registrationId: REG_TARGET,
        createdAt: "2026-01-01T10:00:00.000Z",
      }),
      receipt({
        id: "00000000-0000-4000-8000-000000000002",
        tenantId: TENANT_B,
        registrationId: REG_TARGET,
        createdAt: "2026-01-01T09:00:00.000Z",
      }),
    ];
    const page = paginatePendingReceiptRows({
      rows,
      tenantId: TENANT_A,
      limit: 10,
    });
    assert.equal(page.rows.length, 1);
    assert.equal(page.rows[0]?.tenantId, TENANT_A);
  });

  it("B2-D/E/F — stable pages, no duplicates, oldest first", () => {
    const rows = [0, 1, 2, 3, 4].map((i) =>
      receipt({
        id: `00000000-0000-4000-8000-00000000000${i}`,
        tenantId: TENANT_A,
        registrationId: REG_TARGET,
        createdAt: `2026-02-0${i + 1}T12:00:00.000Z`,
      })
    );
    const first = paginatePendingReceiptRows({ rows, tenantId: TENANT_A, limit: 2 });
    assert.equal(first.hasMore, true);
    assert.ok(first.nextCursor !== null);
    assert.deepEqual(
      first.rows.map((row) => row.id),
      [rows[0]!.id, rows[1]!.id]
    );

    const second = paginatePendingReceiptRows({
      rows,
      tenantId: TENANT_A,
      limit: 2,
      cursor: first.nextCursor,
    });
    assert.deepEqual(
      second.rows.map((row) => row.id),
      [rows[2]!.id, rows[3]!.id]
    );
    const ids = [...first.rows, ...second.rows].map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length);

    const third = paginatePendingReceiptRows({
      rows,
      tenantId: TENANT_A,
      limit: 2,
      cursor: second.nextCursor,
    });
    assert.deepEqual(
      third.rows.map((row) => row.id),
      [rows[4]!.id]
    );
    assert.equal(third.hasMore, false);
    assert.equal(third.nextCursor, null);
  });

  it("B2-G — in-memory repository matches paginate helper", async () => {
    const repo = new InMemoryFinanceRepository(createFakeBookingPort());
    const created = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId: REG_TARGET,
      amount: "5000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await repo.createReceipt({
      tenantId: TENANT_A,
      paymentId: created.id,
      fileKey: `receipts/${created.id}/proof.jpg`,
    });
    const page = await repo.listPendingReceipts(TENANT_A, {
      limit: 10,
      registrationId: REG_TARGET,
    });
    assert.ok(page.rows.some((row) => row.id === receipt.id));
    assert.equal(typeof page.hasMore, "boolean");
    assert.ok(page.nextCursor === null || typeof page.nextCursor === "string");
    const emptyTour = await repo.listPendingReceipts(TENANT_A, {
      limit: 10,
      registrationIds: [],
    });
    assert.deepEqual(emptyTour, { rows: [], nextCursor: null, hasMore: false });
  });

  it("B2-H — empty scoped queue only when truly empty", () => {
    const rows = [
      receipt({
        id: "00000000-0000-4000-8000-000000000001",
        tenantId: TENANT_A,
        registrationId: REG_OTHER,
        createdAt: "2026-01-01T10:00:00.000Z",
      }),
    ];
    const page = paginatePendingReceiptRows({
      rows,
      tenantId: TENANT_A,
      limit: 50,
      registrationId: REG_TARGET,
    });
    assert.deepEqual(page, { rows: [], nextCursor: null, hasMore: false });
  });

  it("cursor encode/decode round-trip", () => {
    const createdAt = new Date("2026-03-01T08:00:00.000Z");
    const id = "00000000-0000-4000-8000-0000000000aa";
    const encoded = encodePendingReceiptCursor({ createdAt, id });
    const again = paginatePendingReceiptRows({
      rows: [
        receipt({
          id,
          tenantId: TENANT_A,
          registrationId: REG_TARGET,
          createdAt: createdAt.toISOString(),
        }),
        receipt({
          id: "00000000-0000-4000-8000-0000000000ab",
          tenantId: TENANT_A,
          registrationId: REG_TARGET,
          createdAt: "2026-03-01T09:00:00.000Z",
        }),
      ],
      tenantId: TENANT_A,
      limit: 10,
      cursor: encoded,
    });
    assert.equal(again.rows.length, 1);
    assert.equal(again.rows[0]?.id, "00000000-0000-4000-8000-0000000000ab");
  });
});
