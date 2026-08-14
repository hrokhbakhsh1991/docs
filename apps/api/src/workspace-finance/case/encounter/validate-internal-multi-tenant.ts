/**
 * PR16-A — Live internal multi-tenant Encounter validation (report-only).
 * MODE=internal allowlist; shadow=false; no SoT mutation.
 *
 * Run:
 *   cd apps/api && \
 *   FINANCE_CASE_ENCOUNTER_MODE=internal \
 *   FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003,00000000-0000-4000-8000-000000000014 \
 *   FINANCE_CASE_SHADOW_ENABLED=false \
 *   PR16A_OUT=/tmp/pr16a-internal-validation.json \
 *   node --import tsx --env-file=.env --env-file=.env.local \
 *     src/workspace-finance/case/encounter/validate-internal-multi-tenant.ts
 */
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { executeFinanceCase } from "@app-tour/finance-core/case";

import {
  composeDenaliCaseFactProviders,
  resolveDenaliCaseCapabilityFromEnv,
} from "../compose-denali-case-providers";
import { isFinanceCaseShadowEnabled } from "../finance-case-feature-flag";
import {
  buildEnrollmentCaseScope,
  HostDenaliCaseReadSource,
} from "../host-denali-case-read-source";
import { buildLiveDenaliCaseReadDepsForTenant } from "./build-live-denali-case-read-deps";
import {
  resolveEncounterInternalRolloutConfig,
} from "./encounter-internal-config";
import {
  buildEncounterInternalRolloutHealthReport,
  type EncounterVerdictSample,
} from "./encounter-internal-rollout-health";
import { resolveEncounterProductionDecision } from "./encounter-production-decision";
import { createInMemoryEncounterTelemetrySink } from "./encounter-telemetry";
import { buildProviderDegradationTelemetryEvent } from "./provider-degradation-telemetry";

const TENANT_NORMAL =
  process.env.PR16A_TENANT_NORMAL?.trim() || "00000000-0000-4000-8000-000000000003";
const TENANT_EDGE =
  process.env.PR16A_TENANT_EDGE?.trim() || "00000000-0000-4000-8000-000000000014";
const TENANT_EXCLUDED =
  process.env.PR16A_TENANT_EXCLUDED?.trim() || "00000000-0000-4000-8000-000000000004";

type TenantPlan = {
  readonly role: "normal" | "incomplete" | "payment_edge" | "excluded";
  readonly tenantId: string;
  readonly registrationId?: string;
};

async function pickRegistration(
  tenantId: string
): Promise<{ registrationId: string; note: string } | { error: string }> {
  try {
    const deps = await buildLiveDenaliCaseReadDepsForTenant(tenantId);
    // Prefer known matrix ids when on primary Denali tenant.
    const candidates =
      tenantId === TENANT_NORMAL
        ? [
            "00000000-0000-4000-8000-000000000529",
            "00000000-0000-4000-8000-000000000536",
            "00000000-0000-4000-8000-000000000523",
            "00000000-0000-4000-8000-000000000544",
          ]
        : [];
    for (const id of candidates) {
      const booking = await deps.bookings.getById(id, tenantId);
      if (booking !== null) {
        return { registrationId: id, note: "known_matrix" };
      }
    }
    return { error: "no_registration_found" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function runCaseSample(
  tenantId: string,
  registrationId: string
): Promise<EncounterVerdictSample | { error: string; crossTenantLeak?: boolean }> {
  try {
    const readDeps = await buildLiveDenaliCaseReadDepsForTenant(tenantId);
    const booking = await readDeps.bookings.getById(registrationId, tenantId);
    if (booking === null) {
      return { error: "booking_not_found" };
    }
    if (booking.tenantId !== tenantId) {
      return { error: "cross_tenant_booking", crossTenantLeak: true };
    }
    // Cross-tenant probe: bookings only (do not compose finance for excluded/urban tenants).
    const leaked = await readDeps.bookings.getById(registrationId, TENANT_EXCLUDED);
    if (leaked !== null && leaked.tenantId === tenantId) {
      return { error: "cross_tenant_read", crossTenantLeak: true };
    }

    const source = new HostDenaliCaseReadSource({ tenantId, ...readDeps });
    const providers = composeDenaliCaseFactProviders({
      source,
      capability: resolveDenaliCaseCapabilityFromEnv(process.env),
    });
    const executed = await executeFinanceCase(providers, {
      scope: buildEnrollmentCaseScope({
        registrationId,
        counterpartyId: booking.submittedByUserId || "unknown",
      }),
      mode: "lookup",
      includeLedger: true,
      includeSignal: true,
      executionId: randomUUID(),
    });
    const blob = JSON.stringify({
      reading: executed.caseOutput.reading,
      audit: executed.snapshot.facts.auditCues,
    });
    if (/pi_[A-Za-z0-9]{6,}/.test(blob)) {
      return { error: "gateway_leakage" };
    }

    return {
      tenantId,
      registrationId,
      reading: executed.caseOutput.reading,
      completenessClass: executed.caseOutput.completenessClass,
    };
  } catch (err) {
    if (err instanceof Error) {
      process.stderr.write(`[pr16a] runCaseSample ${err.message}\n`);
      return { error: err.message };
    }
    return { error: String(err) };
  }
}

async function main(): Promise<void> {
  const env = process.env;
  const cfg = resolveEncounterInternalRolloutConfig(env);
  const shadow = isFinanceCaseShadowEnabled(env);
  const sink = createInMemoryEncounterTelemetrySink();
  const meaningSamples: EncounterVerdictSample[] = [];
  const rows: unknown[] = [];

  const plans: TenantPlan[] = [
    { role: "normal", tenantId: TENANT_NORMAL },
    {
      role: "payment_edge",
      tenantId: TENANT_NORMAL,
      registrationId: "00000000-0000-4000-8000-000000000523",
    },
    {
      role: "incomplete",
      tenantId: TENANT_NORMAL,
      // Missing registration → incomplete / not_found path (no invented facts).
      registrationId: "00000000-0000-4000-8000-00000000dead",
    },
    { role: "incomplete", tenantId: TENANT_EDGE },
    { role: "excluded", tenantId: TENANT_EXCLUDED },
  ];

  for (const plan of plans) {
    const decision = resolveEncounterProductionDecision({
      tenantId: plan.tenantId,
      env,
    });
    if (plan.role === "excluded") {
      rows.push({
        plan,
        decision: { run: decision.run, reason: decision.reason, mode: decision.mode },
        expectZeroExecution: true,
        ok: decision.run === false,
      });
      sink.emit({
        kind: "http_request",
        tenantId: plan.tenantId,
        registrationId: "n/a",
        outcome: "disabled",
        durationMs: 1,
        featureEnabled: cfg.isInternalMode,
        rolloutMode: decision.mode,
        decisionReason: decision.reason,
        sampleDecision: "tenant_excluded",
        recordedAtMs: Date.now(),
      });
      continue;
    }

    if (!decision.run) {
      rows.push({
        plan,
        decision: { run: false, reason: decision.reason },
        error: "tenant_not_enabled_for_internal",
      });
      continue;
    }

    const picked =
      plan.registrationId !== undefined
        ? { registrationId: plan.registrationId, note: "explicit" }
        : await pickRegistration(plan.tenantId);
    if ("error" in picked) {
      rows.push({ plan, decision: { run: true }, pickError: picked.error });
      continue;
    }

    const started = Date.now();
    const sample = await runCaseSample(plan.tenantId, picked.registrationId);
    const durationMs = Date.now() - started;
    if ("error" in sample) {
      rows.push({ plan, registrationId: picked.registrationId, error: sample });
      sink.emit({
        kind: "http_request",
        tenantId: plan.tenantId,
        registrationId: picked.registrationId,
        outcome: "unavailable",
        durationMs,
        featureEnabled: true,
        rolloutMode: decision.mode,
        decisionReason: "enabled",
        sampleDecision: "run",
        recordedAtMs: Date.now(),
      });
      continue;
    }

    meaningSamples.push(sample);
    rows.push({ plan, pick: picked, sample, durationMs });
    sink.emit({
      kind: "http_request",
      tenantId: plan.tenantId,
      registrationId: sample.registrationId,
      outcome: "ok",
      durationMs,
      featureEnabled: true,
      rolloutMode: decision.mode,
      decisionReason: "enabled",
      sampleDecision: "run",
      recordedAtMs: Date.now(),
    });
    sink.emit({
      kind: "execution",
      tenantId: plan.tenantId,
      registrationId: sample.registrationId,
      executionId: randomUUID(),
      success: true,
      durationMs,
      providerDegraded: false,
      incompleteSnapshot: sample.completenessClass === "inspect_forced",
      timedOut: false,
      recordedAtMs: Date.now(),
    });
  }

  // Emit synthetic optional ledger degradation observation (accepted PR15-H).
  sink.emit(
    buildProviderDegradationTelemetryEvent({
      tenantId: TENANT_NORMAL,
      registrationId: "obs",
      provider: "ledger",
      failureReason: "unavailable",
      optional: true,
      recordedAtMs: Date.now(),
    })
  );

  const decision = resolveEncounterProductionDecision({
    tenantId: TENANT_NORMAL,
    env,
  });
  const report = buildEncounterInternalRolloutHealthReport({
    events: sink.events,
    decision,
    tenantId: TENANT_NORMAL,
    internalTenants: [...cfg.internalTenants],
    meaningSamples,
    minSamples: 1,
  });

  const allowlistedOk = rows.filter(
    (r) =>
      typeof r === "object" &&
      r !== null &&
      "sample" in r &&
      (r as { sample?: { reading?: string } }).sample?.reading !== undefined
  ).length;
  const excludedOk = rows.some(
    (r) =>
      typeof r === "object" &&
      r !== null &&
      "expectZeroExecution" in r &&
      (r as { ok?: boolean }).ok === true
  );
  const crossTenantLeak = rows.some(
    (r) =>
      typeof r === "object" &&
      r !== null &&
      "error" in r &&
      typeof (r as { error?: { crossTenantLeak?: boolean } }).error === "object" &&
      (r as { error?: { crossTenantLeak?: boolean } }).error?.crossTenantLeak === true
  );

  const recommendation =
    shadow || crossTenantLeak
      ? "HOLD"
      : !cfg.isInternalMode
        ? "CONTINUE_PILOT"
        : cfg.internalTenants.size >= 2 &&
            excludedOk &&
            allowlistedOk >= 1 &&
            report.meaningSummary.sampleCount >= 1
          ? "READY_FOR_INTERNAL"
          : "CONTINUE_PILOT";

  const out = {
    generatedAt: new Date().toISOString(),
    config: {
      mode: cfg.mode,
      isInternalMode: cfg.isInternalMode,
      internalTenants: [...cfg.internalTenants],
      emergencyDisabled: cfg.emergencyDisabled,
      shadowEnabled: shadow,
    },
    rows,
    report,
    recommendation,
    locks: {
      financeCoreUnchanged: true,
      commandUi: false,
      casePersistence: false,
    },
  };

  const outPath = process.env.PR16A_OUT ?? "/tmp/pr16a-internal-validation.json";
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  process.stdout.write(`${JSON.stringify({ recommendation, reportSummary: {
    availability: report.observationWindow.availabilityRate,
    verdicts: report.meaningSummary.verdictDistribution,
    completeness: report.meaningSummary.completenessDistribution,
    exceptionRate: report.meaningSummary.exceptionRate,
    authzFailureRate: report.observationWindow.authzFailureRate,
    ledgerDegradations: report.providerDegradationSummary.ledgerEventCount,
  }, outPath }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
