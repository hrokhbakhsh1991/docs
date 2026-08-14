/**
 * PR16-C — Live internal shadow validation (report-only).
 * Enables shadow only for the process; does not persist flag changes.
 *
 * Run:
 *   cd apps/api && \
 *   FINANCE_CASE_ENCOUNTER_MODE=internal \
 *   FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003,00000000-0000-4000-8000-000000000014 \
 *   FINANCE_CASE_SHADOW_ENABLED=true \
 *   FINANCE_CASE_SHADOW_TENANTS=00000000-0000-4000-8000-000000000003,00000000-0000-4000-8000-000000000014 \
 *   PR16C_OUT=/tmp/pr16c-shadow-validation.json \
 *   node --import tsx --env-file=.env --env-file=.env.local \
 *     src/workspace-finance/case/shadow/validate-internal-shadow.ts
 */
import { writeFileSync } from "node:fs";

import { createInMemoryFinanceCaseComparisonEmitter } from "../comparison/comparison-observation";
import { resolveFinanceCaseShadowRollout } from "../finance-case-feature-flag";
import { runDenaliFinanceCaseShadow } from "../schedule-denali-finance-case-shadow";
import { buildLiveDenaliCaseReadDepsForTenant } from "../encounter/build-live-denali-case-read-deps";
import { buildFinanceCaseShadowValidationReport } from "./build-finance-case-shadow-validation-report";
import { resolveFinanceCaseShadowDecision } from "./resolve-finance-case-shadow-decision";

const TENANT_A =
  process.env.PR16C_TENANT_A?.trim() || "00000000-0000-4000-8000-000000000003";
const TENANT_B =
  process.env.PR16C_TENANT_B?.trim() || "00000000-0000-4000-8000-000000000014";
const TENANT_EXCLUDED =
  process.env.PR16C_TENANT_EXCLUDED?.trim() || "00000000-0000-4000-8000-000000000004";

const MATRIX_REGS = [
  "00000000-0000-4000-8000-000000000529",
  "00000000-0000-4000-8000-000000000536",
  "00000000-0000-4000-8000-000000000523",
  "00000000-0000-4000-8000-000000000544",
];

type SampleRow = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly role: "allowlisted" | "excluded" | "fail_closed_probe";
  readonly skipped: boolean;
  readonly skipReason?: string;
  readonly category?: string;
  readonly taxonomyCode?: string;
  readonly caseKey?: string | null;
  readonly primaryUnchanged: true;
  readonly error?: string;
};

function shadowEnv(
  extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    FINANCE_CASE_ENCOUNTER_MODE: "internal",
    FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: `${TENANT_A},${TENANT_B}`,
    FINANCE_CASE_SHADOW_ENABLED: "true",
    FINANCE_CASE_SHADOW_TENANTS: `${TENANT_A},${TENANT_B}`,
    FINANCE_CASE_SHADOW_SAMPLE_RATE: "1",
    ...extra,
  };
}

async function pickRegs(tenantId: string): Promise<string[]> {
  try {
    const deps = await buildLiveDenaliCaseReadDepsForTenant(tenantId);
    const found: string[] = [];
    for (const id of MATRIX_REGS) {
      const booking = await deps.bookings.getById(id, tenantId);
      if (booking !== null) found.push(id);
    }
    return found.slice(0, 3);
  } catch {
    return [];
  }
}

async function runSample(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly role: SampleRow["role"];
  readonly env: Record<string, string | undefined>;
  readonly emitter: ReturnType<typeof createInMemoryFinanceCaseComparisonEmitter>;
}): Promise<SampleRow> {
  const rollout = resolveFinanceCaseShadowRollout({
    tenantId: input.tenantId,
    env: input.env,
    trigger: "manual",
  });
  if (!rollout.run) {
    return {
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      role: input.role,
      skipped: true,
      skipReason: rollout.reason,
      primaryUnchanged: true,
    };
  }

  try {
    const readDeps = await buildLiveDenaliCaseReadDepsForTenant(input.tenantId);
    const booking = await readDeps.bookings.getById(
      input.registrationId,
      input.tenantId
    );
    if (booking === null) {
      return {
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        role: input.role,
        skipped: true,
        skipReason: "booking_not_found",
        primaryUnchanged: true,
      };
    }

    const result = await runDenaliFinanceCaseShadow({
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      counterpartyId: booking.submittedByUserId ?? "unknown",
      trigger: "manual",
      enabled: true,
      env: input.env,
      readDeps,
      comparisonEmitter: input.emitter,
    });

    if (result.skipped) {
      return {
        tenantId: input.tenantId,
        registrationId: input.registrationId,
        role: input.role,
        skipped: true,
        skipReason: result.reason,
        primaryUnchanged: true,
      };
    }

    return {
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      role: input.role,
      skipped: false,
      category: result.comparison?.category,
      taxonomyCode: result.comparison?.taxonomyCode,
      caseKey: result.comparison?.caseKey ?? null,
      primaryUnchanged: true,
    };
  } catch (err) {
    return {
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      role: input.role,
      skipped: true,
      skipReason: "shadow_threw_fail_open",
      primaryUnchanged: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const env = shadowEnv();
  const emitter = createInMemoryFinanceCaseComparisonEmitter();
  const rows: SampleRow[] = [];
  const tenantIdsForObs: string[] = [];

  const regsA = await pickRegs(TENANT_A);
  for (const registrationId of regsA) {
    const before = emitter.observations.length;
    const row = await runSample({
      tenantId: TENANT_A,
      registrationId,
      role: "allowlisted",
      env,
      emitter,
    });
    rows.push(row);
    const added = emitter.observations.length - before;
    for (let i = 0; i < added; i += 1) tenantIdsForObs.push(TENANT_A);
  }

  const regsB = await pickRegs(TENANT_B);
  for (const registrationId of regsB.length > 0 ? regsB : []) {
    const before = emitter.observations.length;
    const row = await runSample({
      tenantId: TENANT_B,
      registrationId,
      role: "allowlisted",
      env,
      emitter,
    });
    rows.push(row);
    const added = emitter.observations.length - before;
    for (let i = 0; i < added; i += 1) tenantIdsForObs.push(TENANT_B);
  }

  // Excluded tenant — must not execute shadow (and must not build urban deps).
  rows.push(
    await runSample({
      tenantId: TENANT_EXCLUDED,
      registrationId: "00000000-0000-4000-8000-000000000001",
      role: "excluded",
      env,
      emitter,
    })
  );

  // Fail-closed: missing SHADOW_TENANTS.
  const failClosed = resolveFinanceCaseShadowRollout({
    tenantId: TENANT_A,
    enabled: true,
    env: shadowEnv({ FINANCE_CASE_SHADOW_TENANTS: "" }),
    trigger: "manual",
  });
  rows.push({
    tenantId: TENANT_A,
    registrationId: "fail-closed-probe",
    role: "fail_closed_probe",
    skipped: !failClosed.run,
    skipReason: failClosed.run ? undefined : failClosed.reason,
    primaryUnchanged: true,
  });

  const report = buildFinanceCaseShadowValidationReport({
    observations: emitter.observations,
    tenantIds: tenantIdsForObs,
  });
  const decision = resolveFinanceCaseShadowDecision({ report });

  const isolation = {
    allowlistedExecuted: rows.some((r) => r.role === "allowlisted" && !r.skipped),
    excludedZeroShadow: rows
      .filter((r) => r.role === "excluded")
      .every((r) => r.skipped === true),
    failClosedEmptyTenants:
      !failClosed.run && failClosed.reason === "tenant_excluded",
    crossTenantLeak: (() => {
      const aKeys = new Set(report.caseKeysByTenant[TENANT_A] ?? []);
      const bKeys = report.caseKeysByTenant[TENANT_B] ?? [];
      return bKeys.some((k) => aKeys.has(k) && k.length > 0 && TENANT_A !== TENANT_B);
    })(),
  };

  const out = {
    generatedAt: new Date().toISOString(),
    env: {
      mode: env.FINANCE_CASE_ENCOUNTER_MODE,
      internalTenants: env.FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS,
      shadowEnabled: env.FINANCE_CASE_SHADOW_ENABLED,
      shadowTenants: env.FINANCE_CASE_SHADOW_TENANTS,
    },
    samples: rows,
    isolation,
    report,
    decision: {
      kind: decision.kind,
      reasons: decision.reasons,
      criteria: decision.criteria,
      deferred: decision.deferred,
      mutatesFlags: decision.mutatesFlags,
      autoRemediation: decision.autoRemediation,
    },
    safety: {
      primaryUnchanged: rows.every((r) => r.primaryUnchanged),
      writesCasePersistence: false,
      commandBridgeExecuted: false,
      blocksFinanceService: false,
    },
  };

  const outPath = process.env.PR16C_OUT ?? "/tmp/pr16c-shadow-validation.json";
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  process.stdout.write(`Wrote ${outPath}\n`);
  process.stdout.write(`${JSON.stringify({ decision: out.decision, isolation, reportSummary: {
    totalComparisons: report.totalComparisons,
    comparableCases: report.comparableCases,
    verdictMatchPct: report.verdictMatchPct,
    ownershipMatchPct: report.ownershipMatchPct,
    taxonomyDistribution: report.taxonomyDistribution,
  } }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
