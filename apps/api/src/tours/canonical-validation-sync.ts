import { PlatformWizardEngine } from "@app-tour/platform-core";
import { resolveDenaliWizardDimensionsFromTourKind } from "@app-tour/workspace-denali";
import { filterDenaliCanonicalValidationResult } from "@app-tour/workspace-denali/wizard/validation";
import {
  assertCanonicalDocument,
  CanonicalDocumentValidationError,
  createCanonicalDocument,
  type CanonicalDocument,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { resolveWorkspaceCurrentSchemaVersion } from "../canonical/schema-version-policy";
import { throwSchemaVersionMismatch } from "../canonical/schema-version-mismatch";
import { throwValidationFailure } from "../canonical/validation-failure";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";
import type { CreateTourBody } from "./create-tour.schema";
import {
  enrichStarterDocumentForDenaliOperatorList,
  pickStarterCreateDataForValidation,
  shouldUseStarterValidationForDenaliCreate,
} from "./bridge-denali-operator-create-body";
import { runWorkspaceValidationHooks } from "./run-workspace-validation-hooks";

function readDenaliTourKindFromCanonicalData(
  data: Record<string, unknown> | undefined
): string | undefined {
  if (data == null) {
    return undefined;
  }
  const category = data.category;
  if (typeof category === "string" && category.trim().length > 0) {
    return category.trim();
  }
  return undefined;
}

function resolveValidationDimensions(
  plugin: WorkspacePlugin,
  validationVariant: "default" | "basic",
  data?: Record<string, unknown>
): Record<string, string> {
  const matrix = plugin.ruleSet.matrixDimensions;
  if (matrix.includes("variant")) {
    return { variant: validationVariant };
  }
  if (matrix.includes("category") && matrix.includes("duration")) {
    if (plugin.id === "denali") {
      return resolveDenaliWizardDimensionsFromTourKind(
        readDenaliTourKindFromCanonicalData(data)
      );
    }
    return { category: "mountain", duration: "single_day" };
  }
  const defaultCell = plugin.ruleSet.cells.find(
    (cell) => cell.cellId === plugin.ruleSet.defaultCellId
  );
  if (defaultCell) {
    return { ...defaultCell.dimensions };
  }
  return Object.fromEntries(matrix.map((key) => [key, validationVariant]));
}

export type ValidateBeforePersistInput = {
  readonly body: CreateTourBody;
  readonly tenantId: string;
  readonly workspaceType: string;
  /** RuleContext variant — `default` (advanced) or `basic` (degraded). DEC-014. */
  readonly validationVariant?: "default" | "basic";
};

const DEFAULT_ENGINE_CACHE_SIZE = 8;

type CachedEngine = {
  readonly engine: PlatformWizardEngine;
};

const engineCache = new Map<string, CachedEngine>();
const engineCacheOrder: string[] = [];

function readEngineCacheSize(): number {
  const raw = process.env.P5_VALIDATION_ENGINE_CACHE_SIZE?.trim();
  if (!raw) {
    return DEFAULT_ENGINE_CACHE_SIZE;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_ENGINE_CACHE_SIZE;
}

function engineCacheKey(
  tenantId: string,
  workspaceType: string,
  validationVariant: "default" | "basic"
): string {
  return `${tenantId.trim()}:${workspaceType}:${validationVariant}`;
}

function touchEngineCache(key: string, entry: CachedEngine): PlatformWizardEngine {
  const existingIndex = engineCacheOrder.indexOf(key);
  if (existingIndex >= 0) {
    engineCacheOrder.splice(existingIndex, 1);
  }
  engineCache.set(key, entry);
  engineCacheOrder.push(key);
  const maxSize = readEngineCacheSize();
  while (engineCacheOrder.length > maxSize) {
    const evictKey = engineCacheOrder.shift();
    if (evictKey) {
      engineCache.delete(evictKey);
    }
  }
  return entry.engine;
}

/** Cached per tenant + workspaceType + variant (DEC-030 / HT-04). Engine instances remain stateless. */
export function getOrCreateValidationEngine(
  tenantId: string,
  workspaceType: string,
  validationVariant: "default" | "basic" = "default"
): PlatformWizardEngine {
  const key = engineCacheKey(tenantId, workspaceType, validationVariant);
  const hit = engineCache.get(key);
  if (hit) {
    return touchEngineCache(key, hit);
  }
  const plugin = resolveWorkspacePluginForType(workspaceType);
  const {
    tourList: _tourList,
    tourClone: _tourClone,
    publicCatalog: _publicCatalog,
    ...pluginForEngine
  } = plugin;
  return touchEngineCache(key, { engine: PlatformWizardEngine.create(pluginForEngine) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function defaultCanonicalData(pluginRoots: readonly string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (pluginRoots.includes("basics")) {
    data.basics = { title: "Untitled tour" };
  }
  if (pluginRoots.includes("details")) {
    data.details = { summary: "" };
  }
  return data;
}

/**
 * RULE-003 / RULE-005 — assertCanonicalDocument + validateCanonical before any persist.
 * Sync path — used in worker threads and when {@link P5_VALIDATION_WORKERS_ENABLED}=false.
 */
export function validateCanonicalBeforePersistSync(
  input: ValidateBeforePersistInput
): CanonicalDocument {
  const plugin = resolveWorkspacePluginForType(input.workspaceType);
  const validationVariant = input.validationVariant ?? "default";
  const useStarterValidation = shouldUseStarterValidationForDenaliCreate(
    input.workspaceType,
    input.tenantId,
    input.body
  );
  const validationWorkspaceType = useStarterValidation ? "starter" : input.workspaceType;
  const validationPlugin = useStarterValidation
    ? resolveWorkspacePluginForType("starter")
    : plugin;
  const engine = getOrCreateValidationEngine(
    input.tenantId,
    validationWorkspaceType,
    validationVariant
  );
  const currentSchemaVersion = resolveWorkspaceCurrentSchemaVersion(input.workspaceType);
  const requestedSchemaVersion = input.body.schemaVersion ?? currentSchemaVersion;
  if (requestedSchemaVersion !== currentSchemaVersion) {
    throwSchemaVersionMismatch(requestedSchemaVersion, currentSchemaVersion);
  }

  let document: CanonicalDocument;
  let starterPick: ReturnType<typeof pickStarterCreateDataForValidation> | undefined;
  try {
    const rawCreateData = input.body.data ?? defaultCanonicalData(validationPlugin.wizard.roots);
    starterPick =
      useStarterValidation && isRecord(rawCreateData)
        ? pickStarterCreateDataForValidation(rawCreateData)
        : undefined;
    const createData = starterPick?.createData ?? rawCreateData;

    document = createCanonicalDocument({
      schemaVersion: requestedSchemaVersion,
      roots: input.body.roots ?? [...validationPlugin.wizard.roots],
      data: createData,
    });
  } catch (error) {
    if (error instanceof CanonicalDocumentValidationError) {
      throwValidationFailure(`CANONICAL_VALIDATION_FAILED: ${error.code}: ${error.message}`);
    }
    throw error;
  }

  assertCanonicalDocument(document);

  const result = engine.validateCanonical(document, {
    tenantId: input.tenantId,
    dimensions: resolveValidationDimensions(
      validationPlugin,
      validationVariant,
      document.data as Record<string, unknown>
    ),
  });

  const filteredResult =
    validationPlugin.id === "denali"
      ? filterDenaliCanonicalValidationResult(result, document.data as Record<string, unknown>)
      : result;

  if (!filteredResult.ok) {
    const message = filteredResult.violations.map((v) => v.message).join("; ");
    throwValidationFailure(`CANONICAL_VALIDATION_FAILED: ${message}`);
  }

  const hookViolation = runWorkspaceValidationHooks(validationPlugin, document);
  if (hookViolation != null) {
    throwValidationFailure(
      `CANONICAL_VALIDATION_FAILED: ${hookViolation.code}: ${hookViolation.message}`
    );
  }

  if (useStarterValidation) {
    document = enrichStarterDocumentForDenaliOperatorList(document, {
      category: starterPick?.category,
    });
  }

  return document;
}

/** Test-only — clear engine LRU between cases. */
export function resetValidationEngineCacheForTests(): void {
  engineCache.clear();
  engineCacheOrder.length = 0;
}
