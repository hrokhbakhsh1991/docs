import assert from "node:assert/strict";
import test from "node:test";
import { LEDGER_ACCOUNTS } from "../ledger/ledger-accounts";
import { postDoubleEntryJournal } from "../ledger/post-double-entry-journal";
import {
  issueImmutableInvoice,
  verifyImmutableInvoiceIntegrity
} from "./immutable-invoice";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bookingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const snapshotBase = {
  tenantId,
  bookingId,
  computedTotalMinor: "9999",
  currency: "USD",
  pricingRuleVersion: "pv:1",
  listPriceMinor: "10000",
  createdAt: new Date("2026-03-01T10:00:00.000Z")
};

test("issueImmutableInvoice rejects ledger lines from another tenant", () => {
  const otherTenant = "99999999-9999-4999-8999-999999999999";
  const { lines } = postDoubleEntryJournal({
    tenantId: otherTenant,
    debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
    creditAccount: `booking:${bookingId}`,
    amount_minor: "100",
    currency: "USD",
    correlationId: "c-x",
    idempotencyKey: "idem-x"
  });
  assert.throws(
    () =>
      issueImmutableInvoice({
        tenantId,
        bookingId,
        snapshot: {
          ...snapshotBase,
          snapshotId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        },
        ledgerLines: lines
      }),
    /FINANCE_LEDGER_TENANT_MISMATCH/
  );
});

test("issueImmutableInvoice requires snapshotId", () => {
  assert.throws(
    () =>
      issueImmutableInvoice({
        tenantId,
        bookingId,
        snapshot: {
          ...snapshotBase,
          snapshotId: "   "
        },
        ledgerLines: []
      }),
    /INVOICE_SNAPSHOT_REQUIRED/
  );
});

test("issueImmutableInvoice seals payload and verifies integrity", () => {
  const { lines } = postDoubleEntryJournal({
    tenantId,
    debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
    creditAccount: `booking:${bookingId}`,
    amount_minor: "100",
    currency: "USD",
    correlationId: "c1",
    idempotencyKey: "idem-1"
  });
  const inv = issueImmutableInvoice({
    tenantId,
    bookingId,
    snapshot: {
      ...snapshotBase,
      snapshotId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    },
    ledgerLines: lines,
    issuedAt: new Date("2026-03-02T00:00:00.000Z")
  });
  assert.equal(inv.snapshot.snapshotId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  assert.equal(inv.totals.invoiceTotalMinor, "9999");
  assert.equal(inv.ledgerLines.length, 1);
  assert.equal(inv.ledgerLines[0]!.side, "credit");
  assert.ok(verifyImmutableInvoiceIntegrity(inv));
  assert.throws(() => {
    (inv as unknown as { totals: { invoiceTotalMinor: string } }).totals.invoiceTotalMinor = "1";
  }, /read only|read-only|Cannot assign/i);
});

test("issueImmutableInvoice is deterministic for same snapshot and issuedAt", () => {
  const issuedAt = new Date("2026-03-02T00:00:00.000Z");
  const snap = { ...snapshotBase, snapshotId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
  const a = issueImmutableInvoice({ tenantId, bookingId, snapshot: snap, ledgerLines: [], issuedAt });
  const b = issueImmutableInvoice({ tenantId, bookingId, snapshot: snap, ledgerLines: [], issuedAt });
  assert.equal(a.invoiceId, b.invoiceId);
  assert.equal(a.integrity.contentHash, b.integrity.contentHash);
});
