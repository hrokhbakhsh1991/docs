/**
 * Simulates 50 wizard step navigations through draft sanitize pipeline.
 * Fails if serialized form key-set grows without bound (leak indicator).
 *
 * Run: pnpm --filter web exec tsx scripts/denali-draft-navigation-stability.ts
 */
import { DENALI_ROOTS } from "@repo/shared-contracts";

import { buildWorstCaseDenaliWizardForm } from "@/features/tours/wizard/denali/__benchmarks__/fixtures/buildWorstCaseDenaliWizardForm";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { sanitizeDenaliWizardDraftSnapshot } from "@/features/tours/drafts/sanitizeDenaliWizardDraftSnapshot";
import type { DenaliWizardDraftSnapshot } from "@/features/tours/drafts/denali-wizard-draft.types";

const NAV_CYCLES = 50;
const MAX_KEY_GROWTH_PER_CYCLE = 3;
const MAX_TOTAL_KEY_GROWTH = 15;

function countLeafPaths(value: unknown, prefix = "", out = new Set<string>()): number {
  if (value == null || typeof value !== "object") {
    if (prefix) out.add(prefix);
    return out.size;
  }
  if (Array.isArray(value)) {
    if (value.length === 0 && prefix) out.add(prefix);
    value.forEach((item, index) => countLeafPaths(item, `${prefix}[${index}]`, out));
    return out.size;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 && prefix) {
    out.add(prefix);
    return out.size;
  }
  for (const [key, child] of entries) {
    const next = prefix ? `${prefix}.${key}` : key;
    countLeafPaths(child, next, out);
  }
  return out.size;
}

function simulateNavigationWrite(form: ReturnType<typeof buildWorstCaseDenaliWizardForm>, stepIndex: number) {
  const steps = getDenaliWizardSteps();
  const snapshot: DenaliWizardDraftSnapshot = {
    form,
    currentStepIndex: stepIndex % steps.length,
    railLayoutVersion: 3,
  };
  return sanitizeDenaliWizardDraftSnapshot(snapshot).form;
}

function main(): void {
  let form = buildWorstCaseDenaliWizardForm();
  const baselineKeys = countLeafPaths(form);
  let previousKeys = baselineKeys;
  let maxKeys = baselineKeys;

  for (let cycle = 0; cycle < NAV_CYCLES; cycle += 1) {
    const stepIndex = cycle % getDenaliWizardSteps().length;
    form = simulateNavigationWrite(form, stepIndex);

    // Mirror draft-engine debounced persist: normalize + invariant before storage
    form = applyDenaliInvariantState(normalizeDenaliWizardForm(form)) as typeof form;

    const keyCount = countLeafPaths(form);
    maxKeys = Math.max(maxKeys, keyCount);

    const growth = keyCount - previousKeys;
    if (growth > MAX_KEY_GROWTH_PER_CYCLE) {
      console.error(
        JSON.stringify({
          ok: false,
          reason: "unbounded_key_growth_per_cycle",
          cycle,
          keyCount,
          growth,
          maxPerCycle: MAX_KEY_GROWTH_PER_CYCLE,
        }),
      );
      process.exit(1);
    }
    previousKeys = keyCount;
  }

  const totalGrowth = maxKeys - baselineKeys;
  if (totalGrowth > MAX_TOTAL_KEY_GROWTH) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "unbounded_total_key_growth",
        baselineKeys,
        maxKeys,
        totalGrowth,
        maxTotalGrowth: MAX_TOTAL_KEY_GROWTH,
      }),
    );
    process.exit(1);
  }

  const denaliRootKeys = DENALI_ROOTS.flatMap((root) => {
    const slice = (form as Record<string, unknown>)[root];
    return slice && typeof slice === "object" ? Object.keys(slice as object) : [];
  });

  console.log(
    JSON.stringify({
      ok: true,
      navCycles: NAV_CYCLES,
      baselineKeys,
      maxKeys,
      totalGrowth,
      denaliRootKeySampleCount: denaliRootKeys.length,
    }),
  );
}

main();
