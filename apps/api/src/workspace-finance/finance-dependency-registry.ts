/**
 * Finance dependency registry — apps/api composition layer (Phase 1.10).
 *
 * Workspace ledger policy + receipt defaults: generated from workspace.manifest.json.
 * Booking projection remains platform-owned (not workspace-declared).
 */

import {
  isFinanceDependencyBindingRegistered,
  listFinanceDependencyWorkspaceTypes,
  WORKSPACE_FINANCE_DEPENDENCY_BINDINGS,
} from "./workspace-finance-dependency-bindings.generated";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";
import type { FinanceLedgerPolicyPort } from "./ports/finance-ledger-policy.port";
import type { FinanceReceiptDefaultsPort } from "./ports/finance-receipt-defaults.port";

/** Production boot / lazy-finance default workspace type (Denali behavior preserved). */
export const BOOT_FINANCE_WORKSPACE_TYPE = "denali";

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

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

function createPlatformBookingPayments(): IBookingPaymentPort {
  return new BookingPaymentAdapter();
}

export function isFinanceDependencyWorkspaceRegistered(workspaceType: string): boolean {
  const normalized = normalizeWorkspaceType(workspaceType);
  return normalized.length > 0 && isFinanceDependencyBindingRegistered(normalized);
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
  const binding =
    WORKSPACE_FINANCE_DEPENDENCY_BINDINGS[
      normalized as keyof typeof WORKSPACE_FINANCE_DEPENDENCY_BINDINGS
    ];
  if (binding === undefined) {
    throw new Error(
      `${unsupportedCode}: no finance dependency registration for workspaceType=${workspaceType}`
    );
  }
  return {
    createLedgerPolicy: binding.createLedgerPolicy,
    createReceiptDefaults: binding.createReceiptDefaults,
    createBookingPayments: createPlatformBookingPayments,
  };
}

/**
 * Boot singleton workspace type (Denali). Fail-closed if Denali missing from generated bindings.
 */
export function resolveBootFinanceWorkspaceType(): string {
  if (!isFinanceDependencyBindingRegistered(BOOT_FINANCE_WORKSPACE_TYPE)) {
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
  return listFinanceDependencyWorkspaceTypes();
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
