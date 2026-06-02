/**
 * API injection audit: PATCH `canonicalData` with valid JSON shape but invalid semantics.
 * Exercises the same path as SettingsTourWizardTemplateController →
 * validateWorkspaceWizardTemplatePayload → validateDenaliCanonicalTemplateData (Zod).
 *
 * Usage:
 *   pnpm --filter @apps/api audit:template-api-injection
 *   pnpm --filter @apps/api audit:template-api-injection -- --markdown-out=../../audit-report.md
 *
 * Optional live HTTP (requires running API + env):
 *   AUDIT_PATCH_BEARER_TOKEN=… AUDIT_TENANT_HOST=tenant.localhost pnpm … audit:template-api-injection
 */
import fs from "node:fs";
import path from "node:path";

import { BadRequestException } from "@nestjs/common";

import { validateWorkspaceWizardTemplatePayload } from "../modules/settings-locations/validate-workspace-wizard-template";
import { TourWizardTemplateSettingsService } from "../modules/settings-locations/tour-wizard-template-settings.service";
import type { WorkspaceSettingsRepositoryPort } from "../modules/settings-locations/domain/ports/workspace-settings-repository.port";
import type { WorkspaceTourWizardTemplateRecord } from "../modules/settings-locations/domain/workspace-catalog.records";
import type { LoggerService } from "../common/logger/logger.service";
import type { RequestContextService } from "../common/request-context/request-context.service";
import type { DraftEngineFacade } from "../modules/draft-engine/draft-engine.facade";
import { TemplateOrchestratorService } from "../modules/draft-engine/services/template-orchestrator.service";
import { emitScriptInfo } from "./script-log";

const WORKSPACE = "00000000-0000-4000-8000-000000000abc";
const TEMPLATE_ID = "00000000-0000-4000-8000-000000000111";

type InjectionCase = {
  id: string;
  label: string;
  body: Record<string, unknown>;
  expectRejected: boolean;
};

type CaseOutcome = {
  id: string;
  label: string;
  expectRejected: boolean;
  validatorRejected: boolean;
  validatorErrorPaths: string[];
  serviceRejected: boolean;
  serviceSaved: boolean;
  serviceErrorCode: string | null;
  pass: boolean;
};

type HttpProbe = {
  attempted: boolean;
  skippedReason: string | null;
  status: number | null;
  errorCode: string | null;
  rejectedInvalidDuration: boolean;
};

type ApiInjectionReport = {
  generatedAt: string;
  endpoint: string;
  validationChain: string;
  dtoLayerNote: string;
  cases: CaseOutcome[];
  httpProbe: HttpProbe;
  summary: {
    total: number;
    rejectedAsExpected: number;
    incorrectlyAccepted: number;
    incorrectlyRejected: number;
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

function makeTemplateRow(
  overrides: Partial<WorkspaceTourWizardTemplateRecord> = {},
): WorkspaceTourWizardTemplateRecord {
  return {
    id: TEMPLATE_ID,
    workspaceId: WORKSPACE,
    baseProfile: "general",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: "Baseline template",
      program: { shortDescription: "Short", themeIds: [] },
    },
    presetId: null,
    wizardContractVersion: 1,
    formProfileVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSettingsService(onSave?: (row: WorkspaceTourWizardTemplateRecord) => void) {
  const row = makeTemplateRow();
  let saveCount = 0;

  const settingsRepository = {
    findTourWizardTemplateByWorkspace: async () => row,
    saveTourWizardTemplate: async (saved: WorkspaceTourWizardTemplateRecord) => {
      saveCount += 1;
      onSave?.(saved);
      return saved;
    },
  } as unknown as WorkspaceSettingsRepositoryPort;

  const requestContext = {
    resolveEffectiveTenantId: () => WORKSPACE,
    getUserId: () => "00000000-0000-4000-8000-000000000def",
  } as unknown as RequestContextService;

  const service = new TourWizardTemplateSettingsService(
    settingsRepository,
    requestContext,
    new TemplateOrchestratorService(),
    {} as DraftEngineFacade,
    { warn: () => undefined, error: () => undefined } as unknown as LoggerService,
  );

  return { service, getSaveCount: () => saveCount };
}

function extractValidationErrorCode(err: unknown): string | null {
  if (!(err instanceof BadRequestException)) {
    return null;
  }
  const response = err.getResponse() as {
    error?: { code?: string; details?: { validationErrors?: Array<{ path: string }> } };
  };
  return response.error?.code ?? null;
}

function buildInjectionCases(): InjectionCase[] {
  return [
    {
      id: "valid_partial_baseline",
      label: "Positive control: valid partial canonical",
      body: { canonicalData: { category: "mountain", duration: "single", title: "Inject audit OK" } },
      expectRejected: false,
    },
    {
      id: "invalid_duration_enum",
      label: "Invalid duration enum string (single_day)",
      body: { canonicalData: { category: "mountain", duration: "single_day", title: "x" } },
      expectRejected: true,
    },
    {
      id: "invalid_duration_negative_number",
      label: "Invalid duration type (numeric -1)",
      body: { canonicalData: { duration: -1, title: "x" } },
      expectRejected: true,
    },
    {
      id: "invalid_category_enum",
      label: "Invalid category enum (volcano)",
      body: { canonicalData: { category: "volcano", duration: "single" } },
      expectRejected: true,
    },
    {
      id: "negative_capacity_max",
      label: "Negative capacityMax",
      body: { canonicalData: { capacityMax: -10 } },
      expectRejected: true,
    },
    {
      id: "zero_capacity_max",
      label: "Zero capacityMax (min 1)",
      body: { canonicalData: { capacityMax: 0 } },
      expectRejected: true,
    },
    {
      id: "negative_program_difficulty",
      label: "program.difficultyLevel below min (0)",
      body: { canonicalData: { program: { difficultyLevel: 0 } } },
      expectRejected: true,
    },
    {
      id: "negative_hiking_hours",
      label: "program.hikingHoursApprox negative",
      body: { canonicalData: { program: { hikingHoursApprox: -3 } } },
      expectRejected: true,
    },
    {
      id: "invalid_transport_mode",
      label: "Invalid transport.mode enum",
      body: { canonicalData: { transport: { mode: "spaceship" } } },
      expectRejected: true,
    },
    {
      id: "invalid_publish_status",
      label: "Invalid publishStatus enum",
      body: { canonicalData: { publishStatus: "published" } },
      expectRejected: true,
    },
    {
      id: "fossil_trip_details_root",
      label: "Fossil tripDetails root key",
      body: { canonicalData: { title: "x", tripDetails: { overview: { peakHeight: 1 } } } },
      expectRejected: true,
    },
    {
      id: "unknown_program_nested_key",
      label: "Unknown nested program key (strict)",
      body: { canonicalData: { program: { shortDescription: "ok", smuggledSlice: true } } },
      expectRejected: true,
    },
    {
      id: "invalid_overlay_visibility",
      label: "Invalid fieldRulesOverlay.visibility enum",
      body: {
        fieldRulesOverlay: { title: { visibility: "sometimes", required: "optional" } },
      },
      expectRejected: true,
    },
    {
      id: "invalid_start_datetime",
      label: "Unparsable startDateTime string",
      body: { canonicalData: { startDateTime: "not-a-datetime" } },
      expectRejected: true,
    },
    {
      id: "invalid_theme_uuid",
      label: "Invalid program.themeIds UUID",
      body: {
        canonicalData: { program: { themeIds: ["not-a-uuid"] } },
      },
      expectRejected: true,
    },
  ];
}

async function runCase(testCase: InjectionCase): Promise<CaseOutcome> {
  const canonicalData = testCase.body.canonicalData;
  const fieldRulesOverlay = testCase.body.fieldRulesOverlay;

  const validation = validateWorkspaceWizardTemplatePayload({
    canonicalData,
    fieldRulesOverlay: fieldRulesOverlay as Record<string, unknown> | undefined,
  });
  const validatorRejected = validation.errors.length > 0;
  const validatorErrorPaths = validation.errors.map((entry) => entry.path);

  const { service, getSaveCount } = makeSettingsService();
  let serviceRejected = false;
  let serviceErrorCode: string | null = null;

  try {
    await service.updateForWorkspace({
      canonicalData: canonicalData as Record<string, unknown> | undefined,
      fieldRulesOverlay: fieldRulesOverlay as Record<string, unknown> | undefined,
    });
  } catch (err: unknown) {
    serviceRejected = true;
    serviceErrorCode = extractValidationErrorCode(err);
  }

  const serviceSaved = getSaveCount() > 0;
  const pass = testCase.expectRejected
    ? validatorRejected && serviceRejected && !serviceSaved
    : !validatorRejected && !serviceRejected && serviceSaved;

  return {
    id: testCase.id,
    label: testCase.label,
    expectRejected: testCase.expectRejected,
    validatorRejected,
    validatorErrorPaths,
    serviceRejected,
    serviceSaved,
    serviceErrorCode,
    pass,
  };
}

async function runHttpProbe(): Promise<HttpProbe> {
  const token = process.env.AUDIT_PATCH_BEARER_TOKEN?.trim();
  const host = process.env.AUDIT_TENANT_HOST?.trim();
  const baseUrl = (process.env.AUDIT_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

  if (!token || !host) {
    return {
      attempted: false,
      skippedReason: "Set AUDIT_PATCH_BEARER_TOKEN and AUDIT_TENANT_HOST for live PATCH probe",
      status: null,
      errorCode: null,
      rejectedInvalidDuration: false,
    };
  }

  const url = `${baseUrl}/api/v2/settings/tour-wizard-template`;
  const payload = {
    canonicalData: {
      category: "mountain",
      duration: "single_day",
      title: "HTTP injection probe",
    },
  };

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Host: host,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string };
    };
    const errorCode = body.error?.code ?? null;
    return {
      attempted: true,
      skippedReason: null,
      status: response.status,
      errorCode,
      rejectedInvalidDuration: response.status === 400 && errorCode === "VALIDATION_FAILED",
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      attempted: true,
      skippedReason: `fetch failed: ${message}`,
      status: null,
      errorCode: null,
      rejectedInvalidDuration: false,
    };
  }
}

function formatMarkdown(report: ApiInjectionReport): string {
  const lines = [
    "",
    "---",
    "",
    "## API Injection Audit — PATCH `tour-wizard-template` / `DenaliCanonicalTemplateData` (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter @apps/api audit:template-api-injection\` (\`apps/api/src/scripts/audit-template-api-injection.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Endpoint:** \`${report.endpoint}\``,
    "",
    `**Validation chain:** ${report.validationChain}`,
    "",
    `**DTO layer:** ${report.dtoLayerNote}`,
    "",
    "### Injection cases (validator + service.updateForWorkspace)",
    "",
    "| Case | Expect reject | Validator | Service PATCH | Saved | Pass |",
    "|------|---------------|-----------|---------------|-------|------|",
  ];

  for (const row of report.cases) {
    lines.push(
      `| ${row.label} | ${row.expectRejected ? "yes" : "no"} | ${row.validatorRejected ? "**reject**" : "accept"} | ${row.serviceRejected ? `**reject** (${row.serviceErrorCode ?? "?"})` : "accept"} | ${row.serviceSaved ? "yes" : "no"} | ${row.pass ? "**yes**" : "**no**"} |`,
    );
  }

  const failed = report.cases.filter((row) => !row.pass);
  if (failed.length > 0) {
    lines.push("", "**Failed case paths (validator):**");
    for (const row of failed) {
      lines.push(`- ${row.id}: ${row.validatorErrorPaths.join(", ") || "(none)"}`);
    }
  }

  lines.push(
    "",
    "### Live HTTP PATCH probe",
    "",
    report.httpProbe.attempted
      ? report.httpProbe.skippedReason
        ? `Attempted but incomplete: ${report.httpProbe.skippedReason}`
        : `Status **${report.httpProbe.status}**, error code **${report.httpProbe.errorCode ?? "—"}**, invalid \`duration: single_day\` rejected: **${report.httpProbe.rejectedInvalidDuration ? "yes" : "no"}**`
      : `Skipped — ${report.httpProbe.skippedReason}`,
    "",
    "### Verdict",
    "",
    report.summary.pass
      ? "**PASS:** Invalid semantic payloads are rejected by `validateDenaliCanonicalTemplateData` (strict Zod); `TourWizardTemplateSettingsService.updateForWorkspace` returns `VALIDATION_FAILED` and does not persist. Nest DTO only checks `@IsObject()` — semantic gate is server-side Zod, not class-validator."
      : `**FAIL:** ${report.summary.incorrectlyAccepted} case(s) silently accepted; ${report.summary.incorrectlyRejected} false reject(s).`,
    "",
    `**Artifact:** \`apps/api/reports/template-api-injection.json\``,
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## API Injection Audit — PATCH `tour-wizard-template`";
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
  emitScriptInfo(`Appended API injection section to ${resolved}`);
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));
  const cases = buildInjectionCases();
  const outcomes: CaseOutcome[] = [];

  for (const testCase of cases) {
    outcomes.push(await runCase(testCase));
  }

  const httpProbe = await runHttpProbe();

  const incorrectlyAccepted = outcomes.filter(
    (row) => row.expectRejected && (!row.validatorRejected || row.serviceSaved),
  ).length;
  const incorrectlyRejected = outcomes.filter(
    (row) => !row.expectRejected && (row.validatorRejected || row.serviceRejected),
  ).length;
  const rejectedAsExpected = outcomes.filter(
    (row) => row.expectRejected && row.validatorRejected && row.serviceRejected && !row.serviceSaved,
  ).length;

  const report: ApiInjectionReport = {
    generatedAt: new Date().toISOString(),
    endpoint: "PATCH /api/v2/settings/tour-wizard-template",
    validationChain:
      "UpdateWorkspaceTourWizardTemplateDto (@IsObject) → validateWorkspaceWizardTemplatePayload → validateDenaliCanonicalTemplateData → denaliCanonicalTemplateDataSchema.safeParse → sanitizeDenaliCanonicalTemplateData on success",
    dtoLayerNote:
      "class-validator does not validate enums, numeric bounds, or nested keys on canonicalData; only JSON object shape.",
    cases: outcomes,
    httpProbe,
    summary: {
      total: outcomes.length,
      rejectedAsExpected,
      incorrectlyAccepted,
      incorrectlyRejected,
      pass: incorrectlyAccepted === 0 && incorrectlyRejected === 0,
    },
  };

  const jsonResolved = path.resolve(
    jsonOut ?? path.join(process.cwd(), "reports", "template-api-injection.json"),
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
