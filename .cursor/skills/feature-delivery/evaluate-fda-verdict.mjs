/**
 * FDA-001 v1.3 — evaluate final Feature Delivery verdict against capability matrix.
 * @see docs/dev/feature-delivery/completion-rules.mdoc
 */

/** @typedef {'mandatory' | 'optional'} RowMandatory */
/** @typedef {'COMPLETE' | 'COMPLETE_WITH_ACCEPTED_RISKS' | 'INCOMPLETE' | 'BLOCKED'} FdaVerdict */

/**
 * @typedef {Object} CapabilityRow
 * @property {string} id
 * @property {RowMandatory} mandatory
 * @property {string} status
 * @property {string} [category]
 */

/**
 * @typedef {Object} AcceptedRisk
 * @property {string} riskId
 * @property {string} approvedBy
 * @property {string} decision
 * @property {string} [release]
 * @property {string} [scope]
 * @property {string} [expiry]
 * @property {string} [followUp]
 * @property {string} [category]
 * @property {boolean} [mandatory]
 */

export const BLOCKING_STATUSES = Object.freeze([
  "broken",
  "missing",
  "partial",
  "skipped",
  "unverified",
  "browser-unverified",
  "producer-missing",
  "data durability unverified",
  "rls/security unverified",
  "blocked",
  "fixture-only",
  "mocked",
  "test-only",
]);

/** Risk categories that can never be accepted — §3.6 / §6 completion-rules.mdoc */
export const NON_ACCEPTABLE_RISK_CATEGORIES = Object.freeze([
  "security",
  "tenant-isolation",
  "rls",
  "data-durability",
  "mandatory-event-producer",
  "broken-mandatory-path",
]);

const COMPLETE_ALIASES = Object.freeze([
  "COMPLETE",
  "FEATURE_COMPLETE",
  "SHARED_NOTIFICATION_AUDIT_COMPLETE",
  "BROWSER_GAPS_CLOSED",
]);

const COMPLETE_WITH_RISKS_ALIASES = Object.freeze([
  "COMPLETE_WITH_ACCEPTED_RISKS",
  "SHARED_NOTIFICATION_AUDIT_COMPLETE_WITH_ACCEPTED_RISKS",
]);

const INCOMPLETE_ALIASES = Object.freeze(["INCOMPLETE", "SHARED_NOTIFICATION_AUDIT_INCOMPLETE"]);

const BLOCKED_ALIASES = Object.freeze(["BLOCKED", "SHARED_NOTIFICATION_AUDIT_BLOCKED"]);

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeCapabilityStatus(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, " ");
}

/**
 * @param {string} raw
 * @returns {FdaVerdict | string}
 */
export function normalizeVerdict(raw) {
  const v = String(raw ?? "").trim();
  if (COMPLETE_ALIASES.includes(v)) return "COMPLETE";
  if (COMPLETE_WITH_RISKS_ALIASES.includes(v)) return "COMPLETE_WITH_ACCEPTED_RISKS";
  if (INCOMPLETE_ALIASES.includes(v)) return "INCOMPLETE";
  if (BLOCKED_ALIASES.includes(v)) return "BLOCKED";
  return v;
}

/**
 * @param {CapabilityRow} row
 * @returns {boolean}
 */
export function isBlockingMandatoryRow(row) {
  if (row.mandatory !== "mandatory") return false;
  const status = normalizeCapabilityStatus(row.status);
  return BLOCKING_STATUSES.some((block) => status === normalizeCapabilityStatus(block));
}

/**
 * @param {AcceptedRisk} risk
 * @returns {boolean}
 */
export function isValidAcceptedRiskRecord(risk) {
  if (!risk || typeof risk !== "object") return false;
  const hasScopeOrRelease =
    (typeof risk.release === "string" && risk.release.length > 0) ||
    (typeof risk.scope === "string" && risk.scope.length > 0);
  const hasExpiryOrFollowUp =
    (typeof risk.expiry === "string" && risk.expiry.length > 0) ||
    (typeof risk.followUp === "string" && risk.followUp.length > 0);
  return (
    typeof risk.riskId === "string" &&
    risk.riskId.length > 0 &&
    typeof risk.approvedBy === "string" &&
    risk.approvedBy.length > 0 &&
    typeof risk.decision === "string" &&
    risk.decision.length > 0 &&
    hasScopeOrRelease &&
    hasExpiryOrFollowUp
  );
}

/**
 * @param {AcceptedRisk} risk
 * @returns {boolean}
 */
export function isNonAcceptableRiskCategory(risk) {
  const category = String(risk?.category ?? "")
    .trim()
    .toLowerCase();
  return NON_ACCEPTABLE_RISK_CATEGORIES.includes(category);
}

/**
 * @param {CapabilityRow[]} matrix
 * @returns {CapabilityRow[]}
 */
export function listBlockingMandatoryRows(matrix) {
  return (matrix ?? []).filter((row) => isBlockingMandatoryRow(row));
}

/**
 * Known mandatory downgrade: broken payment-hold outbox.
 * @param {CapabilityRow[]} matrix
 * @returns {CapabilityRow | undefined}
 */
export function findBrokenPaymentHoldRow(matrix) {
  return (matrix ?? []).find((row) => {
    if (row.mandatory !== "mandatory") return false;
    const status = normalizeCapabilityStatus(row.status);
    if (status !== "broken") return false;
    const id = String(row.id ?? "").toLowerCase();
    return id.includes("payment-hold") || id.includes("b1");
  });
}

/**
 * @param {CapabilityRow[]} matrix
 * @returns {CapabilityRow | undefined}
 */
export function findMissingMandatoryProducerRow(matrix) {
  return (matrix ?? []).find((row) => {
    if (row.mandatory !== "mandatory") return false;
    const status = normalizeCapabilityStatus(row.status);
    return status === "missing" || status === "producer-missing";
  });
}

/**
 * @param {{
 *   matrix: CapabilityRow[];
 *   proposedVerdict: string;
 *   acceptedRisks?: AcceptedRisk[];
 * }} input
 * @returns {{ allowed: boolean; normalizedVerdict: string; reasons: string[] }}
 */
export function evaluateFdaVerdict(input) {
  const normalizedVerdict = normalizeVerdict(input.proposedVerdict);
  const reasons = [];
  const matrix = input.matrix ?? [];
  const acceptedRisks = input.acceptedRisks ?? [];
  const blocking = listBlockingMandatoryRows(matrix);

  if (normalizedVerdict === "COMPLETE") {
    if (blocking.length > 0) {
      reasons.push(
        `COMPLETE forbidden: ${blocking.length} mandatory row(s) blocking — ${blocking.map((r) => `${r.id}:${r.status}`).join(", ")}`,
      );
    }
  }

  if (normalizedVerdict === "COMPLETE_WITH_ACCEPTED_RISKS") {
    if (blocking.length > 0) {
      reasons.push(
        `COMPLETE_WITH_ACCEPTED_RISKS forbidden while mandatory rows block: ${blocking.map((r) => `${r.id}:${r.status}`).join(", ")}`,
      );
    }
    for (const risk of acceptedRisks) {
      if (!isValidAcceptedRiskRecord(risk)) {
        reasons.push(`accepted risk ${risk?.riskId ?? "?"} missing required approval fields`);
      }
      if (isNonAcceptableRiskCategory(risk)) {
        reasons.push(
          `accepted risk ${risk.riskId} category "${risk.category}" is never allowed`,
        );
      }
    }
    if (acceptedRisks.length === 0 && blocking.length > 0) {
      reasons.push("COMPLETE_WITH_ACCEPTED_RISKS requires explicit acceptedRisks[] records");
    }
  }

  const brokenPaymentHold = findBrokenPaymentHoldRow(matrix);
  if (
    brokenPaymentHold &&
    (normalizedVerdict === "COMPLETE" || normalizedVerdict === "COMPLETE_WITH_ACCEPTED_RISKS")
  ) {
    reasons.push(
      `known BROKEN payment-hold outbox (${brokenPaymentHold.id}) requires INCOMPLETE or BLOCKED, not ${normalizedVerdict}`,
    );
  }

  const missingProducer = findMissingMandatoryProducerRow(matrix);
  if (
    missingProducer &&
    (normalizedVerdict === "COMPLETE" || normalizedVerdict === "COMPLETE_WITH_ACCEPTED_RISKS")
  ) {
    reasons.push(
      `MISSING mandatory producer (${missingProducer.id}) requires INCOMPLETE, not ${normalizedVerdict}`,
    );
  }

  return {
    allowed: reasons.length === 0,
    normalizedVerdict,
    reasons,
  };
}

/**
 * Assert evaluator outcome — throws on mismatch (for regression fixture).
 * @param {Parameters<typeof evaluateFdaVerdict>[0] & { expectAllowed: boolean; caseId?: string }} input
 */
export function assertVerdictEvaluation(input) {
  const result = evaluateFdaVerdict(input);
  const label = input.caseId ?? "case";
  if (result.allowed !== input.expectAllowed) {
    throw new Error(
      `${label}: expected allowed=${input.expectAllowed} got allowed=${result.allowed}; reasons=${result.reasons.join("; ") || "(none)"}`,
    );
  }
}
