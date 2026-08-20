import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import { getBookingsRepository } from "../bookings/create-bookings-repository";
import { createTourStorageRepository } from "../storage/create-tour-storage";
import { resolveFinanceReceiptDefaults } from "./finance-dependency-registry";
import { RegistrationFinanceObligationAdapter } from "./infrastructure/registration-finance-obligation.adapter";
import {
  isFinanceObligationBindingRegistered,
  WORKSPACE_FINANCE_OBLIGATION_BINDINGS,
} from "./workspace-finance-obligation-bindings.generated";

/** No-op obligation resolver for workspaces without commercial pricing bind (FC-2). */
const nullFinanceObligationPort: FinanceObligationPort = {
  async resolveRegistrationObligation() {
    return null;
  },
  async resolveRegistrationPaymentCollection() {
    return "offline";
  },
  async setRegistrationObligationOverride() {
    return false;
  },
};

/**
 * Workspace-type → commercial obligation port (FC-2 / P3.5 / P4-D3.b).
 * Resolvers come from codegen (`registrationObligation` in workspace.manifest.json)
 * via async dynamic import.
 */
export async function createFinanceObligationPort(
  workspaceType: string
): Promise<FinanceObligationPort> {
  const normalized = workspaceType.trim().toLowerCase();
  if (!isFinanceObligationBindingRegistered(normalized)) {
    return nullFinanceObligationPort;
  }
  const binding =
    WORKSPACE_FINANCE_OBLIGATION_BINDINGS[
      normalized as keyof typeof WORKSPACE_FINANCE_OBLIGATION_BINDINGS
    ];
  const resolve = await binding.loadResolve();

  let resolvePaymentCollection: (tourCanonical: unknown) => "offline" | "free" = () =>
    "offline";
  if ("loadPaymentCollection" in binding && typeof binding.loadPaymentCollection === "function") {
    resolvePaymentCollection = await binding.loadPaymentCollection();
  }

  let resolveGrossObligation:
    | ((input: {
        readonly tourCanonical: unknown;
        readonly partySize: number;
        readonly currency?: string;
        readonly registrationIntake?: unknown;
      }) => {
        readonly currency: string;
        readonly obligationMinor: string;
        readonly source: "tour_canonical" | "schedule" | "operator_override" | "unknown";
      } | null)
    | undefined;
  if ("loadGrossResolve" in binding && typeof binding.loadGrossResolve === "function") {
    resolveGrossObligation = await binding.loadGrossResolve();
  }

  const receiptDefaults = await resolveFinanceReceiptDefaults(normalized);
  const resolveDefaultCurrency = () => receiptDefaults.offlineReceiptPaymentDefaults().currency;

  return new RegistrationFinanceObligationAdapter(
    getBookingsRepository(),
    createTourStorageRepository(),
    resolve,
    resolveDefaultCurrency,
    resolvePaymentCollection,
    resolveGrossObligation
  );
}
