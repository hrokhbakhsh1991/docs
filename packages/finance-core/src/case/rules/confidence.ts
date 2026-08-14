/**
 * Confidence quartet generation.
 */

import type { CaseOwner, CaseReading, ConfidenceQuartet } from "../output/case-output";
import type { EncounterMetadata } from "../snapshot/fact-snapshot";

export function generateConfidence(input: {
  readonly reading: CaseReading;
  readonly owner: CaseOwner;
  readonly encounter: EncounterMetadata;
  readonly auditAltitude: boolean;
  readonly decisionReady: boolean;
  readonly coexistenceUnsettled: boolean;
}): ConfidenceQuartet {
  const whyVisible =
    input.encounter.mode === "attention" && input.encounter.attention !== undefined
      ? `Encounter via attention (${input.encounter.attention.attentionClass}); verdict from facts only`
      : input.encounter.mode === "audit"
        ? "Audit/recon encounter — daily reading retained as anchor"
        : "Subject lookup or escalation — facts drive reading";

  if (input.auditAltitude) {
    return {
      whyVisible,
      whyMineOrNot: "Finance at audit altitude — investigation, not counterparty chase",
      ifIWait: "Finding-dependent; not calm counterparty wait",
      avoid: "Do not treat ledger as home or approve from journal alone",
    };
  }

  switch (input.reading) {
    case "AWAITING_COUNTERPARTY":
      return {
        whyVisible,
        whyMineOrNot: "Not finance's move — counterparty owns next step",
        ifIWait: "Intentional delay; settlement stays open — waiting is success",
        avoid: "Do not create payment as repair or invent urgency theater",
      };
    case "AWAITING_FINANCE":
      return {
        whyVisible,
        whyMineOrNot: input.decisionReady
          ? "Finance may decide now — evidence and obligation are sufficient"
          : "Finance owns evidence review",
        ifIWait: input.coexistenceUnsettled
          ? "Backlog delay; unsettled with evidence in review is normal coexistence"
          : "Backlog delay while review is pending",
        avoid: input.decisionReady
          ? "Do not bypass amount/eligibility or decide from ledger first"
          : "Do not treat unsettled as broken or re-chase the counterparty",
      };
    case "NO_MONEY_DUE":
      return {
        whyVisible,
        whyMineOrNot: "Idle — no money chase",
        ifIWait: "N/A — already complete on the money path",
        avoid: "Do not hunt receipts or create intents",
      };
    case "NOT_ELIGIBLE":
      return {
        whyVisible,
        whyMineOrNot: "Product desk owns opening the money path",
        ifIWait: "Wait on product eligibility — not a finance collect failure",
        avoid: "Do not capture or blame counterparty as unpaid finance work",
      };
    case "INTENT_OPEN_NO_PROOF":
      return {
        whyVisible,
        whyMineOrNot: "Counterparty — open intent is not finance review",
        ifIWait: "Wait for proof path; intent alone is not AWAITING_FINANCE",
        avoid: "Do not equate to review or default a second create-payment",
      };
    case "PARTIAL_SCOPED":
      return {
        whyVisible,
        whyMineOrNot: "Counterparty — remaining amount is scoped",
        ifIWait: "Scoped wait/chase — incomplete settlement with declared scope",
        avoid: "Do not unscoped collect the rest",
      };
    case "SETTLED_CAPTURED":
    case "CLOSED_IDLE":
      return {
        whyVisible,
        whyMineOrNot: "Idle — no outstanding move",
        ifIWait: "Nothing required",
        avoid: "Do not re-open chase or create payment",
      };
    case "EXCEPTION":
      return {
        whyVisible,
        whyMineOrNot: "Exception owner — routine finance is unsafe",
        ifIWait: "Hold for judgment — not calm counterparty wait",
        avoid: "Do not happy-path approve/reject or repair via create-payment",
      };
    case "INCOMPLETE_INSPECT":
      return {
        whyVisible,
        whyMineOrNot: "Cannot claim a decision owner until decisive facts are known",
        ifIWait: "Waiting without facts is not affirmative counterparty wait",
        avoid: "Do not invent verdicts from signals or coerce unknown to zero",
      };
    default: {
      const _exhaustive: never = input.reading;
      return _exhaustive;
    }
  }
}
