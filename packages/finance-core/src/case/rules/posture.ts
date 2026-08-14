/**
 * Decision posture + allow/forbid — no default create-payment repair.
 */

import type {
  CaseAllowAction,
  CaseForbidAction,
  CasePosture,
  CaseReading,
  CompletenessClass,
} from "../output/case-output";
import { DEFAULT_CASE_FORBIDS } from "../output/case-output";

export type PostureResolution = {
  readonly primaryPosture: CasePosture;
  readonly allow: readonly CaseAllowAction[];
  readonly forbid: readonly CaseForbidAction[];
  readonly decisionReady: boolean;
};

function uniqueForbid(
  extra: readonly CaseForbidAction[] = []
): readonly CaseForbidAction[] {
  return [...new Set([...DEFAULT_CASE_FORBIDS, ...extra])];
}

export function generatePosture(input: {
  readonly reading: CaseReading;
  readonly completenessClass: CompletenessClass;
  readonly auditAltitude: boolean;
  readonly decisionReadyFacts: boolean;
}): PostureResolution {
  if (input.auditAltitude) {
    return {
      primaryPosture: "inspect",
      decisionReady: false,
      allow: ["investigate", "exit_audit_to_case", "inspect"],
      forbid: uniqueForbid(["ledger_first_decide", "rechase_counterparty"]),
    };
  }

  if (
    input.completenessClass === "inspect_forced" &&
    input.reading === "INCOMPLETE_INSPECT"
  ) {
    return {
      primaryPosture: "inspect",
      decisionReady: false,
      allow: ["inspect"],
      forbid: uniqueForbid(["happy_path_approve"]),
    };
  }

  switch (input.reading) {
    case "AWAITING_COUNTERPARTY":
      return {
        primaryPosture: "wait",
        decisionReady: false,
        allow: ["wait", "inspect", "escalate"],
        forbid: uniqueForbid(["rechase_counterparty"]),
      };
    case "AWAITING_FINANCE": {
      if (input.decisionReadyFacts && input.completenessClass === "act_complete") {
        return {
          primaryPosture: "act",
          decisionReady: true,
          allow: ["approve_evidence", "reject_evidence", "wait", "inspect_evidence"],
          forbid: uniqueForbid(["rechase_counterparty"]),
        };
      }
      return {
        primaryPosture: "inspect",
        decisionReady: false,
        allow: ["inspect_evidence", "wait", "escalate"],
        forbid: uniqueForbid(["rechase_counterparty"]),
      };
    }
    case "NO_MONEY_DUE":
      return {
        primaryPosture: "wait",
        decisionReady: false,
        allow: ["leave", "inspect"],
        forbid: uniqueForbid(["chase_receipts"]),
      };
    case "NOT_ELIGIBLE":
      return {
        primaryPosture: "wait",
        decisionReady: false,
        allow: ["handoff_product", "inspect", "wait"],
        forbid: uniqueForbid(),
      };
    case "INTENT_OPEN_NO_PROOF":
      return {
        primaryPosture: "wait",
        decisionReady: false,
        allow: ["wait", "inspect"],
        forbid: uniqueForbid(),
      };
    case "PARTIAL_SCOPED":
      return {
        primaryPosture: "wait",
        decisionReady: false,
        allow: ["wait", "inspect", "escalate"],
        forbid: uniqueForbid(["unscoped_collect"]),
      };
    case "SETTLED_CAPTURED":
    case "CLOSED_IDLE":
      return {
        primaryPosture: "wait",
        decisionReady: false,
        allow: ["leave", "inspect"],
        forbid: uniqueForbid(["chase_receipts"]),
      };
    case "EXCEPTION":
      return {
        primaryPosture: "escalate",
        decisionReady: false,
        allow: ["escalate", "investigate", "inspect"],
        forbid: uniqueForbid(["happy_path_approve"]),
      };
    case "INCOMPLETE_INSPECT":
      return {
        primaryPosture: "inspect",
        decisionReady: false,
        allow: ["inspect"],
        forbid: uniqueForbid(["happy_path_approve"]),
      };
    default: {
      const _exhaustive: never = input.reading;
      return _exhaustive;
    }
  }
}
