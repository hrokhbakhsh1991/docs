/**
 * Host Denali Case-read providers — translation façades over injectable SoT.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  CaseFactReadScope,
  DenaliEvidenceSource,
  DenaliLedgerSource,
  DenaliLifecycleSource,
  DenaliObligationSource,
  DenaliPaymentSource,
  DenaliSignalSource,
} from "@app-tour/workspace-denali/host/finance/case-read";

import type { DenaliCaseReadSourcePort } from "./denali-case-read-source.port.ts";
import { DenaliEvidenceFactProvider } from "./denali-evidence-fact.provider.ts";
import { DenaliLedgerFactProvider } from "./denali-ledger-fact.provider.ts";
import { DenaliLifecycleFactProvider } from "./denali-lifecycle-fact.provider.ts";
import { DenaliObligationFactProvider } from "./denali-obligation-fact.provider.ts";
import { DenaliPaymentFactProvider } from "./denali-payment-fact.provider.ts";
import { DenaliSignalFactProvider } from "./denali-signal-fact.provider.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCOPE: CaseFactReadScope = {
  caseKey: "enrollment:subj-1:primary",
  subjectId: "subj-1",
  subjectKind: "enrollment",
  counterpartyId: "cp-1",
};

function createSource(seed: {
  obligation?: DenaliObligationSource;
  payment?: DenaliPaymentSource;
  evidence?: DenaliEvidenceSource;
  lifecycle?: DenaliLifecycleSource;
  ledger?: DenaliLedgerSource;
  signal?: DenaliSignalSource;
  throwOn?: keyof DenaliCaseReadSourcePort;
}): DenaliCaseReadSourcePort {
  const fail = (name: keyof DenaliCaseReadSourcePort) => {
    if (seed.throwOn === name) {
      throw new Error("simulated_read_failure");
    }
  };
  return {
    async readObligation() {
      fail("readObligation");
      return seed.obligation ?? { readStatus: "missing" };
    },
    async readPayment() {
      fail("readPayment");
      return seed.payment ?? { readStatus: "missing" };
    },
    async readEvidence() {
      fail("readEvidence");
      return seed.evidence ?? { readStatus: "ok", receipt: null };
    },
    async readLifecycle() {
      fail("readLifecycle");
      return seed.lifecycle ?? { readStatus: "missing" };
    },
    async readLedger() {
      fail("readLedger");
      return seed.ledger ?? { readStatus: "ok", ledgerRefsPresent: false, reconFinding: "none" };
    },
    async readSignal() {
      fail("readSignal");
      return seed.signal ?? { readStatus: "ok", attentionClass: null };
    },
  };
}

describe("denali case-read host providers", () => {
  it("maps obligation remaining unread as unknown (not zero)", async () => {
    const provider = new DenaliObligationFactProvider(
      createSource({
        obligation: {
          readStatus: "ok",
          collectionMode: "offline",
          obligationMinor: "9000",
          remainingMinor: null,
          currency: "IRR",
        },
      })
    );
    const result = await provider.readMoneyFacts(SCOPE);
    assert.equal(result.ok, true);
    assert.equal(result.value.amountDue.kind, "known");
    assert.equal(result.value.remaining.kind, "unknown");
  });

  it("maps missing receipt as absent", async () => {
    const provider = new DenaliEvidenceFactProvider(
      createSource({ evidence: { readStatus: "ok", receipt: null } })
    );
    const result = await provider.readEvidenceFacts(SCOPE);
    assert.equal(result.ok, true);
    assert.equal(result.value.proofExists.kind, "absent");
  });

  it("maps thrown SoT read as degraded unknown", async () => {
    const provider = new DenaliPaymentFactProvider(
      createSource({ throwOn: "readPayment" })
    );
    const result = await provider.readPaymentFacts(SCOPE);
    assert.equal(result.ok, false);
    assert.equal(result.degraded, true);
    assert.equal(result.value.intent.intentSet.kind, "unknown");
  });

  it("maps closed leftovers as cues only", async () => {
    const provider = new DenaliLifecycleFactProvider(
      createSource({
        lifecycle: {
          readStatus: "ok",
          bookingStatus: "rejected",
          leftoverArtifactsProven: true,
        },
      })
    );
    const result = await provider.readLifecycleFacts(SCOPE);
    assert.equal(result.ok, true);
    assert.equal(result.value.eligibility.lifecycleEligibility.value, "closed");
    assert.equal(result.value.exceptionCues.closedWithLeftoverArtifacts.value, true);
  });

  it("ledger optional unsupported when reader omitted", async () => {
    const provider = new DenaliLedgerFactProvider({});
    const result = await provider.readAuditCues(SCOPE);
    assert.equal(result.ok, false);
    assert.equal(result.failureReason, "unsupported");
    assert.equal(result.value.ledgerRefsPresent.kind, "unknown");
  });

  it("signal returns attention only", async () => {
    const provider = new DenaliSignalFactProvider(
      createSource({
        signal: { readStatus: "ok", attentionClass: "pending_receipt_review" },
      })
    );
    const result = await provider.readAttention(SCOPE);
    assert.equal(result.ok, true);
    assert.equal(result.value.attention?.attentionClass, "pending_receipt_review");
  });
});

describe("denali case-read host isolation", () => {
  it("providers do not import CaseOutput / interpret / rules", () => {
    for (const name of readdirSync(HERE)) {
      if (!name.endsWith(".ts") || name.endsWith(".spec.ts")) continue;
      const src = readFileSync(join(HERE, name), "utf8");
      assert.doesNotMatch(src, /CaseOutput|interpretFinanceCase|case\/rules|case\/interpret/);
      assert.doesNotMatch(src, /createManualPayment|approveManualReceipt|repair/);
    }
  });

  it("finance-core package.json has no Denali dependency", () => {
    const pkg = readFileSync(
      resolve(HERE, "../../../../../packages/finance-core/package.json"),
      "utf8"
    );
    assert.doesNotMatch(pkg, /workspace-denali|workspaces\/denali/);
  });
});
