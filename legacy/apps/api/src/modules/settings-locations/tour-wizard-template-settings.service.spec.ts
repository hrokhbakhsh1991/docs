import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";

import { DataCorruptionError } from "../../common/errors/data-corruption.exception";
import { TemplateOrchestratorService } from "../draft-engine/services/template-orchestrator.service";
import type { LoggerService } from "../../common/logger/logger.service";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { DraftEngineFacade } from "../draft-engine/draft-engine.facade";
import type { WorkspaceSettingsRepositoryPort } from "./domain/ports/workspace-settings-repository.port";
import type { WorkspaceTourWizardTemplateRecord } from "./domain/workspace-catalog.records";
import { TourWizardTemplateSettingsService } from "./tour-wizard-template-settings.service";

const WORKSPACE = "00000000-0000-4000-8000-000000000abc";
const USER = "00000000-0000-4000-8000-000000000def";
const TEMPLATE_ID = "00000000-0000-4000-8000-000000000111";

function makeHydratableTemplateRow(
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
      title: "Template tour",
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

function makeService(input: {
  row?: WorkspaceTourWizardTemplateRecord | null;
  templateOrchestrator?: TemplateOrchestratorService;
  upsertResult?: Awaited<ReturnType<DraftEngineFacade["upsertForMember"]>>;
  onSaveTourWizardTemplate?: (row: WorkspaceTourWizardTemplateRecord) => void;
}) {
  const warnings: Array<{ message: string; meta: Record<string, unknown> }> = [];
  const errors: Array<{ message: string; meta: Record<string, unknown> }> = [];

  const settingsRepository = {
    findTourWizardTemplateByWorkspace: async () => input.row ?? null,
    saveTourWizardTemplate: async (row: WorkspaceTourWizardTemplateRecord) => {
      input.onSaveTourWizardTemplate?.(row);
      return row;
    },
  } as unknown as WorkspaceSettingsRepositoryPort;

  const requestContext = {
    resolveEffectiveTenantId: () => WORKSPACE,
    getUserId: () => USER,
    tryGetCorrelationId: () => "corr-test",
    tryGetRequestId: () => "req-test",
  } as unknown as RequestContextService;

  const templateOrchestrator = input.templateOrchestrator ?? new TemplateOrchestratorService();

  const draftEngineFacade = {
    upsertForMember: async () =>
      input.upsertResult ?? {
        data: { form: { basicInfo: { title: "Template tour" } }, currentStepIndex: 0 },
        version: 1,
        schemaVersion: 1,
        lastModified: 1_710_000_000_001,
      },
  } as unknown as DraftEngineFacade;

  const logger = {
    warn: (message: string, meta: Record<string, unknown> = {}) => {
      warnings.push({ message, meta });
    },
    error: (message: string, meta: Record<string, unknown> = {}) => {
      errors.push({ message, meta });
    },
  } as unknown as LoggerService;

  const service = new TourWizardTemplateSettingsService(
    settingsRepository,
    requestContext,
    templateOrchestrator,
    draftEngineFacade,
    logger,
  );

  return { service, warnings, errors, draftEngineFacade, templateOrchestrator };
}

test("instantiateForWorkspace returns orchestrator draftState without seeding by default", async () => {
  const { service } = makeService({ row: makeHydratableTemplateRow() });
  const result = await service.instantiateForWorkspace();

  assert.equal(result.success, true);
  assert.equal(result.seededDraft, false);
  assert.equal(result.draftState.version, 0);
  assert.equal(result.payload?.title, "Template tour");
});

test("instantiateForWorkspace seeds denali-create draft when seedDraft is true", async () => {
  let upsertDraftKey: string | undefined;
  const { service } = makeService({
    row: makeHydratableTemplateRow(),
    upsertResult: {
      data: { form: { basicInfo: { title: "Seeded" } }, currentStepIndex: 0 },
      version: 1,
      schemaVersion: 1,
      lastModified: 1_710_000_000_002,
    },
  });

  (service as unknown as { draftEngineFacade: DraftEngineFacade }).draftEngineFacade.upsertForMember =
    async (_tenantId, draftKey) => {
      upsertDraftKey = draftKey;
      return {
        data: { form: { basicInfo: { title: "Seeded" } }, currentStepIndex: 0 },
        version: 1,
        schemaVersion: 1,
        lastModified: 1_710_000_000_002,
      };
    };

  const result = await service.instantiateForWorkspace({ seedDraft: true });

  assert.equal(upsertDraftKey, "denali-create");
  assert.equal(result.seededDraft, true);
  assert.equal(result.draftState.version, 1);
});

test("instantiateForWorkspace throws NotFound when template row is missing", async () => {
  const { service } = makeService({ row: null });

  await assert.rejects(
    () => service.instantiateForWorkspace(),
    (err: unknown) => err instanceof NotFoundException,
  );
});

test("instantiateForWorkspace throws DataCorruptionError when top-level fossil keys are present", async () => {
  const row = makeHydratableTemplateRow();
  row.canonicalData = {
    category: "mountain",
    duration: "single",
    title: "Legacy row title",
    program: { shortDescription: "Short", themeIds: [] },
    tripDetails: { overview: { peakHeight: 5610 } },
    overview: { peakHeight: 4100 },
  } as unknown as WorkspaceTourWizardTemplateRecord["canonicalData"];

  const { service, warnings } = makeService({ row });

  await assert.rejects(
    () => service.instantiateForWorkspace(),
    (err: unknown) => err instanceof DataCorruptionError,
  );

  assert.equal(
    warnings.some(
      (entry) =>
        entry.message === "template_canonical_top_level_fossil_discarded" &&
        entry.meta.discardedKey === "tripDetails",
    ),
    false,
    "fossil keys must fail before strip logging",
  );
});

test("instantiateForWorkspace throws DataCorruptionError when nested canonical is invalid after strip", async () => {
  const row = makeHydratableTemplateRow();
  row.canonicalData = {
    overview: { denaliTourKind: "mountain_day" },
  } as unknown as WorkspaceTourWizardTemplateRecord["canonicalData"];

  const { service, errors } = makeService({ row });

  await assert.rejects(
    () => service.instantiateForWorkspace(),
    (err: unknown) => {
      assert.ok(err instanceof DataCorruptionError);
      const response = err.getResponse() as {
        error?: {
          code?: string;
          details?: {
            templateId?: string;
            workspaceId?: string;
            issues?: Array<{ path: string; message: string }>;
          };
        };
      };
      assert.equal(response.error?.code, "TEMPLATE_CANONICAL_DATA_CORRUPT");
      assert.equal(response.error?.details?.templateId, TEMPLATE_ID);
      assert.equal(response.error?.details?.workspaceId, WORKSPACE);
      assert.ok(
        response.error?.details?.issues?.some((issue) =>
          issue.path.includes("denaliTourKind"),
        ),
      );
      return true;
    },
  );

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.message, "tour_wizard_template_canonical_corrupt");
});

test("instantiateForWorkspace regression: fossil-only canonical fails before orchestrator", async () => {
  const row = makeHydratableTemplateRow();
  row.canonicalData = {
    tripDetails: { unknownKey: true },
  } as unknown as WorkspaceTourWizardTemplateRecord["canonicalData"];

  const { service } = makeService({ row });

  await assert.rejects(
    () => service.instantiateForWorkspace(),
    (err: unknown) => err instanceof DataCorruptionError,
  );
});

test("instantiateForWorkspace succeeds with empty canonical via orchestrator registry defaults", async () => {
  const provisionedAt = new Date("2024-06-01T12:00:00.000Z");
  const row = makeHydratableTemplateRow({
    canonicalData: {} as WorkspaceTourWizardTemplateRecord["canonicalData"],
    createdAt: provisionedAt,
    updatedAt: provisionedAt,
  });

  const savedRows: WorkspaceTourWizardTemplateRecord[] = [];
  const infos: Array<{ message: string; meta: Record<string, unknown> }> = [];

  const settingsRepository = {
    findTourWizardTemplateByWorkspace: async () => row,
    saveTourWizardTemplate: async (saved: WorkspaceTourWizardTemplateRecord) => {
      savedRows.push(saved);
      return saved;
    },
  } as unknown as WorkspaceSettingsRepositoryPort;

  const requestContext = {
    resolveEffectiveTenantId: () => WORKSPACE,
    getUserId: () => USER,
    tryGetCorrelationId: () => "corr-test",
    tryGetRequestId: () => "req-test",
  } as unknown as RequestContextService;

  const logger = {
    info: (message: string, meta: Record<string, unknown> = {}) => {
      infos.push({ message, meta });
    },
    warn: () => undefined,
    error: () => undefined,
  } as unknown as LoggerService;

  const service = new TourWizardTemplateSettingsService(
    settingsRepository,
    requestContext,
    new TemplateOrchestratorService(),
    {
      upsertForMember: async () => ({
        data: { form: { basicInfo: { title: "New Tour" } }, currentStepIndex: 0 },
        version: 1,
        schemaVersion: 1,
        lastModified: 1_710_000_000_001,
      }),
    } as unknown as DraftEngineFacade,
    logger,
  );

  const result = await service.instantiateForWorkspace();

  assert.equal(result.success, true);
  assert.equal(savedRows.length, 0);
  assert.equal(
    infos.some((entry) => entry.message === "tour_wizard_template_minimal_seed_applied"),
    false,
  );
  assert.ok(result.draftState.data.form);
});

test("instantiateForWorkspace regression: empty canonical after user save still orchestrates", async () => {
  const row = makeHydratableTemplateRow();
  row.canonicalData = {} as WorkspaceTourWizardTemplateRecord["canonicalData"];
  row.createdAt = new Date("2024-06-01T12:00:00.000Z");
  row.updatedAt = new Date("2024-06-02T12:00:00.000Z");

  let orchestratorCalled = false;
  const templateOrchestrator = {
    createDraftFromTemplate: async () => {
      orchestratorCalled = true;
      return { success: true, payload: {}, draftState: { data: {}, version: 0, schemaVersion: 1, lastModified: 0 } };
    },
  } as unknown as TemplateOrchestratorService;

  const { service } = makeService({ row, templateOrchestrator });

  const result = await service.instantiateForWorkspace();

  assert.equal(result.success, true);
  assert.equal(orchestratorCalled, true);
});

test("instantiateForWorkspace throws DataCorruptionError when orchestrator reports canonical_validation failure", async () => {
  const row = makeHydratableTemplateRow();
  const templateOrchestrator = {
    createDraftFromTemplate: async () => ({
      success: false,
      payload: {},
      draftState: {
        data: {},
        version: 0,
        schemaVersion: 1,
        lastModified: 1_710_000_000_000,
      },
      failureKind: "canonical_validation" as const,
      validationIssues: [{ path: "overview.denaliTourKind", message: "Unrecognized key" }],
      errors: ["overview.denaliTourKind: Unrecognized key"],
    }),
  } as unknown as TemplateOrchestratorService;

  const { service, errors } = makeService({ row, templateOrchestrator });

  await assert.rejects(
    () => service.instantiateForWorkspace(),
    (err: unknown) => err instanceof DataCorruptionError,
  );

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.message, "tour_wizard_template_canonical_corrupt");
  assert.equal(errors[0]?.meta.errorCode, "TEMPLATE_CANONICAL_DATA_CORRUPT");
  assert.equal(errors[0]?.meta.correlationId, "corr-test");
});

test("updateForWorkspace logs publish rejection before validation exception", async () => {
  const row = makeHydratableTemplateRow();
  row.canonicalData = {
    category: "mountain",
    duration: "single",
    title: "Draft-only tour title",
  };

  const savedRows: WorkspaceTourWizardTemplateRecord[] = [];
  const settingsRepository = {
    findTourWizardTemplateByWorkspace: async () => row,
    saveTourWizardTemplate: async (input: WorkspaceTourWizardTemplateRecord) => {
      savedRows.push(input);
      return input;
    },
  } as unknown as WorkspaceSettingsRepositoryPort;

  const warnings: Array<{ message: string; meta: Record<string, unknown> }> = [];
  const logger = {
    warn: (message: string, meta: Record<string, unknown> = {}) => {
      warnings.push({ message, meta });
    },
  } as unknown as LoggerService;

  const service = new TourWizardTemplateSettingsService(
    settingsRepository,
    {
      resolveEffectiveTenantId: () => WORKSPACE,
      getUserId: () => USER,
    } as unknown as RequestContextService,
    new TemplateOrchestratorService(),
    {} as DraftEngineFacade,
    logger,
  );

  await assert.rejects(
    () =>
      service.updateForWorkspace({
        publish: true,
      }),
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      return true;
    },
  );

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, "tour_wizard_template_publish_rejected");
  assert.equal(warnings[0]?.meta.workspaceId, WORKSPACE);
  assert.equal(warnings[0]?.meta.templateId, TEMPLATE_ID);
  assert.ok(Array.isArray(warnings[0]?.meta.errors));
  assert.equal(savedRows.length, 0);
});
