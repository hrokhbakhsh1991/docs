import type { IncomingMessage, ServerResponse } from "node:http";

import { parseMarketingPageLocale } from "@app-tour/marketing-pages-http-contracts";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readIngressHost } from "../http/read-ingress-host";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import {
  MARKETING_PAGE_KEY_NOT_ALLOWED,
  MARKETING_PAGES_WORKSPACE_UNSUPPORTED,
  FORBIDDEN_MARKETING_PAGES_MODULE_DISABLED,
} from "./marketing-pages-module-enabled";
import { getMarketingPagesService } from "./marketing-pages.service";
import { resolvePublicIngressSubdomain } from "../tenant/resolve-public-ingress-subdomain";
import { resolvePublicTenantContextBySubdomain } from "../tenant/tenant-branding.service";

function mapMarketingPagesError(res: ServerResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message === MARKETING_PAGES_WORKSPACE_UNSUPPORTED ||
    message === MARKETING_PAGE_KEY_NOT_ALLOWED
  ) {
    sendHttpError(res, 404, { error: "not_found", code: message });
    return;
  }
  if (message === FORBIDDEN_MARKETING_PAGES_MODULE_DISABLED) {
    sendHttpError(res, 403, { error: "forbidden", code: message });
    return;
  }
  if (message === "MARKETING_PAGE_DRAFT_REQUIRED") {
    sendHttpError(res, 400, { error: "bad_request", code: message });
    return;
  }
  if (message.startsWith("ZodError") || message.includes("Required")) {
    sendHttpError(res, 400, { error: "bad_request", code: "MARKETING_PAGE_INVALID_BODY" });
    return;
  }
  handleHttpError(res, error);
}

function readLocaleFromRequest(req: IncomingMessage, url: URL): string {
  const headerLocale = req.headers["x-tenant-locale"];
  if (typeof headerLocale === "string" && headerLocale.trim().length > 0) {
    return headerLocale;
  }
  const queryLocale = url.searchParams.get("locale");
  if (queryLocale !== null && queryLocale.trim().length > 0) {
    return queryLocale;
  }
  return "fa";
}

function isAdminOrOwner(role: string): boolean {
  return role === "admin" || role === "owner";
}

export async function handlePublicMarketingPage(
  req: IncomingMessage,
  res: ServerResponse,
  pageKey: string,
): Promise<void> {
  try {
    const host = readIngressHost(req);
    const subdomain = await resolvePublicIngressSubdomain(host);
    const context = await resolvePublicTenantContextBySubdomain(subdomain);
    if (context === null) {
      sendHttpError(res, 404, { error: "not_found", code: "TENANT_NOT_FOUND" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const locale = readLocaleFromRequest(req, url);
    const service = getMarketingPagesService();
    const page = await service.getPublishedPublicPage(
      context.tenantId,
      context.workspaceType,
      pageKey,
      locale,
    );
    if (page === null) {
      sendHttpError(res, 404, { error: "not_found", code: "MARKETING_PAGE_NOT_PUBLISHED" });
      return;
    }
    sendJson(res, 200, page);
  } catch (error) {
    mapMarketingPagesError(res, error);
  }
}

export async function handleGetOperatorMarketingPage(
  req: IncomingMessage,
  res: ServerResponse,
  pageKey: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const locale = readLocaleFromRequest(req, url);
    const service = getMarketingPagesService();
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await service.getOperatorPage(auth.tenantId, pageKey, locale);
        sendJson(res, 200, page);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    mapMarketingPagesError(res, error);
  }
}

export async function handlePatchOperatorMarketingPage(
  req: IncomingMessage,
  res: ServerResponse,
  pageKey: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    if (!isAdminOrOwner(auth.role)) {
      sendHttpError(res, 403, { error: "forbidden", code: "FORBIDDEN" });
      return;
    }
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = parseJsonBody(rawBody);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const locale = readLocaleFromRequest(req, url);
    const service = getMarketingPagesService();
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await service.saveDraft(auth.tenantId, pageKey, locale, parsedBody);
        sendJson(res, 200, page);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    mapMarketingPagesError(res, error);
  }
}

export async function handlePublishOperatorMarketingPage(
  req: IncomingMessage,
  res: ServerResponse,
  pageKey: string,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    if (!isAdminOrOwner(auth.role)) {
      sendHttpError(res, 403, { error: "forbidden", code: "FORBIDDEN" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const locale = readLocaleFromRequest(req, url);
    const service = getMarketingPagesService();
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await service.publish(auth.tenantId, pageKey, locale);
        sendJson(res, 200, page);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    mapMarketingPagesError(res, error);
  }
}
