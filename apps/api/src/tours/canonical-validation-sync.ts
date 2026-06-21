import { PlatformWizardEngine } from "@app-tour/platform-core";
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
import { isWorkspaceMetadataEnabled } from "../workspace-metadata/is-workspace-metadata-enabled.ts";
import { readTenantWorkspaceMetadataBinding } from "../workspace-metadata/read-tenant-workspace-metadata-binding.ts";
import type { PlatformTenantRepository } from "../platform/platform-tenant.repository.ts";
import { resolveWorkspacePluginForTenantContext } from "../workspace/resolve-workspace-plugin-for-tenant-context.ts";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";
import type { CreateTourBody } from "./create-tour.schema";
import {
  enrichStarterDocumentForDenaliOperatorList,
  pickStarterCreateDataForValidation,
  shouldUseStarterValidationForDenaliCreate,
} from "./bridge-denali-operator-create-body";
import { runWorkspaceValidationHooks } from "./run-workspace-validation-hooks";

export function resolveValidationDimensions(
  plugin: WorkspacePlugin,
  validationVariant: "default" | "basic",
  data?: Record<string, unknown>
): Record<string, string> {
  const matrix = plugin.ruleSet.matrixDimensions;
  if (matrix.includes("variant")) {
    return { variant: validationVariant };
  }
  if (matrix.includes("category") && matrix.includes("duration")) {
    const resolveFromDraft = plugin.wizardHost?.resolveMatrixDimensionsFromDraft;
    if (resolveFromDraft != null) {
      return { ...resolveFromDraft(data ?? {}, null) };
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

const PACKAGE_METADATA_FINGERPRINT = "_pkg:latest" as const;

/** P3-A-N-011 — cache key suffix when metadata binding pins a definition version. */
export function buildValidationEngineCacheKey(
  tenantId: string,
  workspaceType: string,
  validationVariant: "default" | "basic",
  metadataFingerprint = PACKAGE_METADATA_FINGERPRINT
): string {
  return `${tenantId.trim()}:${workspaceType}:${validationVariant}:${metadataFingerprint}`;
}

/** Reads tenant binding columns for engine LRU fingerprint (package path when flag off or unbound). */
export async function resolveMetadataFingerprintForEngineCache(
  tenantId: string,
  deps: {
    tenantRepository?: PlatformTenantRepository;
  } = {}
): Promise<string> {
  if (!isWorkspaceMetadataEnabled()) {
    return PACKAGE_METADATA_FINGERPRINT;
  }
  const binding = await readTenantWorkspaceMetadataBinding(tenantId, deps);
  const metadataBinding = binding?.metadataBinding;
  if (!metadataBinding?.definitionId) {
    return PACKAGE_METADATA_FINGERPRINT;
  }
  const versionSuffix =
    metadataBinding.definitionVersion === null || metadataBinding.definitionVersion === undefined
      ? "latest"
      : String(metadataBinding.definitionVersion);
  return `${metadataBinding.definitionId}:${versionSuffix}`;
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

function createValidationEngineFromPlugin(plugin: WorkspacePlugin): PlatformWizardEngine {
  const {
    tourList: _tourList,
    tourClone: _tourClone,
    publicCatalog: _publicCatalog,
    ...pluginForEngine
  } = plugin;
  return PlatformWizardEngine.create(pluginForEngine);
}

function getOrCreateValidationEngineWithPlugin(
  cacheKey: string,
  plugin: WorkspacePlugin
): PlatformWizardEngine {
  const hit = engineCache.get(cacheKey);
  if (hit) {
    return touchEngineCache(cacheKey, hit);
  }
  return touchEngineCache(cacheKey, { engine: createValidationEngineFromPlugin(plugin) });
}

/** Cached per tenant + workspaceType + variant + metadata fingerprint (DEC-030 / P3-A-N-011). */
export function getOrCreateValidationEngine(
  tenantId: string,
  workspaceType: string,
  validationVariant: "default" | "basic" = "default"
): PlatformWizardEngine {
  const key = buildValidationEngineCacheKey(tenantId, workspaceType, validationVariant);
  return getOrCreateValidationEngineWithPlugin(key, resolveWorkspacePluginForType(workspaceType));
}

/** Tenant-aware engine cache miss — used when {@link WORKSPACE_METADATA_ENABLED} is on. */
export async function getOrCreateValidationEngineAsync(
  tenantId: string,
  workspaceType: string,
  validationVariant: "default" | "basic" = "default"
): Promise<PlatformWizardEngine> {
  const fingerprint = await resolveMetadataFingerprintForEngineCache(tenantId);
  const key = buildValidationEngineCacheKey(tenantId, workspaceType, validationVariant, fingerprint);
  const plugin = await resolveWorkspacePluginForTenantContext(tenantId, workspaceType);
  return getOrCreateValidationEngineWithPlugin(key, plugin);
}

/** Evict cached engines after platform assign/clear of workspace definition binding. */
export function invalidateValidationEngineCacheForTenant(tenantId: string): void {
  const prefix = `${tenantId.trim()}:`;
  for (const key of [...engineCacheOrder]) {
    if (key.startsWith(prefix)) {
      engineCache.delete(key);
      const index = engineCacheOrder.indexOf(key);
      if (index >= 0) {
        engineCacheOrder.splice(index, 1);
      }
    }
  }
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

function resolveValidationPluginForPersist(
  input: ValidateBeforePersistInput,
  plugin: WorkspacePlugin
): {
  readonly validationPlugin: WorkspacePlugin;
  readonly validationWorkspaceType: string;
  readonly useStarterValidation: boolean;
} {
  const useStarterValidation = shouldUseStarterValidationForDenaliCreate(
    input.workspaceType,
    input.tenantId,
    input.body
  );
  return {
    useStarterValidation,
    validationWorkspaceType: useStarterValidation ? "starter" : input.workspaceType,
    validationPlugin: useStarterValidation ? resolveWorkspacePluginForType("starter") : plugin,
  };
}

function validateCanonicalDocumentWithEngine(
  input: ValidateBeforePersistInput,
  validationPlugin: WorkspacePlugin,
  engine: PlatformWizardEngine,
  useStarterValidation: boolean
): CanonicalDocument {
  const validationVariant = input.validationVariant ?? "default";
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

  if (!result.ok) {
    const message = result.violations.map((v) => v.message).join("; ");
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

/**
 * RULE-003 / RULE-005 — assertCanonicalDocument + validateCanonical before any persist.
 * Sync path — used in worker threads and when {@link P5_VALIDATION_WORKERS_ENABLED}=false.
 */
export function validateCanonicalBeforePersistSync(
  input: ValidateBeforePersistInput
): CanonicalDocument {
  const plugin = resolveWorkspacePluginForType(input.workspaceType);
  const { validationPlugin, validationWorkspaceType, useStarterValidation } =
    resolveValidationPluginForPersist(input, plugin);
  const validationVariant = input.validationVariant ?? "default";
  const engine = getOrCreateValidationEngine(
    input.tenantId,
    validationWorkspaceType,
    validationVariant
  );
  return validateCanonicalDocumentWithEngine(
    input,
    validationPlugin,
    engine,
    useStarterValidation
  );
}

/** P3-A-N-011 — tenant-aware validation on HTTP/async paths when metadata flag is on. */
export async function validateCanonicalBeforePersistAsync(
  input: ValidateBeforePersistInput
): Promise<CanonicalDocument> {
  const plugin = await resolveWorkspacePluginForTenantContext(input.tenantId, input.workspaceType);
  const { validationPlugin, validationWorkspaceType, useStarterValidation } =
    resolveValidationPluginForPersist(input, plugin);
  const validationVariant = input.validationVariant ?? "default";
  const engine = useStarterValidation
    ? getOrCreateValidationEngine(input.tenantId, validationWorkspaceType, validationVariant)
    : await getOrCreateValidationEngineAsync(
        input.tenantId,
        validationWorkspaceType,
        validationVariant
      );
  return validateCanonicalDocumentWithEngine(
    input,
    validationPlugin,
    engine,
    useStarterValidation
  );
}

/** Test-only — clear engine LRU between cases. */
export function resetValidationEngineCacheForTests(): void {
  engineCache.clear();
  engineCacheOrder.length = 0;
}
