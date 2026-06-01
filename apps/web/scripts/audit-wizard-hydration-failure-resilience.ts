/**
 * Failure-resilience audit: mocked corrupt {@link tryHydrateCanonicalTemplate} output and
 * {@link WorkspaceTourWizard} guard analysis (reject UI vs submit with bad state).
 *
 * Usage:
 *   pnpm --filter web audit:wizard-hydration-failure-resilience
 *   pnpm --filter web audit:wizard-hydration-failure-resilience -- --markdown-out=../../audit-report.md
 */
import fs from "node:fs";
import path from "node:path";

import {
  DENALI_FIELD_DEFINITIONS,
  denaliRuleSet,
  denaliTemplateOrchestratorFactory,
  finalizeDenaliWizardHydration,
  normalizeDenaliWizardForm,
  pruneDenaliWizardFormToRegistry,
  resetWizardToRegistryDefaults,
  getDenaliFormPathValue,
  tryHydrateCanonicalTemplate,
  type DenaliCreateTourWizardForm,
} from "@repo/denali-domain";
import { DENALI_ROOTS } from "@repo/shared-contracts";

import { mergeDenaliFormDefaults } from "../src/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { isWizardFormCanonicalEmpty } from "../src/features/tours/wizard/validation/wizardCanonicalSubmitGuard";
import { prepareDenaliSubmitArtifact } from "../src/features/tours/wizard/domain/submit-orchestrator";
import { evaluateDenaliWizardSubmitGate } from "../src/features/tours/wizard/denali/validation/denaliSubmitValidation";
import type { TourWizardTemplateInstantiateResponse } from "../src/features/tours/wizard/hooks/useInstantiateWorkspaceTemplate";

type ScenarioResult = {
  id: string;
  pass: boolean;
  detail: string;
  evidence?: Record<string, unknown>;
};

type StaticGuardFinding = {
  id: string;
  present: boolean;
  detail: string;
};

type HydrationFailureResilienceReport = {
  generatedAt: string;
  mockNote: string;
  scenarios: ScenarioResult[];
  staticWorkspaceTourWizardGuards: StaticGuardFinding[];
  pass: boolean;
};

const CORRUPT_HYDRATE_FORM = {
  basicInfo: { title: "__CORRUPT_PARTIAL_HYDRATE__" },
  __ghostRoot: { smuggled: true },
} as unknown as DenaliCreateTourWizardForm;

const REQUIRED_SUBMIT_PATHS = [
  "basicInfo.tourType",
  "basicInfo.title",
] as const;

function parseArgs(argv: string[]): { markdownOut: string | null; jsonOut: string | null } {
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  return {
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
    jsonOut: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
  };
}

/** Mirrors {@link DenaliTemplateOrchestratorFactory.createDraftFromTemplate} post-hydrate steps. */
function runFactoryPostHydratePipeline(
  hydrated: ReturnType<typeof tryHydrateCanonicalTemplate>,
  ruleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  const defaultValues = resetWizardToRegistryDefaults();
  let form = hydrated?.formValues ?? defaultValues;
  form = normalizeDenaliWizardForm(form, undefined, ruleSet);
  form = finalizeDenaliWizardHydration(form, ruleSet);
  return pruneDenaliWizardFormToRegistry(form);
}

function hasAllDenaliRoots(form: DenaliCreateTourWizardForm): boolean {
  const record = form as unknown as Record<string, unknown>;
  return DENALI_ROOTS.every((root) => record[root] != null && typeof record[root] === "object");
}

function missingRequiredSubmitPaths(form: DenaliCreateTourWizardForm): string[] {
  const missing: string[] = [];
  for (const path of REQUIRED_SUBMIT_PATHS) {
    const value = getDenaliFormPathValue(form, path);
    if (value === undefined || value === null || value === "") {
      missing.push(path);
    }
  }
  return missing;
}

function hasGhostRoot(form: DenaliCreateTourWizardForm): boolean {
  return "__ghostRoot" in (form as unknown as Record<string, unknown>);
}

function simulateWorkspaceWizardGates(input: {
  instantiateSettled: boolean;
  instantiateFetching: boolean;
  instantiateSuccess: boolean;
  instantiateSuccessFlag: boolean;
  factoryForm: DenaliCreateTourWizardForm | null;
  draftInitComplete: boolean;
  formHydrationApplied: boolean;
}): {
  factoryHydrationRejected: boolean;
  templateHydrationReady: boolean;
  wizardFormReady: boolean;
  canRenderSubmitControl: boolean;
} {
  const factoryInstantiateSettled = input.instantiateSettled;
  const factoryHydrationRejected =
    factoryInstantiateSettled &&
    (!input.instantiateSuccess ||
      (input.instantiateSuccess &&
        (input.factoryForm == null || !input.instantiateSuccessFlag)));

  const templateHydrationReady =
    input.draftInitComplete &&
    factoryInstantiateSettled &&
    !input.instantiateFetching &&
    !factoryHydrationRejected &&
    input.factoryForm != null;

  const wizardFormReady = templateHydrationReady && input.formHydrationApplied;

  return {
    factoryHydrationRejected,
    templateHydrationReady,
    wizardFormReady,
    canRenderSubmitControl: wizardFormReady,
  };
}

function extractFactoryWizardForm(
  response: TourWizardTemplateInstantiateResponse,
): DenaliCreateTourWizardForm | null {
  if (!response.success) {
    return null;
  }
  const factoryForm = response.draftState.data.form;
  if (factoryForm == null || typeof factoryForm !== "object") {
    return null;
  }
  return factoryForm as DenaliCreateTourWizardForm;
}

function mergeFactoryWithDraftBaseline(
  factoryForm: DenaliCreateTourWizardForm,
  draftForm: Partial<DenaliCreateTourWizardForm> | undefined,
): DenaliCreateTourWizardForm {
  const factoryBaseline = finalizeDenaliWizardHydration(factoryForm, denaliRuleSet);
  if (draftForm == null) {
    return factoryBaseline;
  }
  return finalizeDenaliWizardHydration(
    mergeDenaliFormDefaults(factoryBaseline, draftForm),
    denaliRuleSet,
  );
}

function simulateSubmitBlocked(form: DenaliCreateTourWizardForm): {
  blocked: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (isWizardFormCanonicalEmpty(form)) {
    reasons.push("isWizardFormCanonicalEmpty");
  }
  try {
    const artifact = prepareDenaliSubmitArtifact(form, {
      ruleSet: denaliRuleSet,
      workspaceId: "ws-audit",
      catalog: { destinationIds: new Set(), themeIds: new Set() },
    });
    const gate = evaluateDenaliWizardSubmitGate(artifact, {
      ruleSet: denaliRuleSet,
      profile: "denali_pilot",
    });
    if (!gate.success) {
      reasons.push("evaluateDenaliWizardSubmitGate");
    }
  } catch (error) {
    reasons.push(`prepareDenaliSubmitArtifact:${error instanceof Error ? error.message : String(error)}`);
  }
  return { blocked: reasons.length > 0, reasons };
}

function auditWorkspaceTourWizardSource(source: string): StaticGuardFinding[] {
  return [
    {
      id: "factory_hydration_rejected_early_return",
      present: /if\s*\(\s*factoryHydrationRejected\s*\)/.test(source),
      detail: "Dedicated rejected UI before main wizard shell",
    },
    {
      id: "rejected_testid_banner",
      present: /workspace-tour-wizard-factory-rejected/.test(source),
      detail: "data-testid for factory rejection card",
    },
    {
      id: "wizard_form_ready_gate",
      present: /const wizardFormReady = templateHydrationReady && formHydrationApplied/.test(source),
      detail: "Submit rail gated on hydration applied",
    },
    {
      id: "visible_steps_empty_without_ready",
      present: /if\s*\(\s*!wizardFormReady\s*\)\s*\{\s*return\s*\[\]\s*as readonly DenaliCreateWizardStepId\[\]/.test(
        source,
      ),
      detail: "No visible steps until wizardFormReady",
    },
    {
      id: "submit_canonical_empty_guard",
      present: /isWizardFormCanonicalEmpty\s*\(\s*values\s*\)/.test(source),
      detail: "handleSubmit blocks empty canonical export",
    },
    {
      id: "no_try_hydrate_in_wizard",
      present: !/tryHydrateCanonicalTemplate/.test(source),
      detail: "Wizard does not call tryHydrateCanonicalTemplate directly (factory/instantiate only)",
    },
    {
      id: "orchestration_error_root",
      present: /reportOrchestrationError/.test(source),
      detail: "Preset/clear orchestration failures surface root error",
    },
    {
      id: "hydration_parity_throw",
      present: /assertFactoryHydrationParity/.test(source),
      detail: "Parity mismatch throws HydrationParityError in hydrate effect (ErrorBoundary dependent)",
    },
    {
      id: "client_merge_no_registry_prune",
      present:
        /mergeFactoryWithDraftBaseline/.test(source) && !/pruneDenaliWizardFormToRegistry/.test(source),
      detail: "Client merge path finalizes but does not re-prune registry (relies on factory-pruned instantiate payload)",
    },
  ];
}

async function scenarioTryHydrateNullFallsBack(): Promise<ScenarioResult> {
  const defaults = resetWizardToRegistryDefaults();
  const hydrated = tryHydrateCanonicalTemplate({}, defaults, undefined, denaliRuleSet);
  const form = runFactoryPostHydratePipeline(hydrated);
  const pass =
    hydrated === null &&
    hasAllDenaliRoots(form) &&
    !hasGhostRoot(form) &&
    form.basicInfo.title !== "__CORRUPT_PARTIAL_HYDRATE__";

  return {
    id: "try_hydrate_null_registry_fallback",
    pass,
    detail: pass
      ? "Empty canonical → tryHydrate null → factory uses registry defaults + prune"
      : "Unexpected hydrate output for empty canonical",
    evidence: { hydratedWasNull: hydrated === null, hasRoots: hasAllDenaliRoots(form) },
  };
}

async function scenarioMockCorruptTryHydrateHealedByFactory(): Promise<ScenarioResult> {
  const mockHydrated = {
    formValues: CORRUPT_HYDRATE_FORM,
  };
  const form = runFactoryPostHydratePipeline(mockHydrated);
  const pass =
    hasAllDenaliRoots(form) &&
    !hasGhostRoot(form) &&
    form.basicInfo.title === "__CORRUPT_PARTIAL_HYDRATE__";

  return {
    id: "mock_corrupt_try_hydrate_factory_prune",
    pass,
    detail: pass
      ? "Corrupt partial hydrate healed to full DENALI_ROOTS; registry title preserved; ghost root stripped"
      : `roots=${hasAllDenaliRoots(form)} ghost=${hasGhostRoot(form)} title=${form.basicInfo.title}`,
    evidence: {
      registryFieldCount: DENALI_FIELD_DEFINITIONS.length,
      missingRequired: missingRequiredSubmitPaths(form),
    },
  };
}

async function scenarioInvalidCanonicalRejectedByFactory(): Promise<ScenarioResult> {
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-audit",
    templateId: "tpl-audit",
    canonicalData: { category: "mountain", duration: "not-a-valid-duration" },
    fieldRulesOverlay: {},
  });
  const pass = !result.success && (result.errors?.length ?? 0) > 0;
  return {
    id: "invalid_canonical_factory_rejects",
    pass,
    detail: pass
      ? "Zod canonical validation fails before hydrate (no corrupt form emitted)"
      : "Factory accepted invalid canonical",
    evidence: { errors: result.errors?.slice(0, 3) },
  };
}

function scenarioClientRejectsFailedInstantiate(): ScenarioResult {
  const response: TourWizardTemplateInstantiateResponse = {
    success: false,
    errors: ["canonical_validation: duration: Invalid option"],
    draftState: { data: {}, version: 0, schemaVersion: 1, lastModified: 0 },
  };
  const form = extractFactoryWizardForm(response);
  const gates = simulateWorkspaceWizardGates({
    instantiateSettled: true,
    instantiateFetching: false,
    instantiateSuccess: true,
    instantiateSuccessFlag: response.success,
    factoryForm: form,
    draftInitComplete: true,
    formHydrationApplied: true,
  });
  const pass = gates.factoryHydrationRejected && !gates.canRenderSubmitControl;
  return {
    id: "client_rejects_failed_instantiate",
    pass,
    detail: pass
      ? "success:false → factoryHydrationRejected; submit rail unreachable"
      : `rejected=${gates.factoryHydrationRejected} submit=${gates.canRenderSubmitControl}`,
  };
}

function scenarioClientNullFormRejected(): ScenarioResult {
  const response: TourWizardTemplateInstantiateResponse = {
    success: true,
    draftState: { data: {}, version: 0, schemaVersion: 1, lastModified: 0 },
  };
  const form = extractFactoryWizardForm(response);
  const gates = simulateWorkspaceWizardGates({
    instantiateSettled: true,
    instantiateFetching: false,
    instantiateSuccess: true,
    instantiateSuccessFlag: true,
    factoryForm: form,
    draftInitComplete: true,
    formHydrationApplied: false,
  });
  const pass = gates.factoryHydrationRejected && !gates.canRenderSubmitControl;
  return {
    id: "client_rejects_missing_form_envelope",
    pass,
    detail: pass
      ? "Missing draftState.form → rejected; wizard not ready"
      : `formNull=${form == null}`,
  };
}

function scenarioHypotheticalEmptyFormObject(): ScenarioResult {
  const corruptEnvelope = {} as DenaliCreateTourWizardForm;
  const gates = simulateWorkspaceWizardGates({
    instantiateSettled: true,
    instantiateFetching: false,
    instantiateSuccess: true,
    instantiateSuccessFlag: true,
    factoryForm: corruptEnvelope,
    draftInitComplete: true,
    formHydrationApplied: true,
  });
  const merged = mergeFactoryWithDraftBaseline(corruptEnvelope, undefined);
  const submit = simulateSubmitBlocked(merged);
  const pass = !gates.factoryHydrationRejected && submit.blocked;
  return {
    id: "hypothetical_empty_form_object_submit_blocked",
    pass,
    detail: pass
      ? "If API leaked {} form, wizard would render but submit guards block empty canonical"
      : `rejected=${gates.factoryHydrationRejected} submitBlocked=${submit.blocked} reasons=${submit.reasons.join(",")}`,
    evidence: { wizardFormReady: gates.wizardFormReady, missingRequired: missingRequiredSubmitPaths(merged) },
  };
}

async function scenarioFactoryOutputSubmitGuard(): Promise<ScenarioResult> {
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-audit",
    templateId: "tpl-audit",
    canonicalData: {},
    fieldRulesOverlay: {},
  });
  if (!result.success) {
    return { id: "factory_empty_canonical_submit_guard", pass: false, detail: "factory failed" };
  }
  const form = result.draftState.data.form as DenaliCreateTourWizardForm;
  const submit = simulateSubmitBlocked(form);
  const pass = submit.blocked && submit.reasons.includes("isWizardFormCanonicalEmpty");
  return {
    id: "factory_empty_canonical_submit_guard",
    pass,
    detail: pass
      ? "Registry-default factory form blocked by isWizardFormCanonicalEmpty on submit"
      : `reasons=${submit.reasons.join(",")}`,
  };
}

function formatMarkdown(report: HydrationFailureResilienceReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Failure-Resilience Audit — Corrupt Template Hydration (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter web audit:wizard-hydration-failure-resilience\` (\`apps/web/scripts/audit-wizard-hydration-failure-resilience.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Mock:** ${report.mockNote}`,
    "",
    "### Runtime scenarios",
    "",
    "| Scenario | Pass | Detail |",
    "|----------|------|--------|",
  ];

  for (const scenario of report.scenarios) {
    lines.push(`| ${scenario.id} | ${scenario.pass ? "yes" : "**no**"} | ${scenario.detail} |`);
  }

  lines.push("", "### WorkspaceTourWizard.tsx static guards", "", "| Guard | Present | Detail |", "|-------|---------|--------|");
  for (const guard of report.staticWorkspaceTourWizardGuards) {
    lines.push(
      `| ${guard.id} | ${guard.present ? "yes" : "**no**"} | ${guard.detail} |`,
    );
  }

  lines.push(
    "",
    `**Overall:** ${report.pass ? "**PASS**" : "**FAIL**"} — ${report.pass ? "reject or submit-guard contains corrupt hydration; no silent submit of mocked corrupt partial state" : "see failing rows"}`,
    "",
    "**Artifact:** `apps/web/reports/wizard-hydration-failure-resilience.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Failure-Resilience Audit — Corrupt Template Hydration";
  const trimmed = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).replace(/\n+$/, "")
    : existing.replace(/\n+$/, "");
  fs.writeFileSync(resolved, `${trimmed}${section}`, "utf8");
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));
  const wizardSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/tours/wizard/WorkspaceTourWizard.tsx"),
    "utf8",
  );

  const scenarios: ScenarioResult[] = [
    await scenarioTryHydrateNullFallsBack(),
    await scenarioMockCorruptTryHydrateHealedByFactory(),
    await scenarioInvalidCanonicalRejectedByFactory(),
    scenarioClientRejectsFailedInstantiate(),
    scenarioClientNullFormRejected(),
    scenarioHypotheticalEmptyFormObject(),
    await scenarioFactoryOutputSubmitGuard(),
  ];

  const staticGuards = auditWorkspaceTourWizardSource(wizardSource);
  const staticPass = staticGuards.every((guard) => guard.present);

  const report: HydrationFailureResilienceReport = {
    generatedAt: new Date().toISOString(),
    mockNote:
      "Injected tryHydrateCanonicalTemplate return { formValues: partial corrupt + ghost root }; factory post-pipeline is authoritative before client sees instantiate payload.",
    scenarios,
    staticWorkspaceTourWizardGuards: staticGuards,
    pass: scenarios.every((scenario) => scenario.pass) && staticPass,
  };

  const jsonResolved = path.resolve(
    jsonOut ?? path.join(process.cwd(), "reports", "wizard-hydration-failure-resilience.json"),
  );
  fs.mkdirSync(path.dirname(jsonResolved), { recursive: true });
  fs.writeFileSync(jsonResolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${jsonResolved}`);

  const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
  appendMarkdown(mdTarget, formatMarkdown(report));
  console.log(`Appended failure-resilience section to ${path.resolve(mdTarget)}`);

  if (!report.pass) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
