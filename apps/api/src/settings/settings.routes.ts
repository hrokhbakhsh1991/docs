import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { readIdentityRequestBody } from "../identity/read-identity-request-body";
import { requireOperatorSession } from "../identity/require-operator-session";
import {
  getSettingsConfig,
  putSettingsConfig,
  SettingsConfigUnknownError,
  SettingsConfigVersionUnsupportedError,
  SettingsWizardUnknownFieldError,
  normalizeWizardTemplatePayloadForPut,
} from "./settings-config.service";
import {
  assertSettingsExploreMutationForbidden,
  listSettingsExplore,
  SettingsExploreNotSupportedError,
  SettingsExploreReadOnlyError,
} from "./settings-explore.service";
import {
  createSettingsResource,
  deleteSettingsResource,
  listSettingsModules,
  listSettingsResources,
  patchSettingsResource,
  SettingsModuleNotSupportedError,
  SettingsModuleUnknownError,
  SettingsMutationForbiddenError,
  SettingsResourceInvalidError,
  SettingsResourceNotFoundError,
} from "./settings.service";
import { SettingsWorkspaceForbiddenError } from "./settings-workspace-guard";
import type {
  CreateEquipmentRequest,
  CreateGuideLanguageRequest,
  CreateLocationResourceRequest,
  CreateTourPresetRequest,
  CreateTourThemeRequest,
  PresetsAdvancedMatchRule,
  PresetsAdvancedPayloadV1,
  PutSettingsConfigRequest,
  WizardTemplatePayloadV1,
} from "./settings.types";

function readStringField(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function readThemeIdsField(body: unknown): string[] | undefined {
  if (typeof body !== "object" || body === null || !("themeIds" in body)) {
    return undefined;
  }
  const value = (body as Record<string, unknown>).themeIds;
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
}

function readOptionalStringOrNullField(
  body: unknown,
  key: string
): string | null | undefined {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[key];
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value : undefined;
}

function parseCreateBody(body: unknown): CreateEquipmentRequest | null {
  const name = readStringField(body, "name");
  const category = readStringField(body, "category");
  const iconKey = readOptionalStringOrNullField(body, "iconKey");
  if (name.length === 0) {
    return null;
  }
  if (typeof body === "object" && body !== null && "themeIds" in body && !Array.isArray((body as Record<string, unknown>).themeIds)) {
    return null;
  }
  if (iconKey !== undefined && iconKey !== null && typeof iconKey !== "string") {
    return null;
  }
  const themeIds = readThemeIdsField(body);
  return {
    name,
    ...(category.length > 0 ? { category } : {}),
    ...(iconKey !== undefined ? { iconKey } : {}),
    ...(themeIds !== undefined ? { themeIds } : {}),
  };
}

function readBooleanField(body: unknown, key: string): boolean | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : undefined;
}

function parseSlugCatalogCreateBody(body: unknown): CreateTourThemeRequest | CreateGuideLanguageRequest | null {
  const name = readStringField(body, "name");
  const slug = readStringField(body, "slug");
  const isActive = readBooleanField(body, "isActive");
  if (name.length === 0) return null;
  return {
    name,
    ...(slug.length > 0 ? { slug } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };
}

function parseCreateBodyForModule(
  moduleId: string,
  body: unknown
):
  | CreateEquipmentRequest
  | CreateTourThemeRequest
  | CreateGuideLanguageRequest
  | CreateTourPresetRequest
  | CreateLocationResourceRequest
  | null {
  if (moduleId === "tour_themes" || moduleId === "guide_languages") {
    return parseSlugCatalogCreateBody(body);
  }

  if (moduleId === "tour_presets") {
    const name = readStringField(body, "name");
    const description = readStringField(body, "description");
    const themeId = readStringField(body, "themeId");
    const isActive = readBooleanField(body, "isActive");
    if (name.length === 0) return null;
    return {
      name,
      ...(description.length > 0 ? { description } : {}),
      ...(themeId.length > 0 ? { themeId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
  }

  if (moduleId === "locations") {
    const entity = readStringField(body, "entity");
    const name = readStringField(body, "name");
    if (entity === "region") {
      const country = readStringField(body, "country");
      if (name.length === 0) return null;
      return {
        entity: "region",
        name,
        ...(country.length > 0 ? { country } : {}),
      };
    }
    if (entity === "destination") {
      const regionId = readStringField(body, "regionId");
      const locationType = readStringField(body, "locationType");
      const altitudeM = readOptionalNumberField(body, "altitudeM");
      const typicalTrailDistanceKm = readOptionalNumberField(body, "typicalTrailDistanceKm");
      if (name.length === 0 || regionId.length === 0) return null;
      return {
        entity: "destination",
        regionId,
        name,
        ...(locationType.length > 0 ? { locationType } : {}),
        ...(altitudeM !== undefined ? { altitudeM } : {}),
        ...(typicalTrailDistanceKm !== undefined ? { typicalTrailDistanceKm } : {}),
      };
    }
    return null;
  }

  const parsed = parseCreateBody(body);
  return parsed;
}

function parsePatchBodyForModule(
  moduleId: string,
  body: unknown
): Record<string, unknown> {
  if (moduleId === "tour_themes" || moduleId === "guide_languages") {
    const name = readStringField(body, "name");
    const slug = readStringField(body, "slug");
    const isActive = readBooleanField(body, "isActive");
    return {
      ...(name.length > 0 ? { name } : {}),
      ...(slug.length > 0 ? { slug } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
  }

  if (moduleId === "tour_presets") {
    const name = readStringField(body, "name");
    const descriptionRaw =
      typeof body === "object" && body !== null && "description" in body
        ? (body as Record<string, unknown>).description
        : undefined;
    const themeIdRaw =
      typeof body === "object" && body !== null && "themeId" in body
        ? (body as Record<string, unknown>).themeId
        : undefined;
    const isActive = readBooleanField(body, "isActive");
    return {
      ...(name.length > 0 ? { name } : {}),
      ...(descriptionRaw === null || typeof descriptionRaw === "string"
        ? { description: descriptionRaw ?? null }
        : {}),
      ...(themeIdRaw === null || typeof themeIdRaw === "string"
        ? { themeId: themeIdRaw ?? null }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
  }

  if (moduleId === "locations") {
    const name = readStringField(body, "name");
    const countryRaw =
      typeof body === "object" && body !== null && "country" in body
        ? (body as Record<string, unknown>).country
        : undefined;
    const regionId = readStringField(body, "regionId");
    const locationTypeRaw =
      typeof body === "object" && body !== null && "locationType" in body
        ? (body as Record<string, unknown>).locationType
        : undefined;
    const altitudeM = readOptionalNumberField(body, "altitudeM");
    const typicalTrailDistanceKm = readOptionalNumberField(body, "typicalTrailDistanceKm");
    const isActive = readBooleanField(body, "isActive");
    return {
      ...(name.length > 0 ? { name } : {}),
      ...(countryRaw === null || typeof countryRaw === "string" ? { country: countryRaw ?? null } : {}),
      ...(regionId.length > 0 ? { regionId } : {}),
      ...(locationTypeRaw === null || typeof locationTypeRaw === "string"
        ? { locationType: locationTypeRaw ?? null }
        : {}),
      ...(altitudeM !== undefined ? { altitudeM } : {}),
      ...(typicalTrailDistanceKm !== undefined ? { typicalTrailDistanceKm } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
  }

  return parsePatchBody(body);
}

function parsePatchBody(body: unknown): {
  name?: string;
  category?: string | null;
  iconKey?: string | null;
  themeIds?: string[];
} {
  const name = readStringField(body, "name");
  const hasCategory = typeof body === "object" && body !== null && "category" in body;
  const categoryRaw = hasCategory ? (body as Record<string, unknown>).category : undefined;
  const category =
    categoryRaw === null
      ? null
      : typeof categoryRaw === "string"
        ? categoryRaw.trim()
        : undefined;
  const iconKey = readOptionalStringOrNullField(body, "iconKey");
  const hasThemeIds = typeof body === "object" && body !== null && "themeIds" in body;
  const themeIds = hasThemeIds ? readThemeIdsField(body) : undefined;

  return {
    ...(name.length > 0 ? { name } : {}),
    ...(hasCategory ? { category: category ?? null } : {}),
    ...(iconKey !== undefined ? { iconKey } : {}),
    ...(hasThemeIds && themeIds !== undefined ? { themeIds } : {}),
  };
}

function readNumberField(body: unknown, key: string): number | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOptionalNumberField(body: unknown, key: string): number | null | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  if (!(key in (body as Record<string, unknown>))) return undefined;
  const value = (body as Record<string, unknown>)[key];
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseWizardTemplatePayload(body: unknown): WizardTemplatePayloadV1 | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const payloadRaw = record.payload;
  if (typeof payloadRaw !== "object" || payloadRaw === null) return null;
  return normalizeWizardTemplatePayloadForPut(payloadRaw as Record<string, unknown>);
}

function parsePresetsAdvancedPayload(body: unknown): PresetsAdvancedPayloadV1 | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const payloadRaw = record.payload;
  if (typeof payloadRaw !== "object" || payloadRaw === null) return null;
  const payload = payloadRaw as Record<string, unknown>;
  if (typeof payload.autoMatchEnabled !== "boolean") {
    return null;
  }
  const defaultPresetId =
    payload.defaultPresetId === null
      ? null
      : typeof payload.defaultPresetId === "string"
        ? payload.defaultPresetId
        : null;
  if (payload.defaultPresetId !== null && defaultPresetId === null) {
    return null;
  }
  if (!Array.isArray(payload.matchRules)) {
    return null;
  }
  const matchRules = payload.matchRules
    .filter((rule): rule is Record<string, unknown> => typeof rule === "object" && rule !== null)
    .map((rule) => {
      const id = typeof rule.id === "string" ? rule.id.trim() : "";
      if (id.length === 0) {
        return null;
      }
      return {
        id,
        tourType:
          rule.tourType === null ? null : typeof rule.tourType === "string" ? rule.tourType : null,
        themeId:
          rule.themeId === null ? null : typeof rule.themeId === "string" ? rule.themeId : null,
        presetId:
          rule.presetId === null ? null : typeof rule.presetId === "string" ? rule.presetId : null,
        enabled: rule.enabled !== false,
      };
    })
    .filter((rule): rule is PresetsAdvancedMatchRule => rule !== null);
  return {
    autoMatchEnabled: payload.autoMatchEnabled,
    defaultPresetId,
    matchRules,
  };
}

function parsePutConfigBody(body: unknown, configKey: string): PutSettingsConfigRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const configVersion = readNumberField(body, "configVersion");
  const payload =
    configKey === "presets_advanced"
      ? parsePresetsAdvancedPayload(body)
      : parseWizardTemplatePayload(body);
  if (configVersion === null || payload === null) {
    return null;
  }
  return { configVersion, payload };
}

function handleSettingsRouteError(res: ServerResponse, error: unknown): void {
  if (error instanceof SettingsWorkspaceForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof SettingsConfigUnknownError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code, configKey: error.configKey });
    return;
  }
  if (error instanceof SettingsConfigVersionUnsupportedError) {
    sendHttpError(res, 400, {
      error: "invalid_version",
      code: error.code,
      configVersion: error.configVersion,
    });
    return;
  }
  if (error instanceof SettingsWizardUnknownFieldError) {
    sendHttpError(res, 400, {
      error: "invalid_body",
      code: error.code,
      canonicalPath: error.canonicalPath,
    });
    return;
  }
  if (error instanceof SettingsExploreReadOnlyError) {
    sendHttpError(res, 405, { error: "method_not_allowed", code: error.code });
    return;
  }
  if (error instanceof SettingsExploreNotSupportedError) {
    sendHttpError(res, 404, { error: "not_found", code: "SETTINGS_MODULE_UNKNOWN", moduleId: error.moduleId });
    return;
  }
  if (error instanceof SettingsResourceInvalidError) {
    sendHttpError(res, 400, { error: "invalid_body", code: error.code });
    return;
  }
  if (error instanceof SettingsModuleUnknownError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code, moduleId: error.moduleId });
    return;
  }
  if (error instanceof SettingsModuleNotSupportedError) {
    sendHttpError(res, 404, { error: "not_found", code: "SETTINGS_MODULE_UNKNOWN", moduleId: error.moduleId });
    return;
  }
  if (error instanceof SettingsMutationForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof SettingsResourceNotFoundError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code, itemId: error.itemId });
    return;
  }
  handleHttpError(res, error);
}

export async function handleListSettingsModules(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listSettingsModules(auth);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleListSettingsResources(
  req: IncomingMessage,
  res: ServerResponse,
  moduleId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listSettingsResources(auth, moduleId);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleSettingsRouteError(res, error);
  }
}

export async function handleCreateSettingsResource(
  req: IncomingMessage,
  res: ServerResponse,
  moduleId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const parsed = parseCreateBodyForModule(moduleId, body);
    if (parsed === null) {
      sendHttpError(res, 400, { error: "invalid_body", code: "SETTINGS_RESOURCE_INVALID" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await createSettingsResource(auth, moduleId, parsed);
        sendJson(res, 201, created);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleSettingsRouteError(res, error);
  }
}

export async function handlePatchSettingsResource(
  req: IncomingMessage,
  res: ServerResponse,
  moduleId: string,
  itemId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const parsed = parsePatchBodyForModule(moduleId, body);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const updated = await patchSettingsResource(auth, moduleId, itemId, parsed);
        sendJson(res, 200, updated);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleSettingsRouteError(res, error);
  }
}

export async function handleDeleteSettingsResource(
  req: IncomingMessage,
  res: ServerResponse,
  moduleId: string,
  itemId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await deleteSettingsResource(auth, moduleId, itemId);
        sendJson(res, 204, {});
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleSettingsRouteError(res, error);
  }
}

export async function handleGetSettingsConfig(
  req: IncomingMessage,
  res: ServerResponse,
  configKey: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await getSettingsConfig(auth, configKey);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleSettingsRouteError(res, error);
  }
}

export async function handlePutSettingsConfig(
  req: IncomingMessage,
  res: ServerResponse,
  configKey: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const parsed = parsePutConfigBody(body, configKey);
    if (parsed === null) {
      sendHttpError(res, 400, { error: "invalid_body", code: "SETTINGS_CONFIG_INVALID" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await putSettingsConfig(auth, configKey, parsed);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleSettingsRouteError(res, error);
  }
}

export async function handleGetTourWizardTemplateAlias(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await handleGetSettingsConfig(req, res, "wizard_template");
}

export async function handlePutTourWizardTemplateAlias(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await handlePutSettingsConfig(req, res, "wizard_template");
}

export async function handleGetTourPresetsAdvancedAlias(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await handleGetSettingsConfig(req, res, "presets_advanced");
}

export async function handlePutTourPresetsAdvancedAlias(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await handlePutSettingsConfig(req, res, "presets_advanced");
}

export async function handleGetSettingsExplore(
  req: IncomingMessage,
  res: ServerResponse,
  moduleId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listSettingsExplore(auth, moduleId);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleSettingsRouteError(res, error);
  }
}

export async function handleMutateSettingsExplore(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await requireOperatorSession(req);
    assertSettingsExploreMutationForbidden();
  } catch (error) {
    handleSettingsRouteError(res, error);
  }
}
