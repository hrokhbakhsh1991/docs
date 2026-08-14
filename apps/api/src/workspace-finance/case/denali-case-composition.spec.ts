/**
 * PR11-C — Denali reconciliation + payment capability composition proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  executeFinanceCase,
  projectCaseEncounter,
  type CaseFactReadScope,
} from "@app-tour/finance-core/case";

import type { DenaliCaseReadSourcePort } from "../case-read/denali-case-read-source.port.ts";
import {
  composeDenaliCaseFactProviders,
  resolveDenaliCaseCapabilityFromEnv,
  FINANCE_CASE_PAYMENT_MODE_ENV,
  FINANCE_CASE_RECONCILIATION_ENABLED_ENV,
} from "./compose-denali-case-providers.ts";
import { createDenaliCaseFactProviders } from "./create-denali-case-providers.ts";
import { InMemoryPaymentGateway } from "./payment-capability/index.ts";
import {
  classifyPaymentReconciliation,
  type ReconClassifyInput,
  type ReconFindingCode,
} from "./reconciliation/index.ts";
import { loadEnrollmentCaseEncounter } from "./command-bridge/load-enrollment-encounter.ts";
import type { HostDenaliCaseReadDeps } from "./host-denali-case-read-source.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../..");

const SCOPE: CaseFactReadScope = {
  caseKey: "enrollment:comp-1:primary",
  subjectId: "comp-1",
  subjectKind: "enrollment",
  counterpartyId: "cp-comp",
};

function walkTs(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkTs(full, files);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function denaliSource(over?: {
  bookingPaymentStatus?: string;
  payments?: Array<{
    id: string;
    status: string;
    method: string;
    provider: string;
    amountMinor?: string;
  }>;
}): DenaliCaseReadSourcePort {
  return {
    async readObligation() {
      return {
        readStatus: "ok",
        currency: "IRR",
        obligationMinor: "10000",
        remainingMinor: "10000",
        collectionPolicy: "money_due",
      };
    },
    async readPayment() {
      return {
        readStatus: "ok",
        bookingPaymentStatus: over?.bookingPaymentStatus ?? "unpaid",
        payments: over?.payments ?? [
          {
            id: "pay-1",
            status: "Pending",
            method: "manual",
            provider: "offline",
            amountMinor: "10000",
          },
        ],
      };
    },
    async readEvidence() {
      return { readStatus: "ok", receipt: null };
    },
    async readLifecycle() {
      return {
        readStatus: "ok",
        bookingStatus: "approved",
        closedWithLeftoverArtifacts: false,
      };
    },
    async readLedger() {
      return { readStatus: "ok", ledgerRefsPresent: false, reconFinding: "none" };
    },
    async readSignal() {
      return { readStatus: "ok", attentionClass: null };
    },
  };
}

/** Taxonomy fixtures — Host observations only. */
const TAXONOMY_FIXTURES: Array<{
  readonly name: string;
  readonly input: ReconClassifyInput;
  readonly expect: ReconFindingCode;
}> = [
  {
    name: "GW_PAID_SOT_MISSING",
    input: {
      gateway: {
        read: "ok",
        paidLike: true,
        settlementPendingOrUnknown: false,
        amountMinor: "10000",
        evidencePresent: true,
      },
      finance: {
        read: "ok",
        paidLike: false,
        amountMinor: null,
        paymentRowCount: 0,
        evidenceCount: 0,
      },
    },
    expect: "GW_PAID_SOT_MISSING",
  },
  {
    name: "SOT_PAID_GW_UNKNOWN",
    input: {
      gateway: {
        read: "degraded",
        paidLike: false,
        settlementPendingOrUnknown: false,
        amountMinor: null,
        evidencePresent: false,
      },
      finance: {
        read: "ok",
        paidLike: true,
        amountMinor: "10000",
        paymentRowCount: 1,
        evidenceCount: 0,
      },
    },
    expect: "SOT_PAID_GW_UNKNOWN",
  },
  {
    name: "AMOUNT_MISMATCH",
    input: {
      gateway: {
        read: "ok",
        paidLike: true,
        settlementPendingOrUnknown: false,
        amountMinor: "10000",
        evidencePresent: false,
      },
      finance: {
        read: "ok",
        paidLike: true,
        amountMinor: "8000",
        paymentRowCount: 1,
        evidenceCount: 0,
      },
    },
    expect: "AMOUNT_MISMATCH",
  },
  {
    name: "DUPLICATE_PAYMENT_EVIDENCE",
    input: {
      gateway: {
        read: "ok",
        paidLike: false,
        settlementPendingOrUnknown: true,
        amountMinor: null,
        evidencePresent: true,
      },
      finance: {
        read: "ok",
        paidLike: false,
        amountMinor: "10000",
        paymentRowCount: 1,
        evidenceCount: 1,
      },
    },
    expect: "DUPLICATE_PAYMENT_EVIDENCE",
  },
  {
    name: "PROVIDER_DEGRADED",
    input: {
      gateway: {
        read: "degraded",
        paidLike: false,
        settlementPendingOrUnknown: false,
        amountMinor: null,
        evidencePresent: false,
      },
      finance: {
        read: "ok",
        paidLike: false,
        amountMinor: "10000",
        paymentRowCount: 1,
        evidenceCount: 0,
      },
    },
    expect: "PROVIDER_DEGRADED",
  },
];

describe("PR11-C Denali case composition", () => {
  it("1 — Manual default composition matches legacy Denali providers", async () => {
    const source = denaliSource();
    const legacy = createDenaliCaseFactProviders(source, { includeLedger: true });
    const composed = composeDenaliCaseFactProviders({
      source,
      capability: { paymentMode: "manual" },
    });
    const a = await executeFinanceCase(legacy, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "legacy",
    });
    const b = await executeFinanceCase(composed, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "composed",
    });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
  });

  it("2 — Online + gateway + recon emits portable cues into snapshot", async () => {
    const source = denaliSource({ bookingPaymentStatus: "unpaid", payments: [] });
    const gateway = new InMemoryPaymentGateway();
    gateway.put({
      subjectId: SCOPE.subjectId,
      subjectKind: SCOPE.subjectKind,
      externalPaymentRef: "pi_comp_secret",
      lifecycle: "intent_succeeded",
      settlement: "settled",
      evidence: "present",
      amountMinor: "10000",
    });
    const providers = composeDenaliCaseFactProviders({
      source,
      capability: {
        paymentMode: "online",
        gateway,
        reconciliationEnabled: true,
      },
    });
    const out = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "online-recon",
    });
    assert.equal(out.snapshot.facts.auditCues.reconFinding.kind, "known");
    if (out.snapshot.facts.auditCues.reconFinding.kind === "known") {
      assert.equal(out.snapshot.facts.auditCues.reconFinding.value, "mismatch");
    }
    assert.doesNotMatch(JSON.stringify(out.snapshot), /pi_comp_secret/);
    const encounter = projectCaseEncounter(out.caseOutput, {
      discoveryAttention: out.snapshot.encounter.attention ?? null,
    });
    assert.equal(typeof encounter.explainability.headline, "string");
    assert.equal(encounter.subjectId, SCOPE.subjectId);
  });

  it("3 — Gateway outage degrades safely (unknown, not unpaid coercion)", async () => {
    const source = denaliSource({
      bookingPaymentStatus: "paid",
      payments: [
        {
          id: "pay-paid",
          status: "Paid",
          method: "gateway",
          provider: "online",
          amountMinor: "10000",
        },
      ],
    });
    const gateway = new InMemoryPaymentGateway();
    gateway.simulateOutage({ ok: false, reason: "unavailable" });
    const providers = composeDenaliCaseFactProviders({
      source,
      capability: {
        paymentMode: "online",
        gateway,
        reconciliationEnabled: true,
      },
    });
    const out = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: "outage",
    });
    // Online payment provider returns unknown on outage — not known unpaid.
    assert.equal(out.snapshot.facts.settlement.settlementMeaning.kind, "unknown");
    assert.equal(
      out.snapshot.encounter.attention?.attentionClass,
      "reconciliation_attention"
    );
  });

  it("4 — Env resolution defaults keep manual functional", () => {
    const cap = resolveDenaliCaseCapabilityFromEnv({});
    assert.equal(cap.paymentMode, "manual");
    assert.equal(cap.reconciliationEnabled, undefined);

    const online = resolveDenaliCaseCapabilityFromEnv({
      [FINANCE_CASE_PAYMENT_MODE_ENV]: "online",
      [FINANCE_CASE_RECONCILIATION_ENABLED_ENV]: "1",
    });
    assert.equal(online.paymentMode, "online");
    assert.equal(online.reconciliationEnabled, true);
  });

  it("5 — Taxonomy fixtures classify expected findings", () => {
    for (const fixture of TAXONOMY_FIXTURES) {
      const result = classifyPaymentReconciliation(fixture.input);
      assert.equal(
        result.findings.includes(fixture.expect),
        true,
        `${fixture.name} missing in ${result.findings.join(",")}`
      );
    }
  });

  it("6 — Signal attention cannot change verdict under composed providers", async () => {
    const source = denaliSource();
    const providers = composeDenaliCaseFactProviders({
      source,
      capability: { paymentMode: "manual" },
    });
    const a = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      includeSignal: true,
      executionId: "sig-a",
    });
    const b = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "attention",
      includeSignal: true,
      executionId: "sig-b",
    });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
  });

  it("7 — Composition modules do not write SoTs", () => {
    const files = [
      join(HERE, "compose-denali-case-providers.ts"),
      ...walkTs(join(HERE, "reconciliation")).filter((f) => !f.endsWith(".spec.ts")),
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /prisma\.(payment|receipt|booking)/i);
      assert.doesNotMatch(src, /FinanceService\.(create|update|review|capture|refund)/);
    }
  });

  it("8 — finance-core does not import Denali composition / recon", () => {
    const caseRoot = join(REPO_ROOT, "packages/finance-core/src");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /composeDenaliCaseFactProviders|DenaliCaseCapabilityConfig|FINANCE_CASE_PAYMENT_MODE|GW_PAID_SOT_MISSING/
      );
    }
  });

  it("9 — EncounterView load path accepts capability override", async () => {
    const deps: HostDenaliCaseReadDeps = {
      tenantId: "t-comp",
      bookings: {
        async getById() {
          return {
            id: "comp-1",
            tenantId: "t-comp",
            tourId: "tour-1",
            tourTitle: "Tour",
            guestLabel: "Guest",
            guestEmail: null,
            guestPhone: null,
            partySize: 1,
            status: "approved",
            paymentStatus: "unpaid",
            departureAt: "2026-09-01T00:00:00.000Z",
            submittedAt: "2026-08-01T00:00:00.000Z",
            submittedByUserId: "cp-comp",
            approvedAt: "2026-08-02T00:00:00.000Z",
          };
        },
      },
      obligation: {
        async resolveRegistrationObligation() {
          return {
            currency: "IRR",
            obligationMinor: "10000",
            source: "tour_canonical" as const,
          };
        },
        async resolveRegistrationPaymentCollection() {
          return "offline" as const;
        },
      },
      finance: {
        async findLatestReceiptForRegistration() {
          return null;
        },
        async getRegistrationInvoiceFacts() {
          return {
            prepaymentMinor: "0",
            paidPaymentsMinor: "0",
            paymentAmountsMinor: [] as string[],
            currency: "IRR",
          };
        },
        async findPaymentStatusesByRegistration() {
          return [] as string[];
        },
        async findFirstPendingManualPayment() {
          return null;
        },
        async listPendingReceipts() {
      return { rows: [], nextCursor: null, hasMore: false };
    },
        async listLedgerEvents() {
          return [];
        },
        async listPaymentsForRegistration() {
          return [];
        },
      },
    };

    const { tenantId, ...readDeps } = deps;
    const result = await loadEnrollmentCaseEncounter({
      tenantId,
      registrationId: "comp-1",
      counterpartyId: "cp-comp",
      readDeps,
      capability: { paymentMode: "manual" },
      executionId: "enc-load-1",
    });
    assert.equal(result.encounter.subjectId, "comp-1");
    assert.equal(typeof result.encounter.explainability.headline, "string");
    assert.equal(typeof result.caseOutput.reading, "string");
  });
});
