/**
 * Ownership resolver — single L1 owner; never member; never shared.
 */

import type { CaseOwner, CaseReading } from "../output/case-output";

export type OwnershipResolution = {
  readonly owner: CaseOwner;
  readonly whyOwner: string;
};

export function resolveOwnership(
  reading: CaseReading,
  options: { readonly auditAltitude: boolean; readonly policyApplying?: boolean }
): OwnershipResolution {
  if (options.auditAltitude) {
    return {
      owner: "audit",
      whyOwner: "Investigation altitude — accounting proof, then return to Case reading",
    };
  }

  switch (reading) {
    case "AWAITING_COUNTERPARTY":
    case "INTENT_OPEN_NO_PROOF":
    case "PARTIAL_SCOPED":
      return {
        owner: "counterparty",
        whyOwner: "Next money ingress or correction is outside finance hands",
      };
    case "AWAITING_FINANCE":
      return {
        owner: "finance",
        whyOwner: "Evidence is in finance review",
      };
    case "NO_MONEY_DUE":
      return options.policyApplying === true
        ? {
            owner: "policy_system",
            whyOwner: "Collection policy still applying — not a chase task",
          }
        : {
            owner: "idle",
            whyOwner: "No money due — nothing to chase",
          };
    case "NOT_ELIGIBLE":
      return {
        owner: "product_desk",
        whyOwner: "Money path is not open — product owns eligibility",
      };
    case "SETTLED_CAPTURED":
    case "CLOSED_IDLE":
      return {
        owner: "idle",
        whyOwner: "No outstanding finance move",
      };
    case "EXCEPTION":
      return {
        owner: "exception_policy",
        whyOwner: "Commercial meaning conflict — routine finance is unsafe",
      };
    case "INCOMPLETE_INSPECT":
      return {
        owner: "finance",
        whyOwner: "Facts incomplete — inspect before claiming ownership of a decision",
      };
    default: {
      const _exhaustive: never = reading;
      return _exhaustive;
    }
  }
}
