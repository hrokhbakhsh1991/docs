#!/usr/bin/env node
/**
 * FDA-001 v1.3 regression fixture — completion verdict gating.
 * @see docs/dev/feature-delivery/completion-rules-regression-fixture.mdoc
 */
import assert from "node:assert/strict";
import {
  assertVerdictEvaluation,
  evaluateFdaVerdict,
  listBlockingMandatoryRows,
  normalizeCapabilityStatus,
} from "./evaluate-fda-verdict.mjs";

const validApproval = {
  riskId: "OPT-001-deferred-polish",
  approvedBy: "architect@example.com",
  decision: "defer non-critical polish to next sprint",
  release: "vNext",
  expiry: "2026-10-01",
  category: "optional-polish",
  mandatory: false,
};

/** @type {Array<{ caseId: string; input: Parameters<typeof assertVerdictEvaluation>[0] }>} */
const FIXTURE_CASES = [
  {
    caseId: "CRF-001",
    input: {
      caseId: "CRF-001",
      expectAllowed: false,
      proposedVerdict: "COMPLETE",
      matrix: [
        {
          id: "B1-payment-hold-outbox",
          mandatory: "mandatory",
          status: "broken",
          category: "data-durability",
        },
        { id: "J4-wallet", mandatory: "mandatory", status: "complete" },
      ],
    },
  },
  {
    caseId: "CRF-002",
    input: {
      caseId: "CRF-002",
      expectAllowed: false,
      proposedVerdict: "COMPLETE_WITH_ACCEPTED_RISKS",
      acceptedRisks: [validApproval],
      matrix: [
        {
          id: "B1-payment-hold-outbox",
          mandatory: "mandatory",
          status: "broken",
          category: "data-durability",
        },
      ],
    },
  },
  {
    caseId: "CRF-003",
    input: {
      caseId: "CRF-003",
      expectAllowed: false,
      proposedVerdict: "COMPLETE",
      matrix: [
        {
          id: "registration.rejected-producer",
          mandatory: "mandatory",
          status: "missing",
          category: "mandatory-event-producer",
        },
      ],
    },
  },
  {
    caseId: "CRF-004",
    input: {
      caseId: "CRF-004",
      expectAllowed: false,
      proposedVerdict: "SHARED_NOTIFICATION_AUDIT_COMPLETE",
      matrix: [
        {
          id: "J1-ticket-browser",
          mandatory: "mandatory",
          status: "unverified",
        },
      ],
    },
  },
  {
    caseId: "CRF-005",
    input: {
      caseId: "CRF-005",
      expectAllowed: false,
      proposedVerdict: "COMPLETE_WITH_ACCEPTED_RISKS",
      acceptedRisks: [validApproval],
      matrix: [
        {
          id: "portal-inbox-rtl",
          mandatory: "mandatory",
          status: "browser-unverified",
        },
      ],
    },
  },
  {
    caseId: "CRF-006",
    input: {
      caseId: "CRF-006",
      expectAllowed: false,
      proposedVerdict: "COMPLETE_WITH_ACCEPTED_RISKS",
      acceptedRisks: [
        {
          riskId: "RLS-001",
          approvedBy: "architect@example.com",
          decision: "accept without postgres proof",
          release: "staging",
          expiry: "2026-10-01",
          category: "rls",
        },
      ],
      matrix: [
        {
          id: "tenant-isolation",
          mandatory: "mandatory",
          status: "rls/security unverified",
        },
      ],
    },
  },
  {
    caseId: "CRF-007",
    input: {
      caseId: "CRF-007",
      expectAllowed: true,
      proposedVerdict: "COMPLETE",
      matrix: [
        { id: "outbox-relay", mandatory: "mandatory", status: "complete" },
        { id: "member-inbox-api", mandatory: "mandatory", status: "complete" },
        { id: "optional-admin-polish", mandatory: "optional", status: "partial" },
      ],
    },
  },
  {
    caseId: "CRF-008",
    input: {
      caseId: "CRF-008",
      expectAllowed: true,
      proposedVerdict: "COMPLETE_WITH_ACCEPTED_RISKS",
      acceptedRisks: [validApproval],
      matrix: [
        { id: "core-api", mandatory: "mandatory", status: "complete" },
        { id: "optional-polish", mandatory: "optional", status: "partial" },
      ],
    },
  },
  {
    caseId: "CRF-009",
    input: {
      caseId: "CRF-009",
      expectAllowed: true,
      proposedVerdict: "INCOMPLETE",
      matrix: [
        {
          id: "B1-payment-hold-outbox",
          mandatory: "mandatory",
          status: "broken",
        },
      ],
    },
  },
  {
    caseId: "CRF-010",
    input: {
      caseId: "CRF-010",
      expectAllowed: true,
      proposedVerdict: "SHARED_NOTIFICATION_AUDIT_INCOMPLETE",
      matrix: [
        {
          id: "attendance.marked-producer",
          mandatory: "mandatory",
          status: "producer-missing",
        },
      ],
    },
  },
];

let passed = 0;
for (const { caseId, input } of FIXTURE_CASES) {
  assertVerdictEvaluation(input);
  passed += 1;
  console.log(`PASS ${caseId}`);
}

assert.equal(
  listBlockingMandatoryRows([
    { id: "x", mandatory: "mandatory", status: "BROKEN" },
  ]).length,
  1,
  "normalizeCapabilityStatus must treat BROKEN as blocking",
);
assert.equal(normalizeCapabilityStatus(" browser-unverified "), "browser-unverified");

const rejectCompleteOnBroken = evaluateFdaVerdict({
  proposedVerdict: "COMPLETE",
  matrix: [{ id: "cap", mandatory: "mandatory", status: "broken" }],
});
assert.equal(rejectCompleteOnBroken.allowed, false);

console.log(`\nFDA completion-rules regression: ${passed}/${FIXTURE_CASES.length} cases PASS`);
