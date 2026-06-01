/**
 * Schema-resilience audit: broken canonical JSON vs denaliCanonicalTemplateDataSchema
 * and {@link resolveStoredTemplateCanonical} gate before orchestrator hydration.
 *
 * Usage:
 *   pnpm --filter @apps/api audit:template-schema-resilience
 *   pnpm --filter @apps/api audit:template-schema-resilience -- --markdown-out=../../audit-report.md
 */
import fs from "node:fs";
import path from "node:path";

import { denaliTemplateOrchestratorFactory } from "@repo/denali-domain";
import { resolveStoredTemplateCanonical } from "@repo/types/denali";

import { DataCorruptionError } from "../common/errors/data-corruption.exception";
import type { DraftEngineFacade } from "../modules/draft-engine/draft-engine.facade";
import { TemplateOrchestratorService } from "../modules/draft-engine/services/template-orchestrator.service";
import type { WorkspaceSettingsRepositoryPort } from "../modules/settings-locations/domain/ports/workspace-settings-repository.port";
import type { WorkspaceTourWizardTemplateRecord } from "../modules/settings-locations/domain/workspace-catalog.records";
import { TourWizardTemplateSettingsService } from "../modules/settings-locations/tour-wizard-template-settings.service";
import type { LoggerService } from "../common/logger/logger.service";
import type { RequestContextService } from "../common/request-context/request-context.service";
import { emitScriptInfo } from "./script-log";

const WORKSPACE = "00000000-0000-4000-8000-000000000abc";
const TEMPLATE_ID = "00000000-0000-4000-8000-000000000111";
const VALID_DESTINATION = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const BROKEN_MARKER_TITLE = "__SCHEMA_BROKEN_SHOULD_NOT_HYDRATE__";

type BrokenCase = {
  id: string;
  label: string;
  canonicalData: unknown;
  expectRejected: boolean;
};

type CaseOutcome = {
  id: string;
  label: string;
  expectRejected: boolean;
  resolverRejected: boolean;
  resolverIssuePaths: string[];
  orchestratorSuccess: boolean;
  orchestratorFailureKind: string | null;
  orchestratorReachedHydration: boolean;
  pass: boolean;
};

type SchemaResilienceReport = {
  generatedAt: string;
  schema: string;
  resolver: string;
  orchestratorGate: string;
  serviceGate: string;
  cases: CaseOutcome[];
  serviceInstantiateProbe: {
    brokenRowRejected: boolean;
    orchestratorInvoked: boolean;
    errorCode: string | null;
  };
  summary: {
    total: number;
    rejectedAsExpected: number;
    incorrectlyAccepted: number;
    pass: boolean;
  };
};

function parseArgs(argv: string[]): { markdownOut: string | null; jsonOut: string | null } {
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  return {
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
    jsonOut: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
  };
}

function buildBrokenCases(): BrokenCase[] {
  return [
    {
      id: "valid_partial_control",
      label: "Positive control: valid partial canonical",
      canonicalData: {
        category: "mountain",
        duration: "single",
        title: "Schema audit OK",
        destinationId: VALID_DESTINATION,
      },
      expectRejected: false,
    },
    {
      id: "root_not_object",
      label: "Root canonicalData is array",
      canonicalData: [{ category: "mountain" }],
      expectRejected: true,
    },
    {
      id: "duration_wrong_type",
      label: "duration numeric instead of enum string",
      canonicalData: { category: "mountain", duration: -1, title: BROKEN_MARKER_TITLE },
      expectRejected: true,
    },
    {
      id: "duration_invalid_enum",
      label: "duration invalid enum (single_day)",
      canonicalData: { category: "mountain", duration: "single_day", title: BROKEN_MARKER_TITLE },
      expectRejected: true,
    },
    {
      id: "category_invalid_enum",
      label: "category invalid enum (volcano)",
      canonicalData: { category: "volcano", duration: "single", title: BROKEN_MARKER_TITLE },
      expectRejected: true,
    },
    {
      id: "capacity_max_wrong_type",
      label: "capacityMax string instead of int",
      canonicalData: { capacityMax: "twenty", title: BROKEN_MARKER_TITLE },
      expectRejected: true,
    },
    {
      id: "transport_nested_invalid_enum",
      label: "transport.mode deep-nested invalid enum",
      canonicalData: {
        transport: { mode: "helicopter" },
        title: BROKEN_MARKER_TITLE,
      },
      expectRejected: true,
    },
    {
      id: "program_theme_invalid_uuid",
      label: "program.themeIds invalid UUID element",
      canonicalData: {
        program: { themeIds: ["not-a-uuid"], shortDescription: "x" },
        title: BROKEN_MARKER_TITLE,
      },
      expectRejected: true,
    },
    {
      id: "program_difficulty_wrong_type",
      label: "program.difficultyLevel string instead of number",
      canonicalData: {
        program: { difficultyLevel: "hard", shortDescription: "x" },
        title: BROKEN_MARKER_TITLE,
      },
      expectRejected: true,
    },
    {
      id: "program_itinerary_day_wrong_type",
      label: "program.itinerary[].day string instead of int",
      canonicalData: {
        program: {
          itinerary: [{ day: "one", activities: "Hike" }],
          shortDescription: "x",
        },
        title: BROKEN_MARKER_TITLE,
      },
      expectRejected: true,
    },
    {
      id: "photos_invalid_mime",
      label: "photos[].mimeType invalid enum pattern",
      canonicalData: {
        photos: [
          {
            id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
            url: "https://cdn.example.test/x.jpg",
            filename: "x.jpg",
            size: 100,
            mimeType: "image/gif",
            uploadedAt: "2026-05-01T12:00:00.000Z",
          },
        ],
        title: BROKEN_MARKER_TITLE,
      },
      expectRejected: true,
    },
    {
      id: "publish_status_invalid_enum",
      label: "publishStatus invalid enum",
      canonicalData: { publishStatus: "live", title: BROKEN_MARKER_TITLE },
      expectRejected: true,
    },
    {
      id: "unknown_top_level_strict",
      label: "Unknown top-level key (strict schema)",
      canonicalData: { title: "x", smuggledTopLevel: true },
      expectRejected: true,
    },
    {
      id: "unknown_program_nested_strict",
      label: "Unknown nested program key (strict)",
      canonicalData: {
        program: { shortDescription: "ok", rogueNested: true },
        title: BROKEN_MARKER_TITLE,
      },
      expectRejected: true,
    },
    {
      id: "fossil_trip_details_root",
      label: "Fossil tripDetails root (pre-Zod fossil gate)",
      canonicalData: { title: "x", tripDetails: { overview: { peakHeight: 1 } } },
      expectRejected: true,
    },
    {
      id: "start_datetime_unparseable",
      label: "startDateTime unparseable ISO string",
      canonicalData: { startDateTime: "not-a-datetime", title: BROKEN_MARKER_TITLE },
      expectRejected: true,
    },
  ];
}

function extractHydratedTitle(draftState: { data: Record<string, unknown> }): string | undefined {
  const form = draftState.data?.form;
  if (form == null || typeof form !== "object" || Array.isArray(form)) {
    return undefined;
  }
  const title = (form as Record<string, unknown>).basicInfo;
  if (title == null || typeof title !== "object") {
    return undefined;
  }
  const value = (title as Record<string, unknown>).title;
  return typeof value === "string" ? value : undefined;
}

async function runCase(testCase: BrokenCase): Promise<CaseOutcome> {
  const resolved = resolveStoredTemplateCanonical({
    canonicalData: testCase.canonicalData,
    fieldRulesOverlay: {},
  });
  const resolverRejected = !resolved.ok;
  const resolverIssuePaths = resolved.ok ? [] : resolved.issues.map((issue) => issue.path);

  const orchestration = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: WORKSPACE,
    templateId: TEMPLATE_ID,
    canonicalData:
      testCase.canonicalData != null && typeof testCase.canonicalData === "object"
        ? (testCase.canonicalData as Record<string, unknown>)
        : {},
    fieldRulesOverlay: {},
  });

  const orchestratorSuccess = orchestration.success;
  const orchestratorFailureKind = orchestration.failureKind ?? null;
  const hydratedTitle = orchestratorSuccess
    ? extractHydratedTitle(orchestration.draftState)
    : undefined;

  const orchestratorReachedHydration =
    orchestratorSuccess &&
    hydratedTitle != null &&
    hydratedTitle !== "" &&
    hydratedTitle !== BROKEN_MARKER_TITLE;

  const brokenMarkerLeaked =
    testCase.expectRejected &&
    (hydratedTitle === BROKEN_MARKER_TITLE ||
      (orchestratorSuccess && testCase.canonicalData != null &&
        typeof testCase.canonicalData === "object" &&
        (testCase.canonicalData as { title?: string }).title === BROKEN_MARKER_TITLE &&
        hydratedTitle === BROKEN_MARKER_TITLE));

  const pass = testCase.expectRejected
    ? resolverRejected &&
      !orchestratorSuccess &&
      orchestratorFailureKind === "canonical_validation" &&
      !orchestratorReachedHydration &&
      !brokenMarkerLeaked
    : !resolverRejected && orchestratorSuccess;

  return {
    id: testCase.id,
    label: testCase.label,
    expectRejected: testCase.expectRejected,
    resolverRejected,
    resolverIssuePaths,
    orchestratorSuccess,
    orchestratorFailureKind,
    orchestratorReachedHydration,
    pass,
  };
}

async function probeServiceInstantiateGate(): Promise<SchemaResilienceReport["serviceInstantiateProbe"]> {
  let orchestratorInvoked = false;

  const row: WorkspaceTourWizardTemplateRecord = {
    id: TEMPLATE_ID,
    workspaceId: WORKSPACE,
    baseProfile: "general",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: BROKEN_MARKER_TITLE,
    },
    presetId: null,
    wizardContractVersion: 1,
    formProfileVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const settingsRepository = {
    findTourWizardTemplateByWorkspace: async () => row,
  } as unknown as WorkspaceSettingsRepositoryPort;

  const templateOrchestrator = {
    createDraftFromTemplate: async () => {
      orchestratorInvoked = true;
      return { success: true, payload: {}, draftState: { data: {}, version: 0, schemaVersion: 1, lastModified: 0 } };
    },
  } as unknown as TemplateOrchestratorService;

  const service = new TourWizardTemplateSettingsService(
    settingsRepository,
    {
      resolveEffectiveTenantId: () => WORKSPACE,
      getUserId: () => "00000000-0000-4000-8000-000000000def",
      tryGetCorrelationId: () => "corr-schema",
    } as unknown as RequestContextService,
    templateOrchestrator,
    {} as DraftEngineFacade,
    { warn: () => undefined, error: () => undefined } as unknown as LoggerService,
  );

  let brokenRowRejected = false;
  let errorCode: string | null = null;

  try {
    await service.instantiateForWorkspace();
  } catch (err: unknown) {
    if (err instanceof DataCorruptionError) {
      brokenRowRejected = true;
      const response = err.getResponse() as { error?: { code?: string } };
      errorCode = response.error?.code ?? null;
    }
  }

  return {
    brokenRowRejected,
    orchestratorInvoked,
    errorCode,
  };
}

function formatMarkdown(report: SchemaResilienceReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Schema-Resilience Audit — `denaliCanonicalTemplateDataSchema` / `resolveStoredTemplateCanonical` (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter @apps/api audit:template-schema-resilience\` (\`apps/api/src/scripts/audit-template-schema-resilience.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Schema:** \`${report.schema}\``,
    "",
    `**Resolver:** ${report.resolver}`,
    "",
    `**Orchestrator gate:** ${report.orchestratorGate}`,
    "",
    `**Service instantiate gate:** ${report.serviceGate}`,
    "",
    "### Broken-payload matrix",
    "",
    "| Case | Expect reject | Resolver | Orchestrator | Failure kind | Pass |",
    "|------|---------------|----------|--------------|--------------|------|",
  ];

  for (const row of report.cases) {
    lines.push(
      `| ${row.label} | ${row.expectRejected ? "yes" : "no"} | ${row.resolverRejected ? "**reject**" : "accept"} | ${row.orchestratorSuccess ? "success" : "**fail**"} | ${row.orchestratorFailureKind ?? "—"} | ${row.pass ? "**yes**" : "**no**"} |`,
    );
  }

  const failed = report.cases.filter((row) => !row.pass);
  if (failed.length > 0) {
    lines.push("", "**Failed resolver paths:**");
    for (const row of failed) {
      lines.push(`- ${row.id}: ${row.resolverIssuePaths.join(", ") || "(none)"}`);
    }
  }

  lines.push(
    "",
    "### Service `instantiateForWorkspace` probe (broken row)",
    "",
    `Broken canonical rejected before orchestrator: **${report.serviceInstantiateProbe.brokenRowRejected ? "yes" : "no"}** (${report.serviceInstantiateProbe.errorCode ?? "—"})`,
    "",
    `Orchestrator invoked: **${report.serviceInstantiateProbe.orchestratorInvoked ? "yes (FAIL)" : "no"}**`,
    "",
    "### Verdict",
    "",
    report.summary.pass
      ? "**PASS:** `resolveStoredTemplateCanonical` rejects malformed canonical JSON (wrong types, invalid enums, strict unknown keys, fossils) before `DenaliTemplateOrchestratorFactory` hydrates. Factory returns `canonical_validation` failure; API instantiate throws `TEMPLATE_CANONICAL_DATA_CORRUPT` without calling orchestrator."
      : `**FAIL:** ${report.summary.incorrectlyAccepted} case(s) accepted or leaked broken marker into hydration.`,
    "",
    "**Artifact:** `apps/api/reports/template-schema-resilience.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Schema-Resilience Audit — `denaliCanonicalTemplateDataSchema`";
  const trimmed = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).replace(/\n+$/, "")
    : existing.replace(/\n+$/, "");
  fs.writeFileSync(resolved, `${trimmed}${section}`, "utf8");
  emitScriptInfo(`Appended schema-resilience section to ${resolved}`);
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));
  const cases = buildBrokenCases();
  const outcomes: CaseOutcome[] = [];

  for (const testCase of cases) {
    outcomes.push(await runCase(testCase));
  }

  const serviceInstantiateProbe = await probeServiceInstantiateGate();

  const incorrectlyAccepted = outcomes.filter((row) => !row.pass).length;
  const rejectedAsExpected = outcomes.filter((row) => row.pass && row.expectRejected).length;

  const report: SchemaResilienceReport = {
    generatedAt: new Date().toISOString(),
    schema: "denaliCanonicalTemplateDataSchema (strict deep-partial Zod in @repo/types/denali)",
    resolver:
      "resolveStoredTemplateCanonical → fossil/top-level gate → templateToCanonical → validateDenaliCanonicalTemplateData → denaliCanonicalTemplateDataSchema.safeParse",
    orchestratorGate:
      "DenaliTemplateOrchestratorFactory.createDraftFromTemplate calls resolveStoredTemplateCanonical first; hydration runs only when resolved.ok",
    serviceGate:
      "TourWizardTemplateSettingsService.resolveValidatedCanonicalDataOrThrow before templateOrchestrator.createDraftFromTemplate",
    cases: outcomes,
    serviceInstantiateProbe,
    summary: {
      total: outcomes.length,
      rejectedAsExpected,
      incorrectlyAccepted,
      pass:
        incorrectlyAccepted === 0 &&
        serviceInstantiateProbe.brokenRowRejected &&
        !serviceInstantiateProbe.orchestratorInvoked,
    },
  };

  const jsonResolved = path.resolve(
    jsonOut ?? path.join(process.cwd(), "reports", "template-schema-resilience.json"),
  );
  fs.mkdirSync(path.dirname(jsonResolved), { recursive: true });
  fs.writeFileSync(jsonResolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  emitScriptInfo(`Wrote ${jsonResolved}`);

  const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
  appendMarkdown(mdTarget, formatMarkdown(report));

  emitScriptInfo(JSON.stringify(report.summary, null, 2));

  if (!report.summary.pass) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
