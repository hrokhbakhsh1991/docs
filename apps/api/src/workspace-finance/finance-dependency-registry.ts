/**
 * Finance dependency registry — apps/api composition layer (Phase 1.10 / P4-D3.b).
 *
 * Workspace ledger policy + receipt defaults: generated from workspace.manifest.json
 * via async dynamic import (no static product fan-in).
 * Booking projection remains platform-owned (not workspace-declared).
 */

import {
  isFinanceDependencyBindingRegistered,
  listFinanceDependencyWorkspaceTypes,
  WORKSPACE_FINANCE_DEPENDENCY_BINDINGS,
} from "./workspace-finance-dependency-bindings.generated";
import type { FinanceService } from "./finance.service";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";
import type { FinanceLedgerPolicyPort } from "./ports/finance-ledger-policy.port";
import type { FinanceReceiptDefaultsPort } from "./ports/finance-receipt-defaults.port";
import { createBookingPaymentPort } from "../bookings/create-booking-payment-port";
import type { FinanceCaseShadowWrapDeps } from "./case/wrap-finance-service-case-shadow";

/** Fail-closed: boot must set `FINANCE_BOOT_WORKSPACE_TYPE` explicitly (no denali default). */
export const FINANCE_BOOT_WORKSPACE_TYPE_REQUIRED = "FINANCE_BOOT_WORKSPACE_TYPE_REQUIRED";

export type FinanceWorkspaceDependencyFactories = {
  readonly createLedgerPolicy: () => Promise<FinanceLedgerPolicyPort>;
  readonly createReceiptDefaults: () => Promise<FinanceReceiptDefaultsPort>;
  readonly createBookingPayments: () => IBookingPaymentPort;
  readonly decorateFinanceService?: FinanceWorkspaceDecorator;
};

export type FinanceWorkspaceDecorator = (
  service: FinanceService,
  context: FinanceCaseShadowWrapDeps
) => FinanceService;

export type FinanceWorkspaceDependencies = {
  readonly workspaceType: string;
  readonly ledgerPolicy: FinanceLedgerPolicyPort;
  readonly receiptDefaults: FinanceReceiptDefaultsPort;
  readonly bookingPayments: IBookingPaymentPort;
  readonly decorateFinanceService?: (
    service: FinanceService,
    context: FinanceCaseShadowWrapDeps
  ) => FinanceService;
};

function normalizeWorkspaceType(workspaceType: string): string {
  return workspaceType.trim().toLowerCase();
}

function resolveConfiguredBootFinanceWorkspaceType(): string {
  const fromEnv = process.env.FINANCE_BOOT_WORKSPACE_TYPE?.trim().toLowerCase();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  throw new Error(FINANCE_BOOT_WORKSPACE_TYPE_REQUIRED);
}

function createPlatformBookingPayments(): IBookingPaymentPort {
  return createBookingPaymentPort();
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
    decorateFinanceService:
      "decorateFinanceService" in binding ? binding.decorateFinanceService : undefined,
  };
}

/**
 * Boot / legacy composition workspace type.
 * Override with `FINANCE_BOOT_WORKSPACE_TYPE` (must be registry-registered).
 * HTTP SoT remains {@link resolveFinanceServiceForTenant} — not this boot path.
 */
export function resolveBootFinanceWorkspaceType(): string {
  const bootType = resolveConfiguredBootFinanceWorkspaceType();
  if (!isFinanceDependencyBindingRegistered(bootType)) {
    throw new Error(
      `FINANCE_BOOT_WORKSPACE_UNREGISTERED: boot workspaceType=${bootType} missing from registry`
    );
  }
  return bootType;
}

/** @deprecated Use {@link resolveBootFinanceWorkspaceType}. */
export function resolveSoleRegisteredFinanceWorkspaceType(): string {
  return resolveBootFinanceWorkspaceType();
}

export function listRegisteredFinanceWorkspaceTypes(): readonly string[] {
  return listFinanceDependencyWorkspaceTypes();
}

export async function resolveFinanceLedgerPolicy(
  workspaceType: string
): Promise<FinanceLedgerPolicyPort> {
  return requireRegisteredFactories(
    workspaceType,
    "FINANCE_LEDGER_POLICY_UNSUPPORTED"
  ).createLedgerPolicy();
}

export async function resolveFinanceReceiptDefaults(
  workspaceType: string
): Promise<FinanceReceiptDefaultsPort> {
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

export async function resolveFinanceWorkspaceDependencies(
  workspaceType: string
): Promise<FinanceWorkspaceDependencies> {
  const factories = requireRegisteredFactories(
    workspaceType,
    "FINANCE_WORKSPACE_DEPENDENCIES_UNSUPPORTED"
  );
  const [ledgerPolicy, receiptDefaults] = await Promise.all([
    factories.createLedgerPolicy(),
    factories.createReceiptDefaults(),
  ]);
  return {
    workspaceType: normalizeWorkspaceType(workspaceType),
    ledgerPolicy,
    receiptDefaults,
    bookingPayments: factories.createBookingPayments(),
    decorateFinanceService: factories.decorateFinanceService,
  };
}
