/**
 * Concurrency audit: Settings `TourWizardTemplateBuilderForm` save path (submit / handleSubmit).
 * Simulates two rapid Save triggers and whether overlay state is locked or last-write-wins.
 *
 * Usage:
 *   pnpm --filter web audit:template-builder-save-concurrency
 *   pnpm --filter web audit:template-builder-save-concurrency -- --markdown-out=../../audit-report.md
 */
import fs from "node:fs";
import path from "node:path";

import {
  buildTourWizardTemplateBuilderDefaults,
  buildTourWizardTemplatePayloadFromForm,
  type TourWizardTemplateBuilderFormValues,
} from "../lib/validation/tour-wizard-template-builder-form";
import type { TenantWizardTemplate } from "../src/features/tours/wizard/template/tenant-wizard-template.types";

type OverlayDb = Record<string, { visibility?: string; required?: string }>;

type RaceScenarioResult = {
  id: string;
  label: string;
  firstCompletes: "save_a" | "save_b";
  persistedOverlay: OverlayDb;
  expectedIfSerialized: OverlayDb;
  lostEdits: string[];
  pass: boolean;
};

type ClientGuardScan = {
  submitChecksInFlightRef: boolean;
  submitChecksIsPending: boolean;
  isSavingStateAndRef: boolean;
  submitSaveViaHandleSubmit: boolean;
  uiDisablesOnIsSaveBusy: boolean;
  mutationDedupesConcurrentCalls: boolean;
  inFlightAbortOrVersionToken: boolean;
};

type ConcurrencyAuditReport = {
  generatedAt: string;
  saveEntrypoint: string;
  clientGuards: ClientGuardScan;
  apiPersistence: {
    fieldRulesOverlayMerge: boolean;
    fieldRulesOverlayReplace: boolean;
    canonicalDataReplace: boolean;
  };
  payloadShape: string;
  raceScenarios: RaceScenarioResult[];
  doubleMutateUnlocked: { bothStartedBeforePending: boolean; concurrentInFlight: number };
  doubleSubmitWithRefGuard: { secondCallIgnored: boolean; concurrentInFlight: number };
  staticFindings: string[];
  pass: boolean;
};

const FIELD_PATHS = ["title", "program.shortDescription", "destinationId"] as const;

function parseArgs(argv: string[]): { markdownOut: string | null; jsonOut: string | null } {
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  return {
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
    jsonOut: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function auditTemplate(overlay: OverlayDb): TenantWizardTemplate {
  return {
    id: "tpl-concurrency-audit",
    workspaceId: "ws-concurrency-audit",
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: overlay,
    presetId: null,
    canonicalData: { category: "mountain", duration: "single", title: "Concurrency baseline" },
    wizardContractVersion: 1,
    formProfileVersion: 1,
  };
}

function overlayFromForm(
  values: TourWizardTemplateBuilderFormValues,
): OverlayDb {
  return buildTourWizardTemplatePayloadFromForm(values, [...FIELD_PATHS], {
    canonicalData: { category: "mountain", duration: "single", title: "Concurrency baseline" },
  }).fieldRulesOverlay as OverlayDb;
}

function setOverlayRow(
  values: TourWizardTemplateBuilderFormValues,
  path: string,
  patch: { visibility?: string; required?: string },
): void {
  values.fieldRulesOverlay[path] = {
    visibility: patch.visibility ?? values.fieldRulesOverlay[path]?.visibility ?? "",
    required: patch.required ?? values.fieldRulesOverlay[path]?.required ?? "",
  };
}

/** Mirrors API `updateForWorkspace`: full JSONB replace of `field_rules_overlay`. */
async function applyPatchReplace(
  store: { fieldRulesOverlay: OverlayDb },
  overlay: OverlayDb,
  delayMs: number,
): Promise<void> {
  await sleep(delayMs);
  store.fieldRulesOverlay = overlay;
}

function diffLostEdits(expected: OverlayDb, actual: OverlayDb): string[] {
  const lost: string[] = [];
  for (const [path, row] of Object.entries(expected)) {
    const actualRow = actual[path];
    if (!actualRow) {
      lost.push(`${path} (missing)`);
      continue;
    }
    if (row.visibility !== actualRow.visibility || row.required !== actualRow.required) {
      lost.push(
        `${path} (expected visibility=${row.visibility ?? "—"} required=${row.required ?? "—"}, got visibility=${actualRow.visibility ?? "—"} required=${actualRow.required ?? "—"})`,
      );
    }
  }
  return lost;
}

async function runRaceScenario(input: {
  id: string;
  label: string;
  saveADelayMs: number;
  saveBDelayMs: number;
}): Promise<RaceScenarioResult> {
  const baseTemplate = auditTemplate({
    title: { visibility: "always", required: "optional" },
    "program.shortDescription": { visibility: "active", required: "optional" },
  });

  const formA = buildTourWizardTemplateBuilderDefaults(baseTemplate, [...FIELD_PATHS]);
  setOverlayRow(formA, "title", { visibility: "hidden" });

  const formB = buildTourWizardTemplateBuilderDefaults(baseTemplate, [...FIELD_PATHS]);
  setOverlayRow(formB, "program.shortDescription", { required: "required" });

  const overlayA = overlayFromForm(formA);
  const overlayB = overlayFromForm(formB);

  const expectedIfSerialized: OverlayDb = {
    title: { visibility: "hidden", required: "optional" },
    "program.shortDescription": { visibility: "active", required: "required" },
  };

  const store = {
    fieldRulesOverlay: { ...baseTemplate.fieldRulesOverlay } as OverlayDb,
  };

  const saveA = applyPatchReplace(store, overlayA, input.saveADelayMs);
  const saveB = applyPatchReplace(store, overlayB, input.saveBDelayMs);
  await Promise.all([saveA, saveB]);

  const firstCompletes = input.saveBDelayMs < input.saveADelayMs ? "save_b" : "save_a";
  const lostEdits = diffLostEdits(expectedIfSerialized, store.fieldRulesOverlay);

  return {
    id: input.id,
    label: input.label,
    firstCompletes,
    persistedOverlay: store.fieldRulesOverlay,
    expectedIfSerialized,
    lostEdits,
    pass: lostEdits.length === 0,
  };
}

/** Models two `mutateAsync` calls with no in-flight guard (pre-fix behavior). */
async function simulateDoubleMutateUnlocked(): Promise<{
  bothStartedBeforePending: boolean;
  concurrentInFlight: number;
}> {
  let inFlight = 0;
  let maxConcurrent = 0;

  const mutateAsync = async (): Promise<void> => {
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await sleep(30);
    inFlight -= 1;
  };

  const submit = async (): Promise<void> => {
    await mutateAsync();
  };

  await Promise.all([submit(), submit()]);

  return {
    bothStartedBeforePending: maxConcurrent >= 2,
    concurrentInFlight: maxConcurrent,
  };
}

/** Models `submit("save")` with `isSavingRef` + `updateMutation.isPending` guard. */
async function simulateDoubleSubmitWithRefGuard(): Promise<{
  secondCallIgnored: boolean;
  concurrentInFlight: number;
}> {
  let isSavingRef = false;
  let isPending = false;
  let inFlight = 0;
  let maxConcurrent = 0;
  let startedCount = 0;

  const mutateAsync = async (): Promise<void> => {
    isPending = true;
    inFlight += 1;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await sleep(30);
    inFlight -= 1;
    isPending = inFlight > 0;
  };

  const submitSave = async (): Promise<void> => {
    if (isSavingRef || isPending) {
      return;
    }
    isSavingRef = true;
    startedCount += 1;
    try {
      await mutateAsync();
    } finally {
      isSavingRef = false;
    }
  };

  await Promise.all([submitSave(), submitSave()]);

  return {
    secondCallIgnored: startedCount === 1,
    concurrentInFlight: maxConcurrent,
  };
}

function scanBuilderFormGuards(source: string): ClientGuardScan {
  return {
    submitChecksInFlightRef: /isSavingRef\.current\s*\|\|\s*updateMutation\.isPending/.test(source),
    submitChecksIsPending: /updateMutation\.isPending/.test(source),
    isSavingStateAndRef: /isSavingRef/.test(source) && /setIsSaving\(true\)/.test(source),
    submitSaveViaHandleSubmit: /handleSubmit\(submitSave\)/.test(source),
    uiDisablesOnIsSaveBusy: /disabled=\{isSaveBusy\}/.test(source),
    mutationDedupesConcurrentCalls: false,
    inFlightAbortOrVersionToken: false,
  };
}

function formatMarkdown(report: ConcurrencyAuditReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Concurrency Audit — Settings Template Builder Save (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter web audit:template-builder-save-concurrency\` (\`apps/web/scripts/audit-template-builder-save-concurrency.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Save entrypoint:** \`${report.saveEntrypoint}\``,
    "",
    "### Client guards (static)",
    "",
    "| Guard | Present |",
    "|-------|---------|",
    `| \`submit\` checks \`isSavingRef\` + \`isPending\` before PATCH | ${report.clientGuards.submitChecksInFlightRef ? "yes" : "**no**"} |`,
    `| \`isSaving\` state + ref for save mode | ${report.clientGuards.isSavingStateAndRef ? "yes" : "**no**"} |`,
    `| Save via \`handleSubmit(submitSave)\` | ${report.clientGuards.submitSaveViaHandleSubmit ? "yes" : "no"} |`,
    `| Save/Publish disabled while \`isSaveBusy\` | ${report.clientGuards.uiDisablesOnIsSaveBusy ? "yes" : "**no**"} |`,
    `| TanStack \`useMutation\` dedupes concurrent \`mutateAsync\` | ${report.clientGuards.mutationDedupesConcurrentCalls ? "yes" : "**no**"} |`,
    `| In-flight abort / If-Match version token | ${report.clientGuards.inFlightAbortOrVersionToken ? "yes" : "**no**"} |`,
    "",
    "### API persistence",
    "",
    "| Behavior | Value |",
    "|----------|-------|",
    `| \`field_rules_overlay\` server merge | ${report.apiPersistence.fieldRulesOverlayMerge ? "yes" : "**no (full replace)**"} |`,
    `| \`field_rules_overlay\` full replace on PATCH | ${report.apiPersistence.fieldRulesOverlayReplace ? "yes" : "no"} |`,
    `| \`canonical_data\` full replace on PATCH | ${report.apiPersistence.canonicalDataReplace ? "yes" : "no"} |`,
    "",
    `**Payload per save:** ${report.payloadShape}`,
    "",
    "### Double-save simulation",
    "",
    `Without ref guard (legacy): max concurrent PATCH handlers **${report.doubleMutateUnlocked.concurrentInFlight}**`,
    `With \`isSavingRef\` guard (current \`submit\`): second call ignored **${report.doubleSubmitWithRefGuard.secondCallIgnored ? "yes" : "no"}**, max concurrent **${report.doubleSubmitWithRefGuard.concurrentInFlight}**`,
    "",
    "### Overlay race scenarios (API full-replace; if concurrent PATCHes bypass client lock)",
    "",
    "| Scenario | Finishes first | Lost edits | Pass |",
    "|----------|----------------|------------|------|",
  ];

  for (const row of report.raceScenarios) {
    lines.push(
      `| ${row.label} | ${row.firstCompletes} | ${row.lostEdits.length ? row.lostEdits.join("; ") : "—"} | ${row.pass ? "yes" : "**no**"} |`,
    );
  }

  lines.push("", "### Static findings", "");
  for (const finding of report.staticFindings) {
    lines.push(`- ${finding}`);
  }

  lines.push(
    "",
    "### Verdict",
    "",
    report.pass
      ? "**PASS:** `submit` / `submitSave` locks via `isSavingRef` + `isSaveBusy`; rapid double Save does not start overlapping PATCHes. API still full-replaces `field_rules_overlay` and `canonical_data` — concurrent PATCHes (if any) would be last-write-wins (see overlay race table)."
      : "**FAIL:** Missing in-flight guard or double-save still starts concurrent PATCHes; server full-replace → last-write-wins corruption risk for `field_rules_overlay` and `canonical_data`.",
    "",
    "**Artifact:** `apps/web/reports/template-builder-save-concurrency.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Concurrency Audit — Settings Template Builder Save";
  let body: string;
  if (existing.includes(marker)) {
    const start = existing.indexOf(marker);
    const afterMarker = existing.slice(start + marker.length);
    const nextH2 = afterMarker.search(/\n## /);
    const end = nextH2 >= 0 ? start + marker.length + nextH2 : existing.length;
    body = `${existing.slice(0, start).replace(/\n+$/, "")}${section}${existing.slice(end)}`;
  } else {
    body = `${existing.replace(/\n+$/, "")}${section}`;
  }
  fs.writeFileSync(resolved, body, "utf8");
  console.log(`Appended concurrency section to ${resolved}`);
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));

  const builderSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "app/(app)/settings/tour-wizard-template/tour-wizard-template-builder-form.tsx",
    ),
    "utf8",
  );
  const clientGuards = scanBuilderFormGuards(builderSource);

  const doubleMutateUnlocked = await simulateDoubleMutateUnlocked();
  const doubleSubmitWithRefGuard = await simulateDoubleSubmitWithRefGuard();

  const raceScenarios = await Promise.all([
    runRaceScenario({
      id: "overlay_b_finishes_first",
      label: "Save A (title→hidden) slow; Save B (program→required) fast",
      saveADelayMs: 80,
      saveBDelayMs: 10,
    }),
    runRaceScenario({
      id: "overlay_a_finishes_first",
      label: "Save A fast; Save B slow (reverse ordering)",
      saveADelayMs: 10,
      saveBDelayMs: 80,
    }),
  ]);

  const staticFindings = [
    "No `handleSave` symbol; save path is `submitSave` → `submit(\"save\")` from `handleSubmit(submitSave)` and Publish `onClick`.",
    clientGuards.submitChecksInFlightRef
      ? "`submit(\"save\")` returns early when `isSavingRef.current || updateMutation.isPending` (synchronous ref lock)."
      : "**Missing** in-flight ref guard inside `submit`.",
    clientGuards.uiDisablesOnIsSaveBusy
      ? "Save/Publish use `disabled={isSaveBusy}` where `isSaveBusy = isSaving || updateMutation.isPending`."
      : "Save button not tied to `isSaveBusy`.",
    "`useUpdateTourWizardTemplate` uses bare `useMutation` + `mutateAsync` (no dedupe queue).",
    "Each save builds full `fieldRulesOverlay` + full `canonicalData` snapshots (not field deltas).",
    "`TourWizardTemplateSettingsService.updateForWorkspace` replaces entire `field_rules_overlay` and `canonical_data` JSONB columns.",
    `Unlocked double-save simulation: max concurrent = ${doubleMutateUnlocked.concurrentInFlight}. With ref guard: started=${doubleSubmitWithRefGuard.secondCallIgnored ? 1 : 2}, max concurrent = ${doubleSubmitWithRefGuard.concurrentInFlight}.`,
    "If two PATCHes complete, overlay race scenarios show last-write-wins loss on the non-winning snapshot.",
  ];

  const clientSerialized =
    clientGuards.submitChecksInFlightRef &&
    clientGuards.isSavingStateAndRef &&
    doubleSubmitWithRefGuard.secondCallIgnored &&
    doubleSubmitWithRefGuard.concurrentInFlight < 2;

  const report: ConcurrencyAuditReport = {
    generatedAt: new Date().toISOString(),
    saveEntrypoint:
      "TourWizardTemplateBuilderForm.submit / submitSave → applyClientValidation → buildTourWizardTemplatePayloadFromForm → useUpdateTourWizardTemplate.mutateAsync → PATCH /api/settings/tour-wizard-template",
    clientGuards,
    apiPersistence: {
      fieldRulesOverlayMerge: false,
      fieldRulesOverlayReplace: true,
      canonicalDataReplace: true,
    },
    payloadShape:
      "Full `fieldRulesOverlay` snapshot from current RHF overlay form + full `canonicalData` from wizard form (same request).",
    raceScenarios,
    doubleMutateUnlocked,
    doubleSubmitWithRefGuard,
    staticFindings,
    pass: clientSerialized,
  };

  const jsonResolved = path.resolve(
    jsonOut ?? path.join(process.cwd(), "reports", "template-builder-save-concurrency.json"),
  );
  fs.mkdirSync(path.dirname(jsonResolved), { recursive: true });
  fs.writeFileSync(jsonResolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${jsonResolved}`);

  const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
  appendMarkdown(mdTarget, formatMarkdown(report));

  if (!report.pass) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
