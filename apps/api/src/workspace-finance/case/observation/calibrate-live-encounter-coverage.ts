/**
 * PR15-D — Live Encounter fact-coverage calibration (report-only).
 * Run: cd apps/api && node --import tsx --env-file=.env --env-file=.env.local \
 *   src/workspace-finance/case/observation/calibrate-live-encounter-coverage.ts
 *
 * Does not enable shadow, expand pilot, or mutate the finance workflow.
 */
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { executeFinanceCase } from "@app-tour/finance-core/case";

import {
  composeDenaliCaseFactProviders,
  resolveDenaliCaseCapabilityFromEnv,
} from "../compose-denali-case-providers";
import { buildLiveDenaliCaseReadDepsForTenant } from "../encounter/build-live-denali-case-read-deps";
import {
  buildEnrollmentCaseScope,
  HostDenaliCaseReadSource,
} from "../host-denali-case-read-source";
import {
  buildEncounterFactCoverageDiagnostic,
  classifyIncompleteCause,
  type CoverageCauseBucket,
  type EncounterFactCoverageDiagnostic,
} from "./fact-coverage-diagnostics";

const PILOT_TENANT =
  process.env.FINANCE_CASE_ENCOUNTER_PILOT_TENANTS?.split(",")[0]?.trim() ||
  "00000000-0000-4000-8000-000000000003";

type SampleKind =
  | "paid"
  | "pending_payment"
  | "receipt_submitted"
  | "receipt_approved"
  | "receipt_rejected"
  | "edge_cancelled"
  | "edge_waitlisted";

type SamplePlan = {
  readonly kind: SampleKind;
  readonly registrationId: string;
  readonly note: string;
};

async function loadSamplesFromApi(): Promise<SamplePlan[]> {
  // Prefer env OVERRIDE list; else use known matrix + recent smoke ids from prior PR15 runs.
  const fromEnv = process.env.PR15D_SAMPLE_REGS?.trim();
  if (fromEnv) {
    return fromEnv.split(",").map((id, i) => ({
      kind: "pending_payment" as const,
      registrationId: id.trim(),
      note: `env sample ${i + 1}`,
    }));
  }

  return [
    {
      kind: "receipt_submitted",
      registrationId: "00000000-0000-4000-8000-000000000529",
      note: "matrix pending receipt (Aida)",
    },
    {
      kind: "paid",
      registrationId: "b0142f15-a09b-4e5a-9dd7-9ed701b60dc0",
      note: "Fresh Create Member paid",
    },
    {
      kind: "paid",
      registrationId: "00000000-0000-4000-8000-000000000544",
      note: "matrix paid Babak",
    },
    {
      kind: "receipt_approved",
      registrationId: "00000000-0000-4000-8000-000000000527",
      note: "PR15-B approve target (Roya) — may be paid after review",
    },
    {
      kind: "receipt_rejected",
      registrationId: "00000000-0000-4000-8000-000000000528",
      note: "PR15-B reject target (Pedram)",
    },
    {
      kind: "pending_payment",
      registrationId: "00000000-0000-4000-8000-000000000536",
      note: "approved unpaid with pending manual payment",
    },
    {
      kind: "edge_cancelled",
      registrationId: "00000000-0000-4000-8000-000000000550",
      note: "cancelled unpaid",
    },
    {
      kind: "edge_waitlisted",
      registrationId: "8d1b3275-9e3e-4e69-8eb1-05c615b721ea",
      note: "waitlisted Dup Probe",
    },
    {
      kind: "receipt_submitted",
      registrationId: "00000000-0000-4000-8000-000000000523",
      note: "PR15-C classic approve while pilot",
    },
  ];
}

async function diagnoseRegistration(
  registrationId: string,
  counterpartyId: string
): Promise<EncounterFactCoverageDiagnostic | { error: string }> {
  try {
    const readDeps = await buildLiveDenaliCaseReadDepsForTenant(PILOT_TENANT);
    const booking = await readDeps.bookings.getById(registrationId, PILOT_TENANT);
    if (booking === null) {
      return { error: "booking_not_found" };
    }
    const source = new HostDenaliCaseReadSource({
      tenantId: PILOT_TENANT,
      ...readDeps,
    });
    const capability = resolveDenaliCaseCapabilityFromEnv(process.env);
    const providers = composeDenaliCaseFactProviders({ source, capability });
    const scope = buildEnrollmentCaseScope({
      registrationId,
      counterpartyId: counterpartyId || booking.submittedByUserId || "unknown",
    });
    const executed = await executeFinanceCase(providers, {
      scope,
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: randomUUID(),
    });
    return buildEncounterFactCoverageDiagnostic({
      registrationId,
      executionId: executed.diagnostics.executionId,
      snapshot: executed.snapshot,
      caseOutput: executed.caseOutput,
      degradedProviders: executed.diagnostics.degradedProviders ?? [],
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function summarize(diagnostics: EncounterFactCoverageDiagnostic[]) {
  const byCause: Record<CoverageCauseBucket, number> = {
    obligation_unread: 0,
    eligibility_unknown: 0,
    evidence_gap: 0,
    payment_gap: 0,
    lifecycle_closed_ambiguity: 0,
    optional_ledger_signal: 0,
    other: 0,
  };
  const reasonCounts: Record<string, number> = {};
  const unknownReasonCounts: Record<string, number> = {};
  let incomplete = 0;
  for (const d of diagnostics) {
    if (d.reading === "INCOMPLETE_INSPECT" || d.completenessClass === "inspect_forced") {
      incomplete += 1;
      byCause[classifyIncompleteCause(d)] += 1;
    }
    for (const r of d.completeness.inferredReasons) {
      reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
    }
    for (const f of d.requiredUnknown) {
      const key = `${f.path}:${f.reason ?? f.kind}`;
      unknownReasonCounts[key] = (unknownReasonCounts[key] ?? 0) + 1;
    }
  }
  return {
    sampleCount: diagnostics.length,
    incompleteCount: incomplete,
    incompletePct:
      diagnostics.length === 0 ? 0 : Math.round((incomplete / diagnostics.length) * 100),
    byCause,
    reasonCounts,
    unknownReasonCounts,
  };
}

async function main(): Promise<void> {
  const plans = await loadSamplesFromApi();
  const rows: Array<{
    plan: SamplePlan;
    diagnostic: EncounterFactCoverageDiagnostic | { error: string };
    cause?: CoverageCauseBucket;
  }> = [];

  for (const plan of plans) {
    const diagnostic = await diagnoseRegistration(plan.registrationId, "calibration");
    const cause =
      "error" in diagnostic ? undefined : classifyIncompleteCause(diagnostic);
    rows.push({ plan, diagnostic, cause });
    if ("error" in diagnostic) {
      process.stdout.write(`[ERR] ${plan.kind} ${plan.registrationId}: ${diagnostic.error}\n`);
    } else {
      process.stdout.write(
        `[${diagnostic.reading}] ${plan.kind} ${plan.registrationId} class=${diagnostic.completenessClass} reasons=${diagnostic.completeness.inferredReasons.join(",") || "-"} cause=${cause} unknownRequired=${diagnostic.requiredUnknown.length}\n`
      );
    }
  }

  const okDiagnostics = rows
    .map((r) => r.diagnostic)
    .filter((d): d is EncounterFactCoverageDiagnostic => !("error" in d));
  const summary = summarize(okDiagnostics);

  const report = {
    generatedAt: new Date().toISOString(),
    pilotTenant: PILOT_TENANT,
    paymentMode: process.env.FINANCE_CASE_PAYMENT_MODE ?? "manual(default)",
    shadowEnabled: process.env.FINANCE_CASE_SHADOW_ENABLED ?? "unset",
    summary,
    samples: rows.map((r) => {
      if ("error" in r.diagnostic) {
        return { plan: r.plan, error: r.diagnostic.error };
      }
      const d = r.diagnostic;
      return {
        plan: r.plan,
        cause: r.cause,
        reading: d.reading,
        completenessClass: d.completenessClass,
        primaryPosture: d.primaryPosture,
        decisionReady: d.decisionReady,
        inferredReasons: d.completeness.inferredReasons,
        degradedProviders: d.degradedProviders,
        requiredUnknown: d.requiredUnknown.map((f) => ({
          path: f.path,
          provider: f.provider,
          reason: f.reason,
        })),
        requiredAbsent: d.requiredAbsent.map((f) => ({
          path: f.path,
          provider: f.provider,
        })),
        optionalGaps: d.optionalGaps.map((f) => ({
          path: f.path,
          provider: f.provider,
          kind: f.kind,
          reason: f.reason,
        })),
        coverage: d.coverage,
        semanticNote: d.semanticNote,
        fieldKnownCounts: d.fields.reduce(
          (acc, f) => {
            acc[f.kind] = (acc[f.kind] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      };
    }),
  };

  const outPath = process.env.PR15D_OUT ?? "/tmp/pr15d-coverage-calibration.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  process.stdout.write(`\nWrote ${outPath}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
