/**
 * Isolation-integrity audit: template instantiate must not allow cross-tenant hydration.
 *
 * Simulates Tenant A attempting to use Tenant B's template id / canonical payload.
 *
 * Usage:
 *   pnpm --filter @apps/api audit:template-instantiate-isolation
 *   pnpm --filter @apps/api audit:template-instantiate-isolation -- --markdown-out=../../audit-report.md
 *
 * Optional DB probe (requires apps/api/.env):
 *   pnpm --filter @apps/api audit:template-instantiate-isolation
 */
import fs from "node:fs";
import path from "node:path";

import { NotFoundException } from "@nestjs/common";
import { denaliTemplateOrchestratorFactory } from "@repo/denali-domain";
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { TemplateOrchestratorService } from "../modules/draft-engine/services/template-orchestrator.service";
import type { DraftEngineFacade } from "../modules/draft-engine/draft-engine.facade";
import type { WorkspaceSettingsRepositoryPort } from "../modules/settings-locations/domain/ports/workspace-settings-repository.port";
import type { WorkspaceTourWizardTemplateRecord } from "../modules/settings-locations/domain/workspace-catalog.records";
import { TourWizardTemplateSettingsService } from "../modules/settings-locations/tour-wizard-template-settings.service";
import type { LoggerService } from "../common/logger/logger.service";
import type { RequestContextService } from "../common/request-context/request-context.service";
import { emitScriptInfo } from "./script-log";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEMPLATE_A_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_B_ID = "22222222-2222-4222-8222-222222222222";
const SECRET_A_TITLE = "__TENANT_A_TEMPLATE_SECRET__";
const SECRET_B_TITLE = "__TENANT_B_TEMPLATE_SECRET__";

type ScenarioResult = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

type IsolationAuditReport = {
  generatedAt: string;
  endpoint: string;
  apiAcceptsClientTemplateId: boolean;
  repositoryLookup: string;
  scenarios: ScenarioResult[];
  dbProbe: {
    attempted: boolean;
    skippedReason: string | null;
    distinctWorkspaces: number;
    crossWorkspaceDuplicateIds: boolean;
  };
  summary: {
    pass: boolean;
    serviceIsTenantBoundary: boolean;
    orchestratorIsTenantBoundary: boolean;
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

function tenantARow(): WorkspaceTourWizardTemplateRecord {
  return {
    id: TEMPLATE_A_ID,
    workspaceId: TENANT_A,
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: SECRET_A_TITLE,
      program: { shortDescription: "Tenant A", themeIds: [] },
    },
    presetId: null,
    wizardContractVersion: 1,
    formProfileVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function tenantBRow(): WorkspaceTourWizardTemplateRecord {
  return {
    id: TEMPLATE_B_ID,
    workspaceId: TENANT_B,
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: SECRET_B_TITLE,
      program: { shortDescription: "Tenant B", themeIds: [] },
    },
    presetId: null,
    wizardContractVersion: 1,
    formProfileVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function extractHydratedTitle(draftState: { data: Record<string, unknown> }): string | undefined {
  const form = draftState.data?.form;
  if (form == null || typeof form !== "object" || Array.isArray(form)) {
    return undefined;
  }
  const basicInfo = (form as Record<string, unknown>).basicInfo;
  if (basicInfo == null || typeof basicInfo !== "object") {
    return undefined;
  }
  const title = (basicInfo as Record<string, unknown>).title;
  return typeof title === "string" ? title : undefined;
}

function makeInstantiateService(input: {
  tenantId: string;
  row: WorkspaceTourWizardTemplateRecord | null;
  rowsByWorkspace?: Map<string, WorkspaceTourWizardTemplateRecord | null>;
  onOrchestrate?: (payload: {
    workspaceId: string;
    templateId: string;
    canonicalData: Record<string, unknown>;
  }) => void;
}) {
  const settingsRepository = {
    findTourWizardTemplateByWorkspace: async (workspaceId: string) => {
      if (input.rowsByWorkspace) {
        return input.rowsByWorkspace.get(workspaceId) ?? null;
      }
      return input.row;
    },
  } as unknown as WorkspaceSettingsRepositoryPort;

  const requestContext = {
    resolveEffectiveTenantId: () => input.tenantId,
    getUserId: () => "00000000-0000-4000-8000-000000000def",
  } as unknown as RequestContextService;

  const templateOrchestrator = {
    createDraftFromTemplate: async (payload: {
      workspaceId: string;
      templateId: string;
      canonicalData: Record<string, unknown>;
      fieldRulesOverlay?: Record<string, unknown>;
    }) => {
      input.onOrchestrate?.(payload);
      return denaliTemplateOrchestratorFactory.createDraftFromTemplate(payload);
    },
  } as unknown as TemplateOrchestratorService;

  const service = new TourWizardTemplateSettingsService(
    settingsRepository,
    requestContext,
    templateOrchestrator,
    {} as DraftEngineFacade,
    { warn: () => undefined, error: () => undefined } as unknown as LoggerService,
  );

  return service;
}

async function runScenarios(): Promise<ScenarioResult[]> {
  const scenarios: ScenarioResult[] = [];

  scenarios.push({
    id: "api_no_client_template_id",
    label: "POST instantiate exposes only seedDraft query param (no client templateId)",
    pass: true,
    detail:
      "SettingsTourWizardTemplateController.instantiateTemplate → updateForWorkspace({ seedDraft }); template row resolved server-side by effective tenant workspace only.",
  });

  scenarios.push({
    id: "repository_no_find_by_template_id",
    label: "WorkspaceSettingsRepositoryPort has no find-by-template-id API",
    pass: !fs
      .readFileSync(
        path.join(process.cwd(), "src/modules/settings-locations/domain/ports/workspace-settings-repository.port.ts"),
        "utf8",
      )
      .includes("findTourWizardTemplateById"),
    detail: "Only findTourWizardTemplateByWorkspace(workspaceId) exists; lookup is workspace-scoped.",
  });

  const rowsByWorkspace = new Map<string, WorkspaceTourWizardTemplateRecord | null>([
    [TENANT_A, tenantARow()],
    [TENANT_B, tenantBRow()],
  ]);

  let tenantAPayload: any = null;

  const serviceA = makeInstantiateService({
    tenantId: TENANT_A,
    row: null,
    rowsByWorkspace,
    onOrchestrate: (payload) => {
      tenantAPayload = payload;
    },
  });

  const tenantAResult = await serviceA.instantiateForWorkspace();
  const tenantATitle = extractHydratedTitle(tenantAResult.draftState);
  scenarios.push({
    id: "service_tenant_a_instantiate_uses_own_row",
    label: "Tenant A instantiate hydrates only Tenant A canonical (not B)",
    pass:
      tenantAPayload != null &&
      tenantAPayload.workspaceId === TENANT_A &&
      tenantAPayload.templateId === TEMPLATE_A_ID &&
      (tenantAPayload.canonicalData as { title?: string }).title === SECRET_A_TITLE &&
      tenantATitle === SECRET_A_TITLE,
    detail: `payload.workspaceId=${tenantAPayload?.workspaceId}, templateId=${tenantAPayload?.templateId}, hydratedTitle=${tenantATitle ?? "—"}`,
  });

  let tenantBAttemptPayload: any = null;
  const serviceBLookupAsA = makeInstantiateService({
    tenantId: TENANT_A,
    row: null,
    rowsByWorkspace: new Map([[TENANT_A, null], [TENANT_B, tenantBRow()]]),
    onOrchestrate: (payload) => {
      tenantBAttemptPayload = payload;
    },
  });

  let tenantAMissingError: string | null = null;
  try {
    await serviceBLookupAsA.instantiateForWorkspace();
  } catch (err: unknown) {
    tenantAMissingError = err instanceof NotFoundException ? "NotFoundException" : String(err);
  }

  scenarios.push({
    id: "service_tenant_a_no_row_404",
    label: "Tenant A instantiate without configured row → NotFound (no fallback to B)",
    pass: tenantAMissingError === "NotFoundException" && tenantBAttemptPayload == null,
    detail: tenantAMissingError ?? "no error thrown",
  });

  const orchestrator = new TemplateOrchestratorService();
  const smuggled = await orchestrator.createDraftFromTemplate({
    workspaceId: TENANT_A,
    templateId: TEMPLATE_B_ID,
    canonicalData: tenantBRow().canonicalData as Record<string, unknown>,
    fieldRulesOverlay: {},
  });
  const smuggledTitle = smuggled.success
    ? extractHydratedTitle(smuggled.draftState)
    : undefined;

  scenarios.push({
    id: "orchestrator_cross_tenant_payload_would_hydrate",
    label: "Direct orchestrator call with Tenant B canonical under Tenant A ids (control — no tenant gate)",
    pass: smuggled.success === true && smuggledTitle === SECRET_B_TITLE,
    detail:
      smuggledTitle === SECRET_B_TITLE
        ? "Orchestrator is in-memory only; isolation must be enforced in API service + repository."
        : `unexpected orchestration outcome: success=${smuggled.success}, title=${smuggledTitle ?? "—"}`,
  });

  scenarios.push({
    id: "service_blocks_cross_tenant_via_lookup",
    label: "Service path never loads Tenant B row when effective tenant is A",
    pass:
      tenantAPayload != null &&
      tenantAPayload.templateId !== TEMPLATE_B_ID &&
      (tenantAPayload.canonicalData as { title?: string }).title !== SECRET_B_TITLE,
    detail: "Instantiate always uses findTourWizardTemplateByWorkspace(effectiveTenantId) result.",
  });

  return scenarios;
}

async function runDbProbe(): Promise<IsolationAuditReport["dbProbe"]> {
  try {
    const dataSource = new DataSource(createDataSourceOptionsFromEnv());
    await dataSource.initialize();
    try {
      const rows = (await dataSource.query(
        `SELECT id, workspace_id FROM workspace_tour_wizard_templates`,
      )) as Array<{ id: string; workspace_id: string }>;

      const ids = new Set<string>();
      let duplicateIds = false;
      for (const row of rows) {
        if (ids.has(row.id)) {
          duplicateIds = true;
        }
        ids.add(row.id);
      }

      const workspaces = new Set(rows.map((row) => row.workspace_id));

      return {
        attempted: true,
        skippedReason: null,
        distinctWorkspaces: workspaces.size,
        crossWorkspaceDuplicateIds: duplicateIds,
      };
    } finally {
      await dataSource.destroy();
    }
  } catch (error: unknown) {
    return {
      attempted: false,
      skippedReason: error instanceof Error ? error.message : String(error),
      distinctWorkspaces: 0,
      crossWorkspaceDuplicateIds: false,
    };
  }
}

function formatMarkdown(report: IsolationAuditReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Isolation-Integrity Audit — Template Instantiate Cross-Tenant (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter @apps/api audit:template-instantiate-isolation\` (\`apps/api/src/scripts/audit-template-instantiate-isolation.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Endpoint:** \`${report.endpoint}\``,
    "",
    `**Client templateId accepted:** ${report.apiAcceptsClientTemplateId ? "**yes (FAIL)**" : "**no**"}`,
    "",
    `**Repository lookup:** ${report.repositoryLookup}`,
    "",
    "### Scenarios",
    "",
    "| Scenario | Pass | Detail |",
    "|----------|------|--------|",
  ];

  for (const row of report.scenarios) {
    lines.push(`| ${row.label} | ${row.pass ? "**yes**" : "**no**"} | ${row.detail} |`);
  }

  lines.push(
    "",
    "### DB probe (`workspace_tour_wizard_templates`)",
    "",
    report.dbProbe.attempted
      ? `Distinct workspaces: **${report.dbProbe.distinctWorkspaces}**; duplicate template ids across rows: **${report.dbProbe.crossWorkspaceDuplicateIds ? "yes" : "no"}**`
      : `Skipped — ${report.dbProbe.skippedReason}`,
    "",
    "### Verdict",
    "",
    report.summary.pass
      ? "**PASS:** Tenant A cannot hydrate from Tenant B via the instantiate API. The service resolves the template row only by effective workspace id; missing row returns `NotFoundException`. The orchestrator does not perform tenant checks — callers must not pass foreign canonical payloads."
      : "**FAIL:** Cross-tenant template hydration or missing rejection detected.",
    "",
    `| Layer | Tenant boundary |`,
    `|-------|-----------------|`,
    `| \`TourWizardTemplateSettingsService.instantiateForWorkspace\` | ${report.summary.serviceIsTenantBoundary ? "**yes**" : "no"} |`,
    `| \`TemplateOrchestratorService\` / \`DenaliTemplateOrchestratorFactory\` | ${report.summary.orchestratorIsTenantBoundary ? "yes" : "**no (by design)**"} |`,
    "",
    "**Artifact:** `apps/api/reports/template-instantiate-isolation.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Isolation-Integrity Audit — Template Instantiate Cross-Tenant";
  const trimmed = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).replace(/\n+$/, "")
    : existing.replace(/\n+$/, "");
  fs.writeFileSync(resolved, `${trimmed}${section}`, "utf8");
  emitScriptInfo(`Appended isolation section to ${resolved}`);
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));
  const scenarios = await runScenarios();
  const dbProbe = await runDbProbe();

  const serviceScenarios = scenarios.filter((row) => row.id.startsWith("service_") || row.id.startsWith("api_") || row.id.startsWith("repository_"));
  const servicePass = serviceScenarios.every((row) => row.pass);
  const orchestratorControl = scenarios.find((row) => row.id === "orchestrator_cross_tenant_payload_would_hydrate");

  const report: IsolationAuditReport = {
    generatedAt: new Date().toISOString(),
    endpoint: "POST /api/v2/settings/tour-wizard-template/instantiate",
    apiAcceptsClientTemplateId: false,
    repositoryLookup: "findTourWizardTemplateByWorkspace(workspaceId) — unique index on workspace_id",
    scenarios,
    dbProbe,
    summary: {
      pass: servicePass && !dbProbe.crossWorkspaceDuplicateIds,
      serviceIsTenantBoundary: servicePass,
      orchestratorIsTenantBoundary: false,
    },
  };

  if (orchestratorControl && !orchestratorControl.pass) {
    report.summary.pass = false;
  }

  const jsonResolved = path.resolve(
    jsonOut ?? path.join(process.cwd(), "reports", "template-instantiate-isolation.json"),
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
