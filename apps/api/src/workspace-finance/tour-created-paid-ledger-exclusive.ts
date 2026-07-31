/**
 * Path B exclusive emit — TourCreated paid ledger under registration wallet-credit lock.
 * Journal materialization comes from workspace FinanceLedgerPolicyPort (generated loader);
 * outbox enqueue stays platform-owned.
 */
import { withTenantRls } from "../db/with-tenant-rls";
import { enqueueFinanceLedgerCaptureOutbox } from "./enqueue-finance-ledger-capture";
import { resolveFinanceLedgerPolicy } from "./finance-dependency-registry";
import { createTxScopedOutboxWriter } from "./infrastructure/prisma-workspace-outbox-writer";
import {
  advisoryLockRegistrationWalletCredit,
  registrationHasBookingWalletCredit,
} from "./registration-booking-wallet-credit";
import { resolveFinanceWorkspaceTypeForTenant } from "./resolve-finance-workspace-type-for-tenant";

export type TourCreatedPaidLedgerExclusiveInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paidAmountMinor: string;
  readonly currency: string;
  readonly tourCreatedDomainEventId: string;
};

export type TourCreatedPaidLedgerExclusiveResult = "emitted" | "skipped";

/**
 * Under pg_advisory_xact_lock: skip if Path A/B credit exists; else emit TourCreated ledger.
 * Payment capture domainEventIds are not modified.
 * Journal/line ids are seeded from TourCreated domainEventId (deterministic).
 */
export async function emitTourCreatedPaidLedgerExclusive(
  input: TourCreatedPaidLedgerExclusiveInput
): Promise<TourCreatedPaidLedgerExclusiveResult> {
  const registrationId = input.registrationId.trim();
  const paidAmountMinor = input.paidAmountMinor.trim();
  const tourCreatedDomainEventId = input.tourCreatedDomainEventId.trim();
  if (!registrationId || !paidAmountMinor || !tourCreatedDomainEventId) {
    return "skipped";
  }

  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(input.tenantId);
  const policy = await resolveFinanceLedgerPolicy(workspaceType);
  if (typeof policy.buildTourCreatedPaidJournal !== "function") {
    throw new Error(
      `FINANCE_TOUR_CREATED_LEDGER_UNSUPPORTED: workspaceType=${workspaceType}`
    );
  }

  return withTenantRls(input.tenantId, async (tx) => {
    await advisoryLockRegistrationWalletCredit(tx, input.tenantId, registrationId);
    if (await registrationHasBookingWalletCredit(tx, input.tenantId, registrationId)) {
      return "skipped";
    }

    const currency = input.currency.trim() || "USD";
    const capture = policy.buildTourCreatedPaidJournal!({
      tenantId: input.tenantId,
      registrationId,
      paidAmountMinor,
      currency,
      tourCreatedDomainEventId,
    });

    const writer = createTxScopedOutboxWriter(tx);
    const inserted = await enqueueFinanceLedgerCaptureOutbox({
      outboxWriter: writer,
      tenantId: input.tenantId,
      registrationId,
      capture,
    });
    return inserted ? "emitted" : "skipped";
  });
}
