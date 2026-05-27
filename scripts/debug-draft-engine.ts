/**
 * Automated debugger for the draft-engine GET endpoint.
 *
 * Performs OTP login (same dev flow as e2e helpers) and calls:
 *   GET /api/v2/workspaces/:tenantId/draft-engine/:draftKey
 *
 * Usage (from repo root):
 *   pnpm debug:draft-engine
 *   pnpm --dir apps/api exec node --import tsx ../../scripts/debug-draft-engine.ts
 *
 * Optional: node --env-file=apps/api/.env … when DB-backed env vars are needed.
 *   DRAFT_DEBUG_API_BASE       default http://127.0.0.1:3001
 *   DRAFT_DEBUG_TENANT_SUBDOMAIN default denali
 *   DRAFT_DEBUG_PHONE            default +989121000001
 *   DRAFT_DEBUG_OTP              default 1234
 *   DRAFT_DEBUG_DRAFT_KEY        default denali-create
 *   DRAFT_DEBUG_WORKSPACE_ID     optional; otherwise read from JWT tenant_id
 *   TENANT_ROOT_DOMAIN           default localhost
 */

import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const E2E_DEV_OTP = "1234";

function readEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function tenantHost(slug: string): string {
  const tenantRoot = readEnv("TENANT_ROOT_DOMAIN", "localhost");
  if (tenantRoot === "localhost") {
    // Match e2e helpers (`tenantTestHost`) — port belongs on the URL, not the Host header.
    return `${slug}.localhost`;
  }
  return `${slug}.${tenantRoot}`;
}

type HttpJsonResult = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
};

/**
 * Node fetch overwrites Host when the URL is an IP; use http.request so tenant Host
 * matches e2e `tenantTestHost` / supertest `.set("Host", ...)`.
 */
function httpJson(params: {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  hostHeader: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<HttpJsonResult> {
  const target = new URL(params.url);
  const transport = target.protocol === "https:" ? https : http;
  const payload =
    params.body === undefined ? undefined : JSON.stringify(params.body);

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: params.method,
        headers: {
          Host: params.hostHeader,
          Accept: "application/json",
          ...(payload != null ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...params.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: unknown = text.length > 0 ? text : null;
          try {
            body = text.length > 0 ? (JSON.parse(text) as unknown) : null;
          } catch {
            /* keep raw text */
          }
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (value != null) {
              headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
            }
          }
          resolve({ status: res.statusCode ?? 0, body, headers });
        });
      },
    );
    req.on("error", reject);
    if (payload != null) {
      req.write(payload);
    }
    req.end();
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const segment = token.split(".")[1];
  if (!segment) {
    throw new Error("Invalid JWT: missing payload segment");
  }
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

async function loginWithOtp(params: {
  apiBase: string;
  hostHeader: string;
  phone: string;
  otp: string;
}): Promise<{ token: string; body: unknown }> {
  const url = `${params.apiBase.replace(/\/$/, "")}/api/v2/auth/web/session/otp`;
  console.log(`\n--- Auth: POST ${url} ---`);
  console.log(`Host: ${params.hostHeader}`);
  console.log(`Phone: ${params.phone}`);

  const res = await httpJson({
    method: "POST",
    url,
    hostHeader: params.hostHeader,
    body: { phone: params.phone, otp: params.otp },
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `OTP login failed: HTTP ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  const body = res.body;
  const sessionToken =
    typeof body === "object" &&
    body != null &&
    "session_token" in body &&
    typeof (body as { session_token?: unknown }).session_token === "string"
      ? (body as { session_token: string }).session_token
      : null;

  if (!sessionToken) {
    throw new Error(`OTP login response missing session_token: ${JSON.stringify(body)}`);
  }

  console.log(`Auth OK — JWT length=${sessionToken.length}`);
  return { token: sessionToken, body };
}

async function patchDraftSnapshot(params: {
  apiBase: string;
  hostHeader: string;
  token: string;
  workspaceId: string;
  draftKey: string;
  body: {
    data: Record<string, unknown>;
    version: number;
    schemaVersion?: number;
    lastModified: number;
  };
}): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const path = `/api/v2/workspaces/${encodeURIComponent(params.workspaceId)}/draft-engine/${encodeURIComponent(params.draftKey)}`;
  const url = `${params.apiBase.replace(/\/$/, "")}${path}`;

  return httpJson({
    method: "PATCH",
    url,
    hostHeader: params.hostHeader,
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
    body: params.body,
  });
}

async function deleteDraftSnapshot(params: {
  apiBase: string;
  hostHeader: string;
  token: string;
  workspaceId: string;
  draftKey: string;
}): Promise<{ status: number; body: unknown }> {
  const path = `/api/v2/workspaces/${encodeURIComponent(params.workspaceId)}/draft-engine/${encodeURIComponent(params.draftKey)}`;
  const url = `${params.apiBase.replace(/\/$/, "")}${path}`;

  return httpJson({
    method: "DELETE",
    url,
    hostHeader: params.hostHeader,
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
  });
}

async function fetchDraftSnapshot(params: {
  apiBase: string;
  hostHeader: string;
  token: string;
  workspaceId: string;
  draftKey: string;
}): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const path = `/api/v2/workspaces/${encodeURIComponent(params.workspaceId)}/draft-engine/${encodeURIComponent(params.draftKey)}`;
  const url = `${params.apiBase.replace(/\/$/, "")}${path}`;

  console.log(`\n--- Draft GET ${url} ---`);
  console.log(`Authorization: Bearer <${params.token.slice(0, 12)}…>`);
  console.log(`Host: ${params.hostHeader}`);

  return httpJson({
    method: "GET",
    url,
    hostHeader: params.hostHeader,
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
  });
}

async function main(): Promise<void> {
  const apiBase = readEnv("DRAFT_DEBUG_API_BASE", "http://127.0.0.1:3001");
  const tenantSubdomain = readEnv("DRAFT_DEBUG_TENANT_SUBDOMAIN", "denali");
  const phone = readEnv("DRAFT_DEBUG_PHONE", "+989121000001");
  const otp = readEnv("DRAFT_DEBUG_OTP", E2E_DEV_OTP);
  const draftKey =
    readEnv("DRAFT_DEBUG_DRAFT_KEY", "") ||
    `debug-occ-${Date.now().toString(36)}`;
  const hostHeader = tenantHost(tenantSubdomain);

  console.log("========================================");
  console.log("Draft Engine API Debugger");
  console.log("========================================");
  console.log(`API base: ${apiBase}`);
  console.log(`Tenant subdomain: ${tenantSubdomain}`);
  console.log(`Draft key: ${draftKey}`);

  const { token } = await loginWithOtp({ apiBase, hostHeader, phone, otp });
  const jwt = decodeJwtPayload(token);

  const workspaceIdFromEnv = readEnv("DRAFT_DEBUG_WORKSPACE_ID", "");
  const workspaceId =
    workspaceIdFromEnv ||
    (typeof jwt.tenant_id === "string" && jwt.tenant_id.trim()) ||
    (typeof jwt.tenantId === "string" && jwt.tenantId.trim()) ||
    "";

  if (!workspaceId) {
    throw new Error(
      "Could not resolve workspace UUID from JWT (tenant_id). Set DRAFT_DEBUG_WORKSPACE_ID.",
    );
  }

  const userId =
    (typeof jwt.sub === "string" && jwt.sub) ||
    (typeof jwt.user_id === "string" && jwt.user_id) ||
    "unknown";

  console.log("\n--- Session context (from JWT) ---");
  console.log(`workspaceId: ${workspaceId}`);
  console.log(`userId: ${userId}`);
  console.log(`role: ${typeof jwt.role === "string" ? jwt.role : "unknown"}`);

  const draftResponse = await fetchDraftSnapshot({
    apiBase,
    hostHeader,
    token,
    workspaceId,
    draftKey,
  });

  console.log("\n--- GET response ---");
  console.log(`status: ${draftResponse.status}`);
  console.log(`body: ${JSON.stringify(draftResponse.body, null, 2)}`);

  if (draftResponse.body == null) {
    console.log("\n(note) Empty/null body — check API logs for DEBUG-TRACE empty-row message.");
  }

  console.log("\n--- OCC PATCH sequence (isolated draft key → create → bump → stale → expect 409) ---");

  const patchPayload = {
    data: { probe: "draft-engine-debug", step: 0 },
    lastModified: Date.now(),
  };

  const createRes = await patchDraftSnapshot({
    apiBase,
    hostHeader,
    token,
    workspaceId,
    draftKey,
    body: { ...patchPayload, version: 0, schemaVersion: 1 },
  });
  console.log(`PATCH create (version 0): HTTP ${createRes.status}`);
  console.log(JSON.stringify(createRes.body, null, 2));
  assert.ok(
    createRes.status >= 200 && createRes.status < 300,
    `create PATCH should succeed (got ${createRes.status})`,
  );
  const baseVersion =
    typeof createRes.body === "object" &&
    createRes.body != null &&
    "version" in createRes.body &&
    typeof (createRes.body as { version?: unknown }).version === "number"
      ? (createRes.body as { version: number }).version
      : 1;

  const bumpRes = await patchDraftSnapshot({
    apiBase,
    hostHeader,
    token,
    workspaceId,
    draftKey,
    body: {
      data: { probe: "draft-engine-debug", step: 1 },
      version: baseVersion,
      schemaVersion: 1,
      lastModified: Date.now(),
    },
  });
  console.log(`PATCH bump (version ${baseVersion}): HTTP ${bumpRes.status}`);
  console.log(JSON.stringify(bumpRes.body, null, 2));
  assert.ok(bumpRes.status >= 200 && bumpRes.status < 300, "bump PATCH should succeed");

  const bumpedVersion =
    typeof bumpRes.body === "object" &&
    bumpRes.body != null &&
    "version" in bumpRes.body &&
    typeof (bumpRes.body as { version?: unknown }).version === "number"
      ? (bumpRes.body as { version: number }).version
      : baseVersion + 1;

  assert.ok(
    bumpedVersion > baseVersion,
    `bump must advance version (got ${bumpedVersion}, was ${baseVersion})`,
  );

  const staleRes = await patchDraftSnapshot({
    apiBase,
    hostHeader,
    token,
    workspaceId,
    draftKey,
    body: {
      data: { probe: "draft-engine-debug", step: 2 },
      version: baseVersion,
      schemaVersion: 1,
      lastModified: Date.now(),
    },
  });
  console.log(`PATCH stale (version ${baseVersion} again): HTTP ${staleRes.status}`);
  console.log(JSON.stringify(staleRes.body, null, 2));
  assert.equal(staleRes.status, 409, "stale PATCH must return 409 Conflict");
  const staleServer =
    typeof staleRes.body === "object" &&
    staleRes.body != null &&
    "error" in staleRes.body &&
    typeof (staleRes.body as { error?: { details?: { server?: unknown } } }).error?.details?.server ===
      "object"
      ? (staleRes.body as { error: { details: { server: unknown } } }).error.details.server
      : null;
  assert.ok(staleServer != null, "409 response must include error.details.server for client recovery");
  console.log("409 includes server snapshot:", JSON.stringify(staleServer, null, 2));

  const errorCode =
    typeof draftResponse.body === "object" &&
    draftResponse.body != null &&
    "error" in draftResponse.body &&
    typeof (draftResponse.body as { error?: { code?: unknown } }).error?.code === "string"
      ? (draftResponse.body as { error: { code: string } }).error.code
      : null;
  if (errorCode === "SCHEMA_DRIFT_MISSING_TABLE") {
    console.log(
      "\n(hint) draft_snapshots table missing — run: pnpm --filter @apps/api migrate:run",
    );
  }

  console.log("\n--- Server-side DEBUG-TRACE ---");
  console.log(
    "Inspect the @apps/api dev terminal for lines prefixed with DEBUG-TRACE [A|B|C|end].",
  );

  console.log("\n========================================");
  console.log(
    draftResponse.status >= 200 && draftResponse.status < 300
      ? "Draft Engine debug run: SUCCESS"
      : "Draft Engine debug run: FAILED (see HTTP response above)",
  );
  console.log("========================================\n");

  if (draftResponse.status < 200 || draftResponse.status >= 300) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    "\nDraft Engine debug failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
