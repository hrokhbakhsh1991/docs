import assert from "node:assert/strict";
import test from "node:test";
import { bookingWalletId } from "../ledger/booking-ledger-authority.service";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "../ledger/ledger-accounts";
import { postDoubleEntryJournal } from "../ledger/post-double-entry-journal";
import { PaymentStatus } from "../../payments/entities/payment.entity";
import {
  formatPaymentReconciliationReportMarkdown,
  generatePaymentReconciliationReport,
  PaymentReconciliationFindingKind
} from "./payment-reconciliation-report";
import { ReconciliationMismatchReason } from "./reconciliation-mismatch";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bookingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function ledgerReceiveMinor(amount: string, currency: string) {
  const { lines } = postDoubleEntryJournal({
    tenantId,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingWalletId(bookingId),
    amount_minor: amount,
    currency,
    correlationId: `registration:${bookingId}:leader_payment:test`,
    idempotencyKey: "test:receive",
    metadata: { source: "test" }
  });
  return [...lines];
}

test("rejects ledger lines that do not belong to report tenantId (strict isolation)", () => {
  const otherTenant = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const foreignLines = postDoubleEntryJournal({
    tenantId: otherTenant,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingWalletId(bookingId),
    amount_minor: "1000",
    currency: "USD",
    correlationId: `registration:${bookingId}:leader_payment:test`,
    idempotencyKey: "test:foreign",
    metadata: { source: "test" }
  }).lines;
  assert.throws(
    () =>
      generatePaymentReconciliationReport({
        tenantId,
        ledgerLines: [...foreignLines],
        internalPayments: [],
        providerCapturedPayments: [],
        bookingSnapshots: [],
        registrations: []
      }),
    /FINANCE_LEDGER_TENANT_MISMATCH/
  );
});

test("report is clean when PSP, ledger, snapshot, registration projection align", () => {
  const report = generatePaymentReconciliationReport({
    tenantId,
    ledgerLines: ledgerReceiveMinor("1000", "USD"),
    internalPayments: [
      {
        id: "pay-1",
        registrationId: bookingId,
        amountMinor: "1000",
        currency: "USD",
        status: PaymentStatus.PAID,
        providerPaymentId: "psp-1"
      }
    ],
    providerCapturedPayments: [
      {
        providerPaymentId: "psp-1",
        registrationId: bookingId,
        capturedAmountMinor: "1000",
        currency: "USD"
      }
    ],
    bookingSnapshots: [{ bookingId, computedTotalMinor: "1000", currency: "USD" }],
    registrations: [
      {
        bookingId,
        paidAmountMinor: "1000",
        quotedCurrencyCode: "USD",
        paymentStatus: "Paid"
      }
    ],
    reportId: "rep-clean"
  });
  assert.equal(report.id, "rep-clean");
  assert.equal(report.summary.bookingIdsExamined >= 1, true);
  const triads = report.findings.filter((f) => f.kind === PaymentReconciliationFindingKind.AMOUNT_TRIAD_MISMATCH);
  assert.equal(triads.length, 0);
  const dups = report.findings.filter((f) => f.kind === PaymentReconciliationFindingKind.DUPLICATE_PAID_INTERNAL_PAYMENT);
  assert.equal(dups.length, 0);
});

test("detects amount triad mismatch (PSP vs ledger)", () => {
  const report = generatePaymentReconciliationReport({
    tenantId,
    ledgerLines: ledgerReceiveMinor("1000", "USD"),
    internalPayments: [
      {
        id: "pay-1",
        registrationId: bookingId,
        amountMinor: "1000",
        currency: "USD",
        status: PaymentStatus.PAID,
        providerPaymentId: "psp-1"
      }
    ],
    providerCapturedPayments: [
      {
        providerPaymentId: "psp-1",
        registrationId: bookingId,
        capturedAmountMinor: "1001",
        currency: "USD"
      }
    ],
    bookingSnapshots: [{ bookingId, computedTotalMinor: "1000", currency: "USD" }],
    registrations: [{ bookingId, paidAmountMinor: "1000", paymentStatus: "Paid" }]
  });
  const m = report.findings.find((f) => f.kind === PaymentReconciliationFindingKind.AMOUNT_TRIAD_MISMATCH);
  assert.ok(m?.triadMismatch);
  assert.equal(m!.triadMismatch!.reason, ReconciliationMismatchReason.AMOUNT_TRIAD_MISMATCH);
});

test("detects duplicate Paid internal payments for same booking", () => {
  const report = generatePaymentReconciliationReport({
    tenantId,
    ledgerLines: [],
    internalPayments: [
      {
        id: "pay-a",
        registrationId: bookingId,
        amountMinor: "500",
        currency: "USD",
        status: PaymentStatus.PAID,
        providerPaymentId: "psp-a"
      },
      {
        id: "pay-b",
        registrationId: bookingId,
        amountMinor: "500",
        currency: "USD",
        status: PaymentStatus.PAID,
        providerPaymentId: "psp-b"
      }
    ],
    providerCapturedPayments: [],
    bookingSnapshots: [],
    registrations: []
  });
  assert.ok(
    report.findings.some((f) => f.kind === PaymentReconciliationFindingKind.DUPLICATE_PAID_INTERNAL_PAYMENT)
  );
});

test("detects missing provider capture for internal Paid", () => {
  const report = generatePaymentReconciliationReport({
    tenantId,
    ledgerLines: [],
    internalPayments: [
      {
        id: "pay-1",
        registrationId: bookingId,
        amountMinor: "1000",
        currency: "USD",
        status: PaymentStatus.PAID,
        providerPaymentId: "psp-missing"
      }
    ],
    providerCapturedPayments: [],
    bookingSnapshots: [],
    registrations: []
  });
  assert.ok(
    report.findings.some((f) => f.kind === PaymentReconciliationFindingKind.MISSING_PROVIDER_CAPTURE)
  );
});

test("detects missing internal settlement for provider capture", () => {
  const report = generatePaymentReconciliationReport({
    tenantId,
    ledgerLines: [],
    internalPayments: [
      {
        id: "pay-1",
        registrationId: bookingId,
        amountMinor: "1000",
        currency: "USD",
        status: PaymentStatus.PENDING,
        providerPaymentId: "psp-orphan"
      }
    ],
    providerCapturedPayments: [
      {
        providerPaymentId: "psp-orphan",
        registrationId: bookingId,
        capturedAmountMinor: "1000",
        currency: "USD"
      }
    ],
    bookingSnapshots: [],
    registrations: []
  });
  assert.ok(
    report.findings.some((f) => f.kind === PaymentReconciliationFindingKind.MISSING_INTERNAL_SETTLEMENT)
  );
});

test("detects duplicate providerPaymentId in provider feed", () => {
  const report = generatePaymentReconciliationReport({
    tenantId,
    ledgerLines: [],
    internalPayments: [],
    providerCapturedPayments: [
      {
        providerPaymentId: "dup",
        registrationId: bookingId,
        capturedAmountMinor: "1",
        currency: "USD"
      },
      {
        providerPaymentId: "dup",
        registrationId: bookingId,
        capturedAmountMinor: "1",
        currency: "USD"
      }
    ],
    bookingSnapshots: [],
    registrations: []
  });
  assert.ok(
    report.findings.some((f) => f.kind === PaymentReconciliationFindingKind.DUPLICATE_PROVIDER_PAYMENT_ID_IN_FEED)
  );
});

test("markdown formatter includes header", () => {
  const report = generatePaymentReconciliationReport({
    tenantId,
    ledgerLines: [],
    internalPayments: [],
    providerCapturedPayments: [],
    bookingSnapshots: [],
    registrations: []
  });
  const md = formatPaymentReconciliationReportMarkdown(report);
  assert.match(md, /Payment reconciliation/);
});

test("detects ledger booking wallet vs registration paid_amount drift", () => {
  const report = generatePaymentReconciliationReport({
    tenantId,
    ledgerLines: ledgerReceiveMinor("1000", "USD"),
    internalPayments: [
      {
        id: "pay-1",
        registrationId: bookingId,
        amountMinor: "1000",
        currency: "USD",
        status: PaymentStatus.PAID,
        providerPaymentId: "psp-1"
      }
    ],
    providerCapturedPayments: [
      {
        providerPaymentId: "psp-1",
        registrationId: bookingId,
        capturedAmountMinor: "1000",
        currency: "USD"
      }
    ],
    bookingSnapshots: [{ bookingId, computedTotalMinor: "1000", currency: "USD" }],
    registrations: [
      {
        bookingId,
        paidAmountMinor: "500",
        quotedCurrencyCode: "USD",
        paymentStatus: "Paid"
      }
    ]
  });
  assert.ok(
    report.findings.some((f) => f.kind === PaymentReconciliationFindingKind.LEDGER_VS_REGISTRATION_PAID_MISMATCH)
  );
});
