/**
 * Load OperationalObservation from live host SoT deps (PR5-A).
 * Read-only — no Case interpretation.
 */

import type { HostDenaliCaseReadDeps } from "../host-denali-case-read-source";
import {
  classifyOperationalObservation,
  type OperationalObservation,
} from "./operational-observation";

export type LoadOperationalObservationInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly readDeps: Omit<HostDenaliCaseReadDeps, "tenantId">;
};

/**
 * Extract current operational classification for a registration.
 * Failures surface as null (caller treats as uncomparable).
 */
export async function loadOperationalObservation(
  input: LoadOperationalObservationInput
): Promise<OperationalObservation | null> {
  try {
    const booking = await input.readDeps.bookings.getById(
      input.registrationId,
      input.tenantId
    );
    if (booking === null) {
      return null;
    }

    const pendingPayment = await input.readDeps.finance.findFirstPendingManualPayment(
      input.tenantId,
      input.registrationId
    );
    const receipt = await input.readDeps.finance.findLatestReceiptForRegistration(
      input.tenantId,
      input.registrationId
    );
    const pendingPage = await input.readDeps.finance.listPendingReceipts(input.tenantId, {
      limit: 1,
      registrationId: input.registrationId,
    });
    const inPendingReceiptQueue = pendingPage.rows.length > 0;

    let noMoneyDueCue = false;
    try {
      const collection = await input.readDeps.obligation.resolveRegistrationPaymentCollection({
        tenantId: input.tenantId,
        registrationId: input.registrationId,
      });
      if (collection === "free") {
        noMoneyDueCue = true;
      } else {
        const obligation = await input.readDeps.obligation.resolveRegistrationObligation({
          tenantId: input.tenantId,
          registrationId: input.registrationId,
        });
        if (obligation !== null) {
          const digits = obligation.obligationMinor.replace(/\D/g, "");
          noMoneyDueCue = digits.length > 0 && BigInt(digits) === BigInt(0);
        }
      }
    } catch {
      noMoneyDueCue = false;
    }

    return classifyOperationalObservation({
      bookingStatus: booking.status,
      bookingPaymentStatus: booking.paymentStatus,
      hasPendingManualPayment: pendingPayment !== null,
      latestReceiptStatus: receipt?.status ?? null,
      inPendingReceiptQueue,
      noMoneyDueCue,
    });
  } catch {
    return null;
  }
}
