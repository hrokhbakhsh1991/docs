/**
 * Observational FinanceService wrap — post-success Case shadow only (PR4.5-C).
 * Never mutates primary results; flag OFF skips all Case SoT reads.
 */

import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";
import type { FinanceService } from "@app-tour/finance-core";
import type { ShadowObservationSink } from "@app-tour/finance-core/case";

import type { BookingRepositoryPort } from "../../bookings/ports/booking-repository.port";
import type { FinanceCaseComparisonEmitter } from "./comparison/comparison-observation";
import { resolveFinanceCaseShadowRollout } from "./finance-case-feature-flag";
import type { HostDenaliCaseReadFinancePort } from "./host-denali-case-read-source";
import type { ProductionObservationSink } from "./observation/production-observation-sink";
import {
  scheduleDenaliFinanceCaseShadow,
  type DenaliFinanceCaseShadowTrigger,
} from "./schedule-denali-finance-case-shadow";

export type FinanceCaseShadowWrapFinancePort = HostDenaliCaseReadFinancePort & {
  readonly findPaymentById: (
    tenantId: string,
    paymentId: string
  ) => Promise<{ readonly registrationId: string } | null>;
  readonly findReceiptById: (
    tenantId: string,
    receiptId: string
  ) => Promise<{
    readonly payment: { readonly registrationId: string } | null;
  } | null>;
};

export type FinanceCaseShadowWrapDeps = {
  readonly bookings: Pick<BookingRepositoryPort, "getById">;
  readonly finance: FinanceCaseShadowWrapFinancePort;
  readonly obligation: Pick<
    FinanceObligationPort,
    "resolveRegistrationObligation" | "resolveRegistrationPaymentCollection"
  >;
  readonly sink?: ShadowObservationSink;
  readonly comparisonEmitter?: FinanceCaseComparisonEmitter;
  readonly productionObservationSink?: ProductionObservationSink;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly providerTimeoutMs?: number;
};

function scheduleAfter(
  deps: FinanceCaseShadowWrapDeps,
  input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly trigger: DenaliFinanceCaseShadowTrigger;
  }
): void {
  const rollout = resolveFinanceCaseShadowRollout({
    tenantId: input.tenantId,
    env: deps.env,
    trigger: input.trigger,
  });
  if (!rollout.run) {
    return;
  }
  void (async () => {
    try {
      const booking = await deps.bookings.getById(input.registrationId, input.tenantId);
      const counterpartyId = booking?.submittedByUserId ?? "unknown";
      scheduleDenaliFinanceCaseShadow({
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        counterpartyId,
        trigger: input.trigger,
        readDeps: {
          bookings: deps.bookings,
          finance: deps.finance,
          obligation: deps.obligation,
        },
        sink: deps.sink,
        comparisonEmitter: deps.comparisonEmitter,
        productionObservationSink: deps.productionObservationSink,
        providerTimeoutMs: deps.providerTimeoutMs,
        env: deps.env,
        enabled: true,
      });
    } catch {
      /* fail-open */
    }
  })();
}

/**
 * Wrap a composed FinanceService with Denali Case shadow hooks.
 * Preserves method behavior; schedules observation only after successful mutations/reads.
 */
export function wrapFinanceServiceWithCaseShadow(
  service: FinanceService,
  deps: FinanceCaseShadowWrapDeps
): FinanceService {
  const createManualPayment = service.createManualPayment.bind(service);
  const submitReceipt = service.submitReceipt.bind(service);
  const reviewReceipt = service.reviewReceipt.bind(service);
  const getRegistrationInvoice = service.getRegistrationInvoice.bind(service);

  service.createManualPayment = async (auth, body, idempotencyKey) => {
    const result = await createManualPayment(auth, body, idempotencyKey);
    scheduleAfter(deps, {
      tenantId: auth.tenantId,
      registrationId: body.registrationId,
      trigger: "post_payment_mutation",
    });
    return result;
  };

  service.submitReceipt = async (auth, body, idempotencyKey) => {
    const result = await submitReceipt(auth, body, idempotencyKey);
    if (
      !resolveFinanceCaseShadowRollout({
        tenantId: auth.tenantId,
        env: deps.env,
        trigger: "post_receipt_submit",
      }).run
    ) {
      return result;
    }
    void (async () => {
      try {
        const payment = await deps.finance.findPaymentById(auth.tenantId, body.paymentId);
        if (payment === null) {
          return;
        }
        scheduleAfter(deps, {
          tenantId: auth.tenantId,
          registrationId: payment.registrationId,
          trigger: "post_receipt_submit",
        });
      } catch {
        /* fail-open */
      }
    })();
    return result;
  };

  service.reviewReceipt = async (auth, receiptId, body) => {
    const result = await reviewReceipt(auth, receiptId, body);
    if (
      !resolveFinanceCaseShadowRollout({
        tenantId: auth.tenantId,
        env: deps.env,
        trigger: "post_receipt_review",
      }).run
    ) {
      return result;
    }
    void (async () => {
      try {
        const receipt = await deps.finance.findReceiptById(auth.tenantId, receiptId);
        const registrationId = receipt?.payment?.registrationId;
        if (registrationId === undefined) {
          return;
        }
        scheduleAfter(deps, {
          tenantId: auth.tenantId,
          registrationId,
          trigger: "post_receipt_review",
        });
      } catch {
        /* fail-open */
      }
    })();
    return result;
  };

  service.getRegistrationInvoice = async (auth, registrationId) => {
    const result = await getRegistrationInvoice(auth, registrationId);
    scheduleAfter(deps, {
      tenantId: auth.tenantId,
      registrationId,
      trigger: "finance_read",
    });
    return result;
  };

  return service;
}
