import assert from "node:assert/strict";
import test from "node:test";
import { postDoubleEntryJournal } from "./post-double-entry-journal";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import { bookingWalletId } from "./booking-ledger-authority.service";
import {
  assertLedgerLinesFinanceTenantScope,
  normalizeFinanceTenantId
} from "./ledger-tenant-scope";

const tA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("normalizeFinanceTenantId trims and lowercases", () => {
  assert.equal(normalizeFinanceTenantId(`  ${tA.toUpperCase()}  `), tA);
});

test("normalizeFinanceTenantId rejects empty", () => {
  assert.throws(() => normalizeFinanceTenantId("   "), /FINANCE_TENANT_ID_REQUIRED/);
});

test("assertLedgerLinesFinanceTenantScope passes when all lines match envelope", () => {
  const { lines } = postDoubleEntryJournal({
    tenantId: tA,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingWalletId("reg-1"),
    amount_minor: "1",
    currency: "USD",
    correlationId: "c",
    idempotencyKey: "k"
  });
  assertLedgerLinesFinanceTenantScope(tA, lines);
  assertLedgerLinesFinanceTenantScope(tA.toUpperCase(), lines);
});

test("assertLedgerLinesFinanceTenantScope throws on tenant mismatch", () => {
  const { lines } = postDoubleEntryJournal({
    tenantId: tA,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingWalletId("reg-1"),
    amount_minor: "1",
    currency: "USD",
    correlationId: "c",
    idempotencyKey: "k"
  });
  assert.throws(() => assertLedgerLinesFinanceTenantScope(tB, lines), /FINANCE_LEDGER_TENANT_MISMATCH/);
});
