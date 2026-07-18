/**
 * Finance dependency registry — apps/api composition layer.
 *
 * Maps workspaceType → ledger policy + offline receipt defaults + booking projection.
 * Phase 1.5 Commit 1: tenant-aware resolution selects these factories by workspaceType.
 * Boot lazy path still uses {@link BOOT_FINANCE_WORKSPACE_TYPE} (Denali) for backward compatibility.
 *
 * Registration keys are literal workspace type ids (avoid importing workspace packages here).
 */

import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter";
import { DenaliFinanceLedgerPolicyAdapter } from "./infrastructure/denali-finance-ledger-policy.adapter";
import { DenaliFinanceReceiptDefaultsAdapter } from "./infrastructure/denali-finance-receipt-defaults.adapter";
import { FINANCE_WS2_WORKSPACE_TYPE } from "./infrastructure/finance-ws2-chart-of-accounts";
import { FinanceWs2LedgerPolicyAdapter } from "./infrastructure/finance-ws2-ledger-policy.adapter";
import { FinanceWs2ReceiptDefaultsAdapter } from "./infrastructure/finance-ws2-receipt-defaults.adapter";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";
import type { FinanceLedgerPolicyPort } from "./ports/finance-ledger-policy.port";
import type { FinanceReceiptDefaultsPort } from "./ports/finance-receipt-defaults.port";

/** Must match Denali workspace type id — avoid importing the Denali package here. */
const DENALI_WORKSPACE_TYPE = "denali";

/**
 * Production boot / lazy-finance default workspace type (Denali behavior preserved).
 * Multi-registration is allowed; boot must not use “sole registered” semantics.
 */
export const BOOT_FINANCE_WORKSPACE_TYPE = DENALI_WORKSPACE_TYPE;

export type FinanceWorkspaceDependencyFactories = {
  readonly createLedgerPolicy: () => FinanceLedgerPolicyPort;
  readonly createReceiptDefaults: () => FinanceReceiptDefaultsPort;
  readonly createBookingPayments: () => IBookingPaymentPort;
};

export type FinanceWorkspaceDependencies = {
  readonly workspaceType: string;
  readonly ledgerPolicy: FinanceLedgerPolicyPort;
  readonly receiptDefaults: FinanceReceiptDefaultsPort;
  readonly bookingPayments: IBookingPaymentPort;
};

const FINANCE_DEPENDENCY_REGISTRY: ReadonlyMap<string, FinanceWorkspaceDependencyFactories> =
  new Map([
    [
      DENALI_WORKSPACE_TYPE,
      {
        createLedgerPolicy: () => new DenaliFinanceLedgerPolicyAdapter(),
        createReceiptDefaults: () => new DenaliFinanceReceiptDefaultsAdapter(),
        createBookingPayments: () => new BookingPaymentAdapter(),
      },
    ],
    [
      FINANCE_WS2_WORKSPACE_TYPE,
      {
        createLedgerPolicy: () => new FinanceWs2LedgerPolicyAdapter(),
        createReceiptDefaults: () => new FinanceWs2ReceiptDefaultsAdapter(),
        createBookingPayments: () => new BookingPaymentAdapter(),
      },
    ],
  ]);

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

export function isFinanceDependencyWorkspaceRegistered(workspaceType: string): boolean {
  const normalized = normalizeWorkspaceType(workspaceType);
  return normalized.length > 0 && FINANCE_DEPENDENCY_REGISTRY.has(normalized);
}

type UnsupportedCode =
  | "FINANCE_LEDGER_POLICY_UNSUPPORTED"
  | "FINANCE_RECEIPT_DEFAULTS_UNSUPPORTED"
  | "FINANCE_BOOKING_PAYMENT_UNSUPPORTED"
  | "FINANCE_WORKSPACE_DEPENDENCIES_UNSUPPORTED";

function requireRegisteredFactories(
  workspaceType: string,
  unsupportedCode: UnsupportedCode
): FinanceWorkspaceDependencyFactories {
  const normalized = normalizeWorkspaceType(workspaceType);
  if (normalized.length === 0) {
    throw new Error(
      "FINANCE_WORKSPACE_TYPE_REQUIRED: workspaceType is required to resolve finance dependencies"
    );
  }
  const factories = FINANCE_DEPENDENCY_REGISTRY.get(normalized);
  if (factories === undefined) {
    throw new Error(
      `${unsupportedCode}: no finance dependency registration for workspaceType=${workspaceType}`
    );
  }
  return factories;
}

/**
 * Boot singleton workspace type (Denali). Not “sole registered” — registry also holds finance-ws2.
 */
export function resolveBootFinanceWorkspaceType(): string {
  if (!FINANCE_DEPENDENCY_REGISTRY.has(BOOT_FINANCE_WORKSPACE_TYPE)) {
    throw new Error(
      `FINANCE_BOOT_WORKSPACE_UNREGISTERED: boot workspaceType=${BOOT_FINANCE_WORKSPACE_TYPE} missing from registry`
    );
  }
  return BOOT_FINANCE_WORKSPACE_TYPE;
}

/** @deprecated Use {@link resolveBootFinanceWorkspaceType}. */
export function resolveSoleRegisteredFinanceWorkspaceType(): string {
  return resolveBootFinanceWorkspaceType();
}

export function listRegisteredFinanceWorkspaceTypes(): readonly string[] {
  return [...FINANCE_DEPENDENCY_REGISTRY.keys()].sort();
}

export function resolveFinanceLedgerPolicy(workspaceType: string): FinanceLedgerPolicyPort {
  return requireRegisteredFactories(workspaceType, "FINANCE_LEDGER_POLICY_UNSUPPORTED").createLedgerPolicy();
}

export function resolveFinanceReceiptDefaults(workspaceType: string): FinanceReceiptDefaultsPort {
  return requireRegisteredFactories(
    workspaceType,
    "FINANCE_RECEIPT_DEFAULTS_UNSUPPORTED"
  ).createReceiptDefaults();
}

export function resolveFinanceBookingPayments(workspaceType: string): IBookingPaymentPort {
  return requireRegisteredFactories(
    workspaceType,
    "FINANCE_BOOKING_PAYMENT_UNSUPPORTED"
  ).createBookingPayments();
}

/** Resolve all workspace finance ports for composition (fail closed if unregistered). */
export function resolveFinanceWorkspaceDependencies(
  workspaceType: string
): FinanceWorkspaceDependencies {
  const factories = requireRegisteredFactories(
    workspaceType,
    "FINANCE_WORKSPACE_DEPENDENCIES_UNSUPPORTED"
  );
  return {
    workspaceType: normalizeWorkspaceType(workspaceType),
    ledgerPolicy: factories.createLedgerPolicy(),
    receiptDefaults: factories.createReceiptDefaults(),
    bookingPayments: factories.createBookingPayments(),
  };
}
