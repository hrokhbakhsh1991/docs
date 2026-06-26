import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { withTenantRls } from "../../db/with-tenant-rls";
import { isIntegrationSubsystemReady } from "../../health/integration-subsystem-gate";
import { resolveWorkspaceTypeForTenant } from "../../tenant/resolve-workspace-type";
import { getIntegrationProvider } from "../platform/integration-provider-registry";
import type { IntegrationCapability } from "../platform/integration-capability";
import { isIntegrationCapability } from "../platform/integration-capability";
import { resolveIntegrationProviderSurface } from "../platform/resolve-integration-surface";
import {
  buildWorkspaceIntegrationSurfaceMeta,
  type WorkspaceIntegrationSurfaceMetaResponse,
} from "../platform/integration-surface-meta";
import type {
  IntegrationConnectionPublicDto,
  IntegrationConnectionRecord,
  IntegrationTestConnectionResult,
  WorkspaceIntegrationsListResponse,
} from "../platform/integration-connection.types";
import type { IntegrationProviderId } from "../platform/integration-provider.types";
import {
  buildIntegrationSecretRef,
  getIntegrationSecretStore,
  maskSecretRef,
  putIntegrationSecretInTransaction,
} from "../infrastructure/integration-secret-store";
import {
  createIntegrationPolicyRepository,
  seedDefaultEventPoliciesForConnectionInTransaction,
} from "../infrastructure/prisma-integration-policy.repository";
import { createIntegrationConnectionRepository } from "../infrastructure/prisma-integration-connection.repository";
import {
  recordIntegrationConnectionCreated,
  recordIntegrationConnectionCreateFailed,
} from "../../observability/metrics";
import {
  buildLegacyTelegramSyntheticId,
  findLegacyTelegramBotBySyntheticId,
  findLegacyTelegramBotForInspection,
  isLegacyTelegramConnectionId,
  type LegacyTelegramBotInspection,
} from "../infrastructure/resolve-legacy-telegram-connection";
import {
  annotateActiveDeliverySource,
  computeWorkspaceIntegrationsSummary,
  integrationConnectionActionsAllowed,
  legacyIntegrationActionsAllowed,
  testConnectionMessageForCode,
} from "./integrations-verification";

export class IntegrationNotFoundError extends Error {
  readonly code = "INTEGRATION_NOT_FOUND";
  constructor() {
    super("INTEGRATION_NOT_FOUND");
    this.name = "IntegrationNotFoundError";
  }
}

export class IntegrationWorkspaceForbiddenError extends Error {
  readonly code = "INTEGRATION_WORKSPACE_FORBIDDEN";
  constructor() {
    super("INTEGRATION_WORKSPACE_FORBIDDEN");
    this.name = "IntegrationWorkspaceForbiddenError";
  }
}

export class IntegrationInvalidBodyError extends Error {
  readonly code: string;
  constructor(code = "INTEGRATION_INVALID_BODY") {
    super(code);
    this.code = code;
    this.name = "IntegrationInvalidBodyError";
  }
}

export class IntegrationConnectionAlreadyExistsError extends Error {
  readonly code = "INTEGRATION_CONNECTION_ALREADY_EXISTS";
  constructor() {
    super("INTEGRATION_CONNECTION_ALREADY_EXISTS");
    this.name = "IntegrationConnectionAlreadyExistsError";
  }
}

export class IntegrationLegacyReadOnlyError extends Error {
  readonly code = "LEGACY_INTEGRATION_READ_ONLY";
  constructor() {
    super("LEGACY_INTEGRATION_READ_ONLY");
    this.name = "IntegrationLegacyReadOnlyError";
  }
}

export class IntegrationSystemNotReadyError extends Error {
  readonly code = "INTEGRATION_SYSTEM_NOT_READY";
  constructor() {
    super("INTEGRATION_SYSTEM_NOT_READY");
    this.name = "IntegrationSystemNotReadyError";
  }
}

function assertIntegrationSystemReady(): void {
  if (!isIntegrationSubsystemReady()) {
    throw new IntegrationSystemNotReadyError();
  }
}

/**
 * Authorizes a workspace-scoped integration request.
 * The path `workspaceId` is the workspace TYPE slug (e.g. `denali`), while the JWT
 * `workspace_id` claim carries the workspace INSTANCE id (e.g. `ws-denali-dev`).
 * Accept either the instance id (exact) or the tenant's resolved workspace type.
 */
async function assertWorkspaceScope(auth: TenantAuthContext, workspaceId: string): Promise<void> {
  if (auth.workspaceId !== undefined && auth.workspaceId === workspaceId) {
    return;
  }
  const tenantWorkspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  if (authWorkspaceMatches(workspaceId, tenantWorkspaceType)) {
    return;
  }
  throw new IntegrationWorkspaceForbiddenError();
}

/**
 * Authorizes access to a row/legacy bot identified by its workspace TYPE.
 * Compares against the tenant's resolved workspace type — never the JWT instance id.
 */
async function assertTenantOwnsWorkspaceType(
  auth: TenantAuthContext,
  targetWorkspaceType: string | null
): Promise<void> {
  if (targetWorkspaceType === null) {
    return;
  }
  const tenantWorkspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  if (!authWorkspaceMatches(targetWorkspaceType, tenantWorkspaceType)) {
    throw new IntegrationWorkspaceForbiddenError();
  }
}

function assertLegacyReadOnly(integrationId: string): void {
  if (isLegacyTelegramConnectionId(integrationId)) {
    throw new IntegrationLegacyReadOnlyError();
  }
}

async function resolveWorkspaceTypeForRoute(
  tenantId: string,
  workspaceId: string
): Promise<string> {
  const tenantWorkspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  if (workspaceId === tenantWorkspaceType) {
    return workspaceId;
  }
  if (authWorkspaceMatches(workspaceId, tenantWorkspaceType)) {
    return tenantWorkspaceType;
  }
  return workspaceId;
}

function authWorkspaceMatches(workspaceId: string, workspaceType: string): boolean {
  return workspaceId.trim().toLowerCase() === workspaceType.trim().toLowerCase();
}

function parseProvider(value: unknown): IntegrationProviderId {
  if (
    value !== "telegram" &&
    value !== "slack" &&
    value !== "whatsapp" &&
    value !== "discord" &&
    value !== "email"
  ) {
    throw new IntegrationInvalidBodyError("INTEGRATION_PROVIDER_INVALID");
  }
  if (getIntegrationProvider(value) === undefined) {
    throw new IntegrationInvalidBodyError("INTEGRATION_PROVIDER_NOT_REGISTERED");
  }
  return value;
}

function parseCapabilities(
  value: unknown,
  defaultCapabilities: readonly string[] = ["message.send"]
): IntegrationCapability[] {
  if (value === undefined) {
    const parsedDefaults = defaultCapabilities.filter(
      (entry): entry is IntegrationCapability =>
        typeof entry === "string" && isIntegrationCapability(entry)
    );
    if (parsedDefaults.length === 0) {
      throw new IntegrationInvalidBodyError("INTEGRATION_CAPABILITIES_INVALID");
    }
    return parsedDefaults;
  }
  if (!Array.isArray(value)) {
    throw new IntegrationInvalidBodyError("INTEGRATION_CAPABILITIES_INVALID");
  }
  const parsed = value.filter(
    (entry): entry is IntegrationCapability =>
      typeof entry === "string" && isIntegrationCapability(entry)
  );
  if (parsed.length === 0) {
    throw new IntegrationInvalidBodyError("INTEGRATION_CAPABILITIES_INVALID");
  }
  return parsed;
}

function requiredSurfaceFieldCode(provider: IntegrationProviderId, fieldId: string): string {
  const fieldCode = fieldId
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return `INTEGRATION_${provider.toUpperCase()}_${fieldCode}_REQUIRED`;
}

function readSurfaceStringField(input: {
  readonly value: unknown;
  readonly provider: IntegrationProviderId;
  readonly fieldId: string;
  readonly required: boolean;
}): string | undefined {
  if (input.value === undefined || input.value === null) {
    if (input.required) {
      throw new IntegrationInvalidBodyError(
        requiredSurfaceFieldCode(input.provider, input.fieldId)
      );
    }
    return undefined;
  }
  if (typeof input.value !== "string") {
    throw new IntegrationInvalidBodyError(requiredSurfaceFieldCode(input.provider, input.fieldId));
  }
  const trimmed = input.value.trim();
  if (trimmed.length === 0) {
    if (input.required) {
      throw new IntegrationInvalidBodyError(
        requiredSurfaceFieldCode(input.provider, input.fieldId)
      );
    }
    return undefined;
  }
  return trimmed;
}

function readCredentialCandidate(record: Record<string, unknown>, fieldId: string): unknown {
  if (fieldId in record) {
    return record[fieldId];
  }
  const credentials = record.credentials;
  if (typeof credentials === "object" && credentials !== null) {
    return (credentials as Record<string, unknown>)[fieldId];
  }
  return undefined;
}

function normalizeIntegrationCreateFromSurface(input: {
  readonly workspaceType: string | null;
  readonly provider: IntegrationProviderId;
  readonly rawConfig: Record<string, unknown>;
  readonly record: Record<string, unknown>;
}): {
  readonly config: Record<string, unknown>;
  readonly credentials: Record<string, string>;
  readonly defaultCapabilities: readonly string[];
} {
  const providerSurface = resolveIntegrationProviderSurface({
    workspaceType: input.workspaceType,
    providerId: input.provider,
  });
  if (providerSurface === null) {
    throw new IntegrationInvalidBodyError("INTEGRATION_PROVIDER_NOT_SUPPORTED_FOR_WORKSPACE");
  }

  const config: Record<string, unknown> = {};
  for (const field of providerSurface.configFields) {
    const value = readSurfaceStringField({
      value: input.rawConfig[field.id],
      provider: input.provider,
      fieldId: field.id,
      required: field.requiredOnCreate,
    });
    if (value !== undefined) {
      config[field.id] = value;
    }
  }

  const credentials: Record<string, string> = {};
  for (const field of providerSurface.credentialFields) {
    const value = readSurfaceStringField({
      value: readCredentialCandidate(input.record, field.id),
      provider: input.provider,
      fieldId: field.id,
      required: field.requiredOnCreate,
    });
    if (value !== undefined) {
      credentials[field.id] = value;
    }
  }

  return {
    config,
    credentials,
    defaultCapabilities: providerSurface.defaultCapabilities,
  };
}

function normalizeIntegrationPatchConfigFromSurface(input: {
  readonly workspaceType: string | null;
  readonly provider: IntegrationProviderId;
  readonly rawConfig: Record<string, unknown>;
}): Record<string, unknown> {
  const providerSurface = resolveIntegrationProviderSurface({
    workspaceType: input.workspaceType,
    providerId: input.provider,
  });
  if (providerSurface === null) {
    throw new IntegrationInvalidBodyError("INTEGRATION_PROVIDER_NOT_SUPPORTED_FOR_WORKSPACE");
  }

  const config: Record<string, unknown> = {};
  for (const field of providerSurface.configFields) {
    const value = readSurfaceStringField({
      value: input.rawConfig[field.id],
      provider: input.provider,
      fieldId: field.id,
      required: true,
    });
    if (value !== undefined) {
      config[field.id] = value;
    }
  }
  return config;
}

function normalizePatchCredentialsFromSurface(input: {
  readonly workspaceType: string | null;
  readonly provider: IntegrationProviderId;
  readonly record: Record<string, unknown>;
}): Record<string, string> {
  const providerSurface = resolveIntegrationProviderSurface({
    workspaceType: input.workspaceType,
    providerId: input.provider,
  });
  if (providerSurface === null) {
    throw new IntegrationInvalidBodyError("INTEGRATION_PROVIDER_NOT_SUPPORTED_FOR_WORKSPACE");
  }

  const credentials: Record<string, string> = {};
  for (const field of providerSurface.credentialFields) {
    const candidate = readCredentialCandidate(input.record, field.id);
    if (candidate === undefined) {
      continue;
    }
    const value = readSurfaceStringField({
      value: candidate,
      provider: input.provider,
      fieldId: field.id,
      required: true,
    });
    if (value !== undefined) {
      credentials[field.id] = value;
    }
  }
  return credentials;
}

function isDuplicateConnectionScopeError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function hasTelegramIntegrationConnectionRow(
  tenantId: string,
  workspaceType: string
): Promise<boolean> {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.integrationConnection.findFirst({
      where: {
        tenantId,
        workspaceType,
        provider: "telegram",
      },
      select: { id: true },
    });
    return row !== null;
  });
}

function legacyTelegramToPublicDto(
  legacy: LegacyTelegramBotInspection,
  input: { readonly fallbackSuppressed: boolean }
): IntegrationConnectionPublicDto {
  return {
    id: buildLegacyTelegramSyntheticId(legacy.id),
    tenantId: legacy.tenantId,
    workspaceType: legacy.workspaceType,
    provider: "telegram",
    status: legacy.enabled ? "enabled" : "disabled",
    enabled: legacy.enabled,
    capabilities: ["message.send"],
    config: { channelId: legacy.channelId },
    hasSecret: legacy.botToken.trim().length > 0,
    secretRefMasked: null,
    eventPolicies: [{ eventType: "TourCreated", enabled: true }],
    createdAt: legacy.createdAt.toISOString(),
    updatedAt: legacy.updatedAt.toISOString(),
    backingSource: "legacy_workspace_telegram_bot",
    legacySourceId: legacy.id,
    actionsAllowed: legacyIntegrationActionsAllowed(),
    isActiveDeliverySource: false,
    fallbackSuppressed: input.fallbackSuppressed,
  };
}

async function toPublicDto(
  tenantId: string,
  row: IntegrationConnectionRecord & { createdAt?: Date; updatedAt?: Date }
): Promise<IntegrationConnectionPublicDto> {
  const policyRepository = createIntegrationPolicyRepository();
  const policies = await policyRepository.listPoliciesForConnection({
    tenantId,
    integrationConnectionId: row.id,
  });

  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceType: row.workspaceType,
    provider: row.provider,
    status: row.status,
    enabled: row.enabled,
    capabilities: row.capabilities,
    config: row.config,
    hasSecret: row.secretRef !== null && row.secretRef.length > 0,
    secretRefMasked: maskSecretRef(row.secretRef),
    eventPolicies: policies.map((policy) => ({
      eventType: policy.eventType,
      enabled: policy.enabled,
    })),
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
    backingSource: "integration_connection",
    legacySourceId: null,
    actionsAllowed: integrationConnectionActionsAllowed(),
    isActiveDeliverySource: false,
    fallbackSuppressed: false,
  };
}

export async function createWorkspaceIntegration(
  auth: TenantAuthContext,
  workspaceId: string,
  body: unknown
): Promise<IntegrationConnectionPublicDto> {
  assertIntegrationSystemReady();
  await assertWorkspaceScope(auth, workspaceId);
  if (typeof body !== "object" || body === null) {
    throw new IntegrationInvalidBodyError();
  }
  const record = body as Record<string, unknown>;
  const provider = parseProvider(record.provider);
  const workspaceType = await resolveWorkspaceTypeForRoute(auth.tenantId, workspaceId);
  const rawConfig =
    typeof record.config === "object" && record.config !== null
      ? (record.config as Record<string, unknown>)
      : {};
  const normalized = normalizeIntegrationCreateFromSurface({
    workspaceType,
    provider,
    rawConfig,
    record,
  });
  const capabilities = parseCapabilities(record.capabilities, normalized.defaultCapabilities);
  const config = normalized.config;
  const secretPayload = normalized.credentials;
  const connectionId = randomUUID();
  const secretRef =
    Object.keys(secretPayload).length > 0 ? buildIntegrationSecretRef(connectionId) : null;

  const created = await (async () => {
    try {
      return await withTenantRls(auth.tenantId, async (tx) => {
        const row = await tx.integrationConnection.create({
          data: {
            id: connectionId,
            tenantId: auth.tenantId,
            workspaceType,
            provider,
            status: "disabled",
            enabled: false,
            capabilities: capabilities as Prisma.InputJsonValue,
            config: config as Prisma.InputJsonValue,
            credentials: {},
            secretRef,
            createdByUserId: auth.userId,
          },
        });

        if (secretRef !== null) {
          await putIntegrationSecretInTransaction(tx, auth.tenantId, secretRef, secretPayload);
        }

        await seedDefaultEventPoliciesForConnectionInTransaction(tx, {
          tenantId: auth.tenantId,
          integrationConnectionId: row.id,
          provider,
          workspaceType,
        });

        return row;
      });
    } catch (error) {
      const duplicate = isDuplicateConnectionScopeError(error);
      recordIntegrationConnectionCreateFailed({
        tenantId: auth.tenantId,
        provider,
        workspaceType,
        reason: duplicate ? "duplicate" : "transaction_failed",
      });
      if (duplicate) {
        throw new IntegrationConnectionAlreadyExistsError();
      }
      throw error;
    }
  })();

  recordIntegrationConnectionCreated({
    tenantId: auth.tenantId,
    provider,
    workspaceType,
  });

  return toPublicDto(auth.tenantId, {
    ...mapRow(created),
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  });
}

export async function getWorkspaceIntegrationMeta(
  auth: TenantAuthContext,
  workspaceId: string
): Promise<WorkspaceIntegrationSurfaceMetaResponse> {
  assertIntegrationSystemReady();
  await assertWorkspaceScope(auth, workspaceId);
  const workspaceType = await resolveWorkspaceTypeForRoute(auth.tenantId, workspaceId);
  return buildWorkspaceIntegrationSurfaceMeta(workspaceType);
}

export async function listWorkspaceIntegrations(
  auth: TenantAuthContext,
  workspaceId: string
): Promise<WorkspaceIntegrationsListResponse> {
  assertIntegrationSystemReady();
  await assertWorkspaceScope(auth, workspaceId);
  const workspaceType = await resolveWorkspaceTypeForRoute(auth.tenantId, workspaceId);
  const repository = createIntegrationConnectionRepository();
  const rows = await repository.listForWorkspace({
    tenantId: auth.tenantId,
    workspaceType,
  });

  const connectionItems = await Promise.all(
    rows.map(async (row) => {
      const full = await withTenantRls(auth.tenantId, async (tx) =>
        tx.integrationConnection.findUnique({ where: { id: row.id } })
      );
      return toPublicDto(auth.tenantId, {
        ...row,
        createdAt: full?.createdAt,
        updatedAt: full?.updatedAt,
      });
    })
  );

  const legacyBot = await findLegacyTelegramBotForInspection(auth.tenantId, workspaceType);
  const legacySuppressed =
    legacyBot !== null
      ? await hasTelegramIntegrationConnectionRow(auth.tenantId, workspaceType)
      : false;

  const items = [
    ...connectionItems,
    ...(legacyBot !== null
      ? [legacyTelegramToPublicDto(legacyBot, { fallbackSuppressed: legacySuppressed })]
      : []),
  ];

  const annotated = annotateActiveDeliverySource(items);
  return {
    items: annotated,
    summary: computeWorkspaceIntegrationsSummary(annotated),
  };
}

export async function getIntegrationDetail(
  auth: TenantAuthContext,
  integrationId: string
): Promise<IntegrationConnectionPublicDto> {
  assertIntegrationSystemReady();
  if (isLegacyTelegramConnectionId(integrationId)) {
    const legacy = await findLegacyTelegramBotBySyntheticId(auth.tenantId, integrationId);
    if (legacy === null) {
      throw new IntegrationNotFoundError();
    }
    await assertTenantOwnsWorkspaceType(auth, legacy.workspaceType);
    const fallbackSuppressed = await hasTelegramIntegrationConnectionRow(
      auth.tenantId,
      legacy.workspaceType
    );
    const dto = legacyTelegramToPublicDto(legacy, { fallbackSuppressed });
    return annotateActiveDeliverySource([dto])[0]!;
  }

  const row = await withTenantRls(auth.tenantId, async (tx) =>
    tx.integrationConnection.findFirst({
      where: { id: integrationId, tenantId: auth.tenantId },
    })
  );
  if (row === null) {
    throw new IntegrationNotFoundError();
  }
  await assertTenantOwnsWorkspaceType(auth, row.workspaceType);

  const dto = await toPublicDto(auth.tenantId, {
    ...mapRow(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
  return annotateActiveDeliverySource([dto])[0]!;
}

export async function patchIntegration(
  auth: TenantAuthContext,
  integrationId: string,
  body: unknown
): Promise<IntegrationConnectionPublicDto> {
  assertIntegrationSystemReady();
  assertLegacyReadOnly(integrationId);
  if (typeof body !== "object" || body === null) {
    throw new IntegrationInvalidBodyError();
  }
  const record = body as Record<string, unknown>;

  const updated = await withTenantRls(auth.tenantId, async (tx) => {
    const existing = await tx.integrationConnection.findFirst({
      where: { id: integrationId, tenantId: auth.tenantId },
    });
    if (existing === null) {
      throw new IntegrationNotFoundError();
    }

    const config =
      typeof record.config === "object" && record.config !== null
        ? (normalizeIntegrationPatchConfigFromSurface({
            workspaceType: existing.workspaceType,
            provider: existing.provider as IntegrationProviderId,
            rawConfig: record.config as Record<string, unknown>,
          }) as Prisma.InputJsonValue)
        : undefined;
    const capabilities =
      record.capabilities !== undefined
        ? (parseCapabilities(record.capabilities) as Prisma.InputJsonValue)
        : undefined;

    const secretPayload = normalizePatchCredentialsFromSurface({
      workspaceType: existing.workspaceType,
      provider: existing.provider as IntegrationProviderId,
      record,
    });
    let secretRef = existing.secretRef;
    if (Object.keys(secretPayload).length > 0) {
      secretRef = buildIntegrationSecretRef(existing.id);
      await putIntegrationSecretInTransaction(tx, auth.tenantId, secretRef, secretPayload);
    }

    if (Array.isArray(record.eventPolicies)) {
      for (const entry of record.eventPolicies) {
        if (typeof entry !== "object" || entry === null) continue;
        const policy = entry as Record<string, unknown>;
        const eventType = typeof policy.eventType === "string" ? policy.eventType.trim() : "";
        if (eventType.length === 0) continue;
        const enabled = policy.enabled === true;
        await tx.integrationEventPolicy.upsert({
          where: {
            integrationConnectionId_eventType: {
              integrationConnectionId: existing.id,
              eventType,
            },
          },
          create: {
            tenantId: auth.tenantId,
            integrationConnectionId: existing.id,
            eventType,
            enabled,
          },
          update: { enabled },
        });
      }
    }

    return tx.integrationConnection.update({
      where: { id: existing.id },
      data: {
        ...(config !== undefined ? { config } : {}),
        ...(capabilities !== undefined ? { capabilities } : {}),
        ...(secretRef !== undefined ? { secretRef } : {}),
      },
    });
  });

  return toPublicDto(auth.tenantId, {
    ...mapRow(updated),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}

export async function deleteIntegration(
  auth: TenantAuthContext,
  integrationId: string
): Promise<void> {
  assertIntegrationSystemReady();
  assertLegacyReadOnly(integrationId);
  await withTenantRls(auth.tenantId, async (tx) => {
    const existing = await tx.integrationConnection.findFirst({
      where: { id: integrationId, tenantId: auth.tenantId },
    });
    if (existing === null) {
      throw new IntegrationNotFoundError();
    }
    if (existing.secretRef !== null) {
      await getIntegrationSecretStore().delete(auth.tenantId, existing.secretRef);
    }
    await tx.integrationConnection.delete({ where: { id: existing.id } });
  });
}

export async function enableIntegration(
  auth: TenantAuthContext,
  integrationId: string
): Promise<IntegrationConnectionPublicDto> {
  assertIntegrationSystemReady();
  assertLegacyReadOnly(integrationId);
  return setIntegrationEnabled(auth, integrationId, true);
}

export async function disableIntegration(
  auth: TenantAuthContext,
  integrationId: string
): Promise<IntegrationConnectionPublicDto> {
  assertIntegrationSystemReady();
  assertLegacyReadOnly(integrationId);
  return setIntegrationEnabled(auth, integrationId, false);
}

async function setIntegrationEnabled(
  auth: TenantAuthContext,
  integrationId: string,
  enabled: boolean
): Promise<IntegrationConnectionPublicDto> {
  const updated = await withTenantRls(auth.tenantId, async (tx) => {
    const existing = await tx.integrationConnection.findFirst({
      where: { id: integrationId, tenantId: auth.tenantId },
    });
    if (existing === null) {
      throw new IntegrationNotFoundError();
    }
    return tx.integrationConnection.update({
      where: { id: existing.id },
      data: {
        enabled,
        status: enabled ? "enabled" : "disabled",
      },
    });
  });

  return toPublicDto(auth.tenantId, {
    ...mapRow(updated),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}

export async function testIntegrationConnection(
  auth: TenantAuthContext,
  integrationId: string
): Promise<IntegrationTestConnectionResult> {
  assertIntegrationSystemReady();
  const testedAt = new Date().toISOString();

  if (isLegacyTelegramConnectionId(integrationId)) {
    const legacy = await findLegacyTelegramBotBySyntheticId(auth.tenantId, integrationId);
    if (legacy === null) {
      throw new IntegrationNotFoundError();
    }
    return runProviderTest({
      testedAt,
      backingSource: "legacy_workspace_telegram_bot",
      provider: "telegram",
      tenantId: legacy.tenantId,
      workspaceType: legacy.workspaceType,
      config: { channelId: legacy.channelId },
      credentials: { botToken: legacy.botToken },
      persistStatusForConnectionId: null,
    });
  }

  const repository = createIntegrationConnectionRepository();
  const connection = await repository.findById(auth.tenantId, integrationId);
  if (connection === null) {
    throw new IntegrationNotFoundError();
  }

  const { resolveIntegrationConnectionCredentials } =
    await import("../application/resolve-integration-connection-credentials");
  const credentials = await resolveIntegrationConnectionCredentials(connection);
  return runProviderTest({
    testedAt,
    backingSource: "integration_connection",
    provider: connection.provider,
    tenantId: connection.tenantId,
    workspaceType: connection.workspaceType,
    config: connection.config,
    credentials,
    persistStatusForConnectionId: connection.id,
  });
}

async function runProviderTest(input: {
  readonly testedAt: string;
  readonly backingSource: IntegrationConnectionPublicDto["backingSource"];
  readonly provider: IntegrationProviderId;
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly config: Record<string, unknown>;
  readonly credentials: Record<string, unknown>;
  readonly persistStatusForConnectionId: string | null;
}): Promise<IntegrationTestConnectionResult> {
  const adapter = getIntegrationProvider(input.provider);
  if (adapter === undefined) {
    return {
      ok: false,
      code: "INTEGRATION_PROVIDER_NOT_REGISTERED",
      message: testConnectionMessageForCode("INTEGRATION_PROVIDER_NOT_REGISTERED"),
      testedAt: input.testedAt,
      backingSource: input.backingSource,
    };
  }

  const channelId = typeof input.config.channelId === "string" ? input.config.channelId : null;
  if (channelId === null) {
    return {
      ok: false,
      code: "INTEGRATION_CONFIG_INCOMPLETE",
      message: testConnectionMessageForCode("INTEGRATION_CONFIG_INCOMPLETE"),
      testedAt: input.testedAt,
      backingSource: input.backingSource,
    };
  }

  const result = await adapter.sendMessage(
    {
      tenantId: input.tenantId,
      workspaceType: input.workspaceType,
      domainEventId: "test-connection",
      eventType: "TestConnection",
      config: input.config,
      credentials: input.credentials,
    },
    { channelId, text: "Integration test connection" }
  );

  if (!result.ok) {
    if (input.persistStatusForConnectionId !== null) {
      await withTenantRls(input.tenantId, async (tx) => {
        await tx.integrationConnection.update({
          where: { id: input.persistStatusForConnectionId! },
          data: { status: "error" },
        });
      });
    }
    return {
      ok: false,
      code: result.errorCode,
      message: testConnectionMessageForCode(result.errorCode),
      testedAt: input.testedAt,
      backingSource: input.backingSource,
    };
  }

  if (input.persistStatusForConnectionId !== null) {
    await withTenantRls(input.tenantId, async (tx) => {
      await tx.integrationConnection.update({
        where: { id: input.persistStatusForConnectionId! },
        data: { status: "enabled" },
      });
    });
  }

  return {
    ok: true,
    message: "Test message delivered successfully.",
    testedAt: input.testedAt,
    backingSource: input.backingSource,
  };
}

function mapRow(row: {
  id: string;
  tenantId: string;
  workspaceType: string | null;
  provider: string;
  status: string;
  enabled: boolean;
  capabilities: Prisma.JsonValue;
  config: Prisma.JsonValue;
  credentials: Prisma.JsonValue;
  secretRef: string | null;
}): IntegrationConnectionRecord {
  const capabilitiesRaw = Array.isArray(row.capabilities) ? row.capabilities : [];
  const capabilities = capabilitiesRaw.filter(
    (entry): entry is IntegrationCapability =>
      typeof entry === "string" && isIntegrationCapability(entry)
  );
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceType: row.workspaceType,
    provider: row.provider as IntegrationProviderId,
    status: row.status as IntegrationConnectionRecord["status"],
    enabled: row.enabled,
    capabilities,
    config:
      typeof row.config === "object" && row.config !== null
        ? (row.config as Record<string, unknown>)
        : {},
    secretRef: row.secretRef,
    credentials:
      typeof row.credentials === "object" && row.credentials !== null
        ? (row.credentials as Record<string, unknown>)
        : {},
  };
}
