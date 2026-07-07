#!/usr/bin/env node
/**
 * Platform provision smoke — POST /platform/v1/tenants and print JSON response.
 *
 * Usage:
 *   node apps/api/scripts/smoke-platform-provision.mjs --help
 *   API_BASE=http://127.0.0.1:4000 PLATFORM_OPS_PHONE=+989121234567 \
 *     node apps/api/scripts/smoke-platform-provision.mjs
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(`smoke-platform-provision — POST /platform/v1/tenants smoke

Env:
  API_BASE             default http://127.0.0.1:4000
  PLATFORM_OPS_PHONE   X-Platform-Ops-Phone header value
  PLATFORM_OPS_TOKEN   Authorization bearer (alias for PLATFORM_OPS_BEARER_TOKEN; default platform-ops)
  PLATFORM_OPS_BEARER_TOKEN
`);
  process.exit(0);
}

const apiBase = (process.env.API_BASE ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const phone = process.env.PLATFORM_OPS_PHONE ?? "+989121234567";
const token =
  process.env.PLATFORM_OPS_BEARER_TOKEN ??
  process.env.PLATFORM_OPS_TOKEN ??
  "platform-ops";
const subdomain = `smoke-${Date.now().toString(36)}`;

const response = await fetch(`${apiBase}/platform/v1/tenants`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "X-Platform-Ops-Phone": phone,
    "Idempotency-Key": randomUUID(),
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    subdomain,
    workspaceType: "denali",
    ownerPhone: phone,
  }),
});

const body = await response.json().catch(() => ({}));
console.log(JSON.stringify({ status: response.status, body }, null, 2));
assert.equal(response.status, 201, `expected 201, got ${response.status}`);
assert.ok(typeof body.tenant?.id === "string" && body.tenant.id.length > 0, "tenant.id required");
assert.ok(body.sites !== undefined && body.sites !== null, "sites required");
assert.ok(
  typeof body.invite?.inviteToken === "string" && body.invite.inviteToken.length > 0,
  "invite.inviteToken required"
);
process.exit(0);
