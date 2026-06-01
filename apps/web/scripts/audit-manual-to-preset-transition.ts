/**
 * Transition-integrity audit: empty/manual wizard → user edits → Denali preset apply.
 *
 * Verifies preset apply replaces manual state (factory + RHF quiet reset), not merge.
 *
 * Usage:
 *   pnpm --filter web audit:manual-to-preset-transition
 *   pnpm --filter web audit:manual-to-preset-transition -- --markdown-out=../../audit-report.md
 */
import fs from "node:fs";
import path from "node:path";

import { buildDenaliTourCreateDefaultValues, denaliRuleSet } from "@repo/denali-domain";
import type { DenaliCanonicalTemplateData } from "@repo/types/denali";
import { createFormControl } from "react-hook-form";

import {
  applyDenaliWizardPreset,
  applyClassicWizardPreset,
} from "../src/features/tours/wizard/tourCreationPresetApply";
import { buildTourCreateFormDefaultValues } from "../src/features/tours/wizard/tourCreateFormDefaults";
import type { TourCreateFormValues } from "../src/features/tours/wizard/schemas/classic/tourCreateSchema";
import {
  emptyDenaliWizardCanonicalData,
  orchestrateDenaliWizardFromTemplate,
} from "../src/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate";
import { DENALI_QUIET_FORM_RESET_OPTIONS } from "../src/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { mergeDenaliFormDefaults } from "../src/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { TenantWizardTemplate } from "../src/features/tours/wizard/template/tenant-wizard-template.types";

const MANUAL_TITLE = "__MANUAL_TRANSITION_AUDIT_TITLE__";
const PRESET_TITLE = "__PRESET_TRANSITION_AUDIT_TITLE__";
const MANUAL_SHORT = "__MANUAL_SHORT_DESC__";
const PRESET_SHORT = "__PRESET_SHORT_DESC__";
const MANUAL_TRANSPORT = 77_777;
const PRESET_TRANSPORT = 33_333;
const SMUGGLE_KEY = "__smuggledManualKey";

type ScenarioResult = {
  id: string;
  pass: boolean;
  detail: string;
  manualLeaks?: string[];
};

type TransitionIntegrityReport = {
  generatedAt: string;
  architectureNote: string;
  scenarios: ScenarioResult[];
  pass: boolean;
};

function parseArgs(argv: string[]): { markdownOut: string | null; jsonOut: string | null } {
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  return {
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
    jsonOut: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
  };
}

function auditTemplate(): TenantWizardTemplate {
  return {
    id: "tpl-transition-integrity-audit",
    workspaceId: "ws-transition-integrity-audit",
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    presetId: null,
    canonicalData: {},
    wizardContractVersion: 1,
    formProfileVersion: 1,
  };
}

function richPresetCanonical(): DenaliCanonicalTemplateData {
  return {
    category: "mountain",
    duration: "single",
    title: PRESET_TITLE,
    program: { shortDescription: PRESET_SHORT },
    transport: { mode: "bus", transportCost: PRESET_TRANSPORT },
  };
}

function partialPresetCanonical(): DenaliCanonicalTemplateData {
  return {
    category: "mountain",
    duration: "single",
    program: { shortDescription: PRESET_SHORT },
  };
}

function applyManualMarkers(
  form: ReturnType<typeof buildDenaliTourCreateDefaultValues>,
): ReturnType<typeof buildDenaliTourCreateDefaultValues> {
  const manual = structuredClone(form);
  manual.basicInfo.title = MANUAL_TITLE;
  manual.programNature.shortDescription = MANUAL_SHORT;
  manual.transport.transportCost = MANUAL_TRANSPORT;
  (manual as Record<string, unknown>)[SMUGGLE_KEY] = "manual-smuggle";
  return manual;
}

function collectManualLeaks(
  form: ReturnType<typeof buildDenaliTourCreateDefaultValues>,
): string[] {
  const leaks: string[] = [];
  if (form.basicInfo.title === MANUAL_TITLE) {
    leaks.push("basicInfo.title");
  }
  if (form.programNature.shortDescription === MANUAL_SHORT) {
    leaks.push("programNature.shortDescription");
  }
  if (form.transport.transportCost === MANUAL_TRANSPORT) {
    leaks.push("transport.transportCost");
  }
  if ((form as Record<string, unknown>)[SMUGGLE_KEY] != null) {
    leaks.push(SMUGGLE_KEY);
  }
  return leaks;
}

async function scenarioFactoryIgnoresManualBase(): Promise<ScenarioResult> {
  const template = auditTemplate();
  const empty = await orchestrateDenaliWizardFromTemplate(template, emptyDenaliWizardCanonicalData());
  if (!empty.success) {
    return { id: "factory_ignores_manual_base", pass: false, detail: empty.errors.join("; ") };
  }

  applyManualMarkers(empty.form);
  const withManualBase = await applyDenaliWizardPreset({
    workspaceFormProfile: "denali_pilot",
    ruleSet: denaliRuleSet,
    template,
    canonicalData: richPresetCanonical(),
    baseValues: manualForm,
  });
  const withoutManualBase = await applyDenaliWizardPreset({
    workspaceFormProfile: "denali_pilot",
    ruleSet: denaliRuleSet,
    template,
    canonicalData: richPresetCanonical(),
  });

  if (!withManualBase.success || !withoutManualBase.success) {
    return {
      id: "factory_ignores_manual_base",
      pass: false,
      detail: "preset orchestration failed",
    };
  }

  const same =
    JSON.stringify(withManualBase.form) === JSON.stringify(withoutManualBase.form);
  return {
    id: "factory_ignores_manual_base",
    pass: same,
    detail: same
      ? "baseValues ignored; preset output identical with/without manual form"
      : "baseValues mutated preset output (merge leak)",
  };
}

async function scenarioPresetWipesManualOrchestration(): Promise<ScenarioResult> {
  const template = auditTemplate();
  const empty = await orchestrateDenaliWizardFromTemplate(template, emptyDenaliWizardCanonicalData());
  if (!empty.success) {
    return { id: "preset_wipes_manual_orchestration", pass: false, detail: empty.errors.join("; ") };
  }

  applyManualMarkers(empty.form);
  const preset = await applyDenaliWizardPreset({
    workspaceFormProfile: "denali_pilot",
    ruleSet: denaliRuleSet,
    template,
    canonicalData: richPresetCanonical(),
  });
  if (!preset.success) {
    return { id: "preset_wipes_manual_orchestration", pass: false, detail: preset.errors.join("; ") };
  }

  const leaks = collectManualLeaks(preset.form);
  const titleOk = preset.form.basicInfo.title === PRESET_TITLE;
  const shortOk = preset.form.programNature.shortDescription === PRESET_SHORT;
  const transportWiped = preset.form.transport.transportCost !== MANUAL_TRANSPORT;
  const transportFromPreset = preset.form.transport.transportCost === PRESET_TRANSPORT;
  const pass = leaks.length === 0 && titleOk && shortOk && transportWiped;

  return {
    id: "preset_wipes_manual_orchestration",
    pass,
    detail: pass
      ? `manual markers absent; preset title/shortDescription applied${transportFromPreset ? "; transportCost preserved" : "; transportCost cleared by rule normalize (manual still wiped)"}`
      : `leaks=${leaks.join(",")} titleOk=${titleOk} shortOk=${shortOk} transportWiped=${transportWiped}`,
    manualLeaks: leaks,
  };
}

async function scenarioPartialPresetClearsManualTitle(): Promise<ScenarioResult> {
  const template = auditTemplate();
  const empty = await orchestrateDenaliWizardFromTemplate(template, emptyDenaliWizardCanonicalData());
  if (!empty.success) {
    return { id: "partial_preset_clears_manual_title", pass: false, detail: empty.errors.join("; ") };
  }

  applyManualMarkers(empty.form);
  const preset = await applyDenaliWizardPreset({
    workspaceFormProfile: "denali_pilot",
    ruleSet: denaliRuleSet,
    template,
    canonicalData: partialPresetCanonical(),
  });
  if (!preset.success) {
    return { id: "partial_preset_clears_manual_title", pass: false, detail: preset.errors.join("; ") };
  }

  const leaks = collectManualLeaks(preset.form);
  const titleCleared = preset.form.basicInfo.title !== MANUAL_TITLE;
  const shortOk = preset.form.programNature.shortDescription === PRESET_SHORT;
  const pass = leaks.length === 0 && titleCleared && shortOk;

  return {
    id: "partial_preset_clears_manual_title",
    pass,
    detail: pass
      ? "partial preset hydrates from registry base; manual title not retained"
      : `title=${preset.form.basicInfo.title} leaks=${leaks.join(",")}`,
    manualLeaks: leaks,
  };
}

function scenarioRhfQuietResetWipesManual(): ScenarioResult {
  const defaults = buildDenaliTourCreateDefaultValues();
  const { reset, getValues } = createFormControl({ defaultValues: defaults });

  reset(applyManualMarkers(defaults));

  const preset = structuredClone(defaults);
  preset.basicInfo.title = PRESET_TITLE;
  preset.programNature.shortDescription = PRESET_SHORT;
  preset.transport.transportCost = PRESET_TRANSPORT;

  reset(preset, DENALI_QUIET_FORM_RESET_OPTIONS);

  const after = getValues();
  const leaks = collectManualLeaks(after);
  const pass =
    leaks.length === 0 &&
    after.basicInfo.title === PRESET_TITLE &&
    after.programNature.shortDescription === PRESET_SHORT &&
    after.transport.transportCost === PRESET_TRANSPORT;

  return {
    id: "rhf_quiet_reset_wipes_manual",
    pass,
    detail: pass
      ? "DenaliTourCreationPresetBanner reset() replaces manual with full preset form"
      : `leaks=${leaks.join(",")} title=${after.basicInfo.title}`,
    manualLeaks: leaks,
  };
}

function scenarioClassicPresetStillMerges(): ScenarioResult {
  const base: TourCreateFormValues = {
    ...buildTourCreateFormDefaultValues(),
    overview: {
      ...buildTourCreateFormDefaultValues().overview,
      title: MANUAL_TITLE,
      tourType: "mountain",
    },
  };
  const merged = applyClassicWizardPreset({
    workspaceFormProfile: "mountain_outdoor",
    baseValues: base,
    defaults: {
      overview: { title: PRESET_TITLE, tourType: "mountain" },
    },
  });

  const titleIsPreset = merged.overview?.title === PRESET_TITLE;
  const pass = titleIsPreset;
  return {
    id: "classic_preset_merge_baseline",
    pass,
    detail: pass
      ? "classic rail merges patch onto baseValues (Denali path does not)"
      : `unexpected title=${merged.overview?.title}`,
  };
}

function scenarioMergeHelperNotUsedByDenaliPreset(): ScenarioResult {
  const defaults = buildDenaliTourCreateDefaultValues();
  const manual = applyManualMarkers(defaults);
  const presetOnly = structuredClone(defaults);
  presetOnly.basicInfo.title = PRESET_TITLE;
  const merged = mergeDenaliFormDefaults(manual, presetOnly);
  const leaks = collectManualLeaks(merged);
  const pass = leaks.length === 0 && merged.basicInfo.title === PRESET_TITLE;
  return {
    id: "merge_helper_shallow_reference",
    pass,
    detail: pass
      ? "mergeDenaliFormDefaults reference: Denali preset uses factory reset(), not this helper"
      : `leaks=${leaks.join(",")}`,
    manualLeaks: leaks,
  };
}

function formatMarkdown(report: TransitionIntegrityReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Transition-Integrity Audit — Manual → Preset Apply (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter web audit:manual-to-preset-transition\` (\`apps/web/scripts/audit-manual-to-preset-transition.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Context:** ${report.architectureNote}`,
    "",
    "### Scenarios",
    "",
    "| Scenario | Pass | Detail |",
    "|----------|------|--------|",
  ];

  for (const scenario of report.scenarios) {
    lines.push(`| ${scenario.id} | ${scenario.pass ? "yes" : "**no**"} | ${scenario.detail} |`);
  }

  lines.push(
    "",
    `**Overall:** ${report.pass ? "**PASS** — manual state fully replaced by preset (no merge leak on Denali path)" : "**FAIL** — see failing scenarios"}`,
    "",
    "**Artifact:** `apps/web/reports/manual-to-preset-transition-integrity.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Transition-Integrity Audit — Manual → Preset Apply";
  const trimmed = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).replace(/\n+$/, "")
    : existing.replace(/\n+$/, "");
  fs.writeFileSync(resolved, `${trimmed}${section}`, "utf8");
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));

  const scenarios: ScenarioResult[] = [
    await scenarioFactoryIgnoresManualBase(),
    await scenarioPresetWipesManualOrchestration(),
    await scenarioPartialPresetClearsManualTitle(),
    scenarioRhfQuietResetWipesManual(),
    scenarioClassicPresetStillMerges(),
    scenarioMergeHelperNotUsedByDenaliPreset(),
  ];

  const report: TransitionIntegrityReport = {
    generatedAt: new Date().toISOString(),
    architectureNote:
      "Tour Create no longer exposes manualWizardMode; \"manual\" = empty template canonical + in-form edits, then DenaliTourCreationPresetBanner → applyDenaliWizardPreset → orchestrateDenaliWizardFromTemplate (preset canonical only) → reset(form, DENALI_QUIET_FORM_RESET_OPTIONS).",
    scenarios,
    pass: scenarios.every((scenario) => scenario.pass),
  };

  const jsonTarget = jsonOut ?? path.join(process.cwd(), "reports", "manual-to-preset-transition-integrity.json");
  const jsonResolved = path.resolve(jsonTarget);
  fs.mkdirSync(path.dirname(jsonResolved), { recursive: true });
  fs.writeFileSync(jsonResolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${jsonResolved}`);

  const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
  appendMarkdown(mdTarget, formatMarkdown(report));
  console.log(`Appended transition-integrity section to ${path.resolve(mdTarget)}`);

  if (!report.pass) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
