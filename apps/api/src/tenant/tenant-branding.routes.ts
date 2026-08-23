import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readIngressHost } from "../http/read-ingress-host";
import { readBinaryRequestBody } from "../http/read-binary-body";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { readIdentityRequestBody } from "../identity/read-identity-request-body";
import {
  SettingsModuleNotSupportedError,
  SettingsMutationForbiddenError,
} from "../settings/settings.service";
import { SettingsWorkspaceForbiddenError } from "../settings/settings-workspace-errors";
import { SettingsModuleUnknownError } from "../settings/settings-registry";

import {
  getTenantBranding,
  patchTenantBranding,
  removeTenantBrandLogo,
  resolvePublicTenantBrandingBySubdomain,
  resolvePublicTenantContextBySubdomain,
  resolveTenantBrandLogoUrl,
  uploadTenantBrandLogo,
} from "./tenant-branding.service";
import { assertTenantBrandLogoUploadContentType } from "./tenant-branding-storage";
import { TENANT_BRAND_LOGO_MAX_BYTES } from "@app-tour/workspace-sdk";
import {
  resolvePublicIngressSubdomain,
  resolvePublicIngressSurfaceKind,
} from "./resolve-public-ingress-subdomain";

export function readTenantBrandingInvalidBodyErrorCode(message: string): string | null {
  const token = message.split(":", 1)[0]?.trim() ?? "";
  if (/^TENANT_BRAND_LOGO_[A-Z0-9_]+$/.test(token)) {
    return token;
  }
  if (/^[A-Z0-9_]+_PHOTO_[A-Z0-9_]+$/.test(token)) {
    return token;
  }
  if (token.includes("CONTENT_TYPE")) {
    return token;
  }
  return null;
}

function mapBrandingError(res: ServerResponse, error: unknown): void {
  if (error instanceof SettingsMutationForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof SettingsWorkspaceForbiddenError) {
    sendHttpError(res, 403, { error: "forbidden", code: error.code });
    return;
  }
  if (error instanceof SettingsModuleNotSupportedError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code, moduleId: error.moduleId });
    return;
  }
  if (error instanceof SettingsModuleUnknownError) {
    sendHttpError(res, 404, { error: "not_found", code: error.code, moduleId: error.moduleId });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message === "TENANT_NOT_FOUND") {
    sendHttpError(res, 404, { error: "not_found", code: "TENANT_NOT_FOUND" });
    return;
  }
  if (message === "WORKSPACE_PLUGIN_UNBOUND") {
    sendHttpError(res, 404, { error: "not_found", code: "WORKSPACE_PLUGIN_UNBOUND" });
    return;
  }
  if (message === "MINIO_NOT_CONFIGURED") {
    sendHttpError(res, 503, { error: "service_unavailable", code: "MINIO_NOT_CONFIGURED" });
    return;
  }
  if (message === "TENANT_BRAND_LOGO_NOT_SET") {
    sendHttpError(res, 404, { error: "not_found", code: "TENANT_BRAND_LOGO_NOT_SET" });
    return;
  }
  const invalidBodyCode = readTenantBrandingInvalidBodyErrorCode(message);
  if (invalidBodyCode !== null) {
    sendHttpError(res, 400, { error: "invalid_body", code: invalidBodyCode });
    return;
  }
  handleHttpError(res, error);
}

export async function handleGetTenantBranding(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const branding = await getTenantBranding(auth);
        sendJson(res, 200, branding);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    mapBrandingError(res, error);
  }
}

export async function handlePatchTenantBranding(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const payload =
      typeof body === "object" && body !== null
        ? (body as {
            readonly displayName?: string | null;
            readonly displayNameFa?: string | null;
            readonly displayNameEn?: string | null;
          })
        : {};
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const branding = await patchTenantBranding(auth, {
          displayName: payload.displayName,
          displayNameFa: payload.displayNameFa,
          displayNameEn: payload.displayNameEn,
        });
        sendJson(res, 200, branding);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapBrandingError(res, error);
  }
}

export async function handleUploadTenantBrandLogo(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const contentType = (req.headers["content-type"] ?? "").toString().trim().toLowerCase();
    if (contentType.length === 0) {
      sendHttpError(res, 400, { error: "invalid_body", code: "CONTENT_TYPE_REQUIRED" });
      return;
    }
    assertTenantBrandLogoUploadContentType(contentType);
    const body = await readBinaryRequestBody(req, TENANT_BRAND_LOGO_MAX_BYTES);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const branding = await uploadTenantBrandLogo(auth, body, contentType);
        sendJson(res, 201, branding);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapBrandingError(res, error);
  }
}

export async function handleDeleteTenantBrandLogo(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const branding = await removeTenantBrandLogo(auth);
        sendJson(res, 200, branding);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    mapBrandingError(res, error);
  }
}

export async function handleGetTenantBrandLogoUrl(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await resolveTenantBrandLogoUrl(auth);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    mapBrandingError(res, error);
  }
}

export async function handlePublicTenantBranding(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const host = readIngressHost(req);
    const subdomain = await resolvePublicIngressSubdomain(host);
    if (subdomain === null) {
      sendHttpError(res, 404, { error: "not_found", code: "TENANT_HOST_UNKNOWN" });
      return;
    }
    const localeHeader = req.headers["x-tenant-locale"];
    const locale = Array.isArray(localeHeader)
      ? (localeHeader[0] ?? null)
      : (localeHeader?.toString().trim() ?? null);
    const branding = await resolvePublicTenantBrandingBySubdomain(subdomain, locale);
    sendJson(res, 200, branding);
  } catch (error) {
    mapBrandingError(res, error);
  }
}

export async function handlePublicTenantContext(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const host = readIngressHost(req);
    const subdomain = await resolvePublicIngressSubdomain(host);
    if (subdomain === null) {
      sendHttpError(res, 404, { error: "not_found", code: "TENANT_HOST_UNKNOWN" });
      return;
    }
    const context = await resolvePublicTenantContextBySubdomain(subdomain);
    const ingressSurface = resolvePublicIngressSurfaceKind(host);
    sendJson(res, 200, { success: true, data: { ...context, ingressSurface } });
  } catch (error) {
    mapBrandingError(res, error);
  }
}
