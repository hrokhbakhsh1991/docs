#!/usr/bin/env node
/**
 * P5-A-N-007 — bind a staging smoke tenant to a published workspace definition.
 *
 * Usage:
 *   node apps/api/scripts/smoke-metadata-pilot-bind.mjs --help
 *   API_BASE=http://127.0.0.1:4000 PILOT_TENANT_ID=<uuid> \
 *     node apps/api/scripts/smoke-metadata-pilot-bind.mjs
 *
 * @see docs/phase-18/platform-metadata-cutover-pilot.mdoc § Smoke bind script
 */
import assert from "node:assert/strict";

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(`smoke-metadata-pilot-bind — PATCH platform tenant workspace binding (staging only)

Env (required):
  PILOT_TENANT_ID          Smoke club tenant UUID

Env (optional):
  API_BASE                 default http://127.0.0.1:4000
  PILOT_DEFINITION_ID      default denali-tour-ops
  PILOT_DEFINITION_VERSION pin published version (omit = latest)
  PLATFORM_OPS_PHONE       X-Platform-Ops-Phone header
  PLATFORM_OPS_BEARER_TOKEN / PLATFORM_OPS_TOKEN

Safety:
  Refuses when NODE_ENV=production unless SMOKE_METADATA_PILOT_BIND_ALLOW=1
  Set WORKSPACE_METADATA_ENABLED=true on API before expecting metadata path
`);
  process.exit(0);
}

if (process.env.NODE_ENV === "production" && process.env.SMOKE_METADATA_PILOT_BIND_ALLOW !== "1") {
  console.error(
    "smoke-metadata-pilot-bind: refused — NODE_ENV=production (set SMOKE_METADATA_PILOT_BIND_ALLOW=1 to override)"
  );
  process.exit(1);
}

const tenantId = process.env.PILOT_TENANT_ID?.trim();
if (!tenantId) {
  console.error("smoke-metadata-pilot-bind: PILOT_TENANT_ID is required");
  process.exit(1);
}

const apiBase = (process.env.API_BASE ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const phone = process.env.PLATFORM_OPS_PHONE ?? "+989121234567";
const token =
  process.env.PLATFORM_OPS_BEARER_TOKEN ??
  process.env.PLATFORM_OPS_TOKEN ??
  "platform-ops";
const definitionId = process.env.PILOT_DEFINITION_ID?.trim() ?? "denali-tour-ops";
const definitionVersionRaw = process.env.PILOT_DEFINITION_VERSION?.trim();

const headers = {
  Authorization: `Bearer ${token}`,
  "X-Platform-Ops-Phone": phone,
  "Content-Type": "application/json",
};

const patchBody = {
  definitionId,
  ...(definitionVersionRaw && definitionVersionRaw.length > 0
    ? { definitionVersion: Number.parseInt(definitionVersionRaw, 10) }
    : {}),
};

const patchResponse = await fetch(
  `${apiBase}/platform/v1/tenants/${encodeURIComponent(tenantId)}/workspace-definition`,
  {
    method: "PATCH",
    headers,
    body: JSON.stringify(patchBody),
  }
);

const patchJson = await patchResponse.json().catch(() => ({}));
if (!patchResponse.ok) {
  console.error(
    JSON.stringify(
      { step: "patch", status: patchResponse.status, body: patchJson },
      null,
      2
    )
  );
  process.exit(1);
}

assert.ok(
  patchJson.workspaceDefinition?.definitionId === definitionId,
  "PATCH must return workspaceDefinition.definitionId"
);

const detailResponse = await fetch(
  `${apiBase}/platform/v1/tenants/${encodeURIComponent(tenantId)}`,
  { method: "GET", headers }
);
const detailJson = await detailResponse.json().catch(() => ({}));
if (!detailResponse.ok) {
  console.error(
    JSON.stringify(
      { step: "get", status: detailResponse.status, body: detailJson },
      null,
      2
    )
  );
  process.exit(1);
}

const binding = detailJson.workspaceDefinition;
assert.ok(binding?.definitionId === definitionId, "GET tenant detail binding must match");
assert.ok(
  binding?.metadataCutoverStage === "off" ||
    binding?.metadataCutoverStage === "pilot" ||
    binding?.metadataCutoverStage === "live",
  "metadataCutoverStage must be present on bound tenant"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      tenantId,
      workspaceDefinition: binding,
      hint:
        binding.metadataCutoverStage === "off"
          ? "Set WORKSPACE_METADATA_ENABLED=true (and allowlist if pilot) on API pods"
          : undefined,
    },
    null,
    2
  )
);

process.exit(0);
