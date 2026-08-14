/**
 * P4-B — portal catalog registrations dispatch contract + headers
 * @see docs/phase-19/platform-portal-registration-intake.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { mergeCatalogRegistrationHeaders } from "../src/catalog/build-catalog-registration-headers.server";

const ROUTE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../app/api/catalog/registrations/route.ts"
);

describe("portal-catalog-registrations-dispatch (P4-B PR-10b/c)", () => {
  it("PR-10b route uses SDK upstream builder (denali contact profile)", () => {
    const source = readFileSync(ROUTE_PATH, "utf8");
    assert.match(source, /buildCatalogRegistrationUpstreamRequest/);
    assert.doesNotMatch(source, /bootstrap\.pluginId === "denali"/);
  });

  it("PR-10b2 route upgrades session via buildMemberApiHeaders (Bearer + x-user)", () => {
    const source = readFileSync(ROUTE_PATH, "utf8");
    assert.match(source, /buildMemberApiHeaders/);
    assert.doesNotMatch(source, /buildCatalogRegistrationHeaders/);
  });

  it("PR-10b3 route fail-closes when requiresMemberSession and no Bearer", () => {
    const source = readFileSync(ROUTE_PATH, "utf8");
    assert.match(source, /resolveIntakeSchema/);
    assert.match(source, /requiresMemberSession/);
    assert.match(source, /AUTH_UNAUTHENTICATED/);
  });

  it("PR-10c route forwards idempotency key via SDK builder", () => {
    const source = readFileSync(ROUTE_PATH, "utf8");
    assert.match(source, /idempotency-key/);
    assert.match(source, /Idempotency-Key/);
  });

  it("PR-10d mergeCatalogRegistrationHeaders guest uses x-tenant-id only", () => {
    const headers = mergeCatalogRegistrationHeaders("00000000-0000-4000-8000-000000000003", null);
    assert.equal(headers["x-tenant-id"], "00000000-0000-4000-8000-000000000003");
    assert.equal(headers["x-user-id"], undefined);
  });

  it("PR-10e mergeCatalogRegistrationHeaders session upgrades member headers", () => {
    const tenantId = "00000000-0000-4000-8000-000000000004";
    const headers = mergeCatalogRegistrationHeaders(tenantId, {
      tenantId,
      userId: "00000000-0000-4000-8000-000000000099",
      role: "member",
      workspaceId: "ws-public-smoke",
    });
    assert.equal(headers["x-user-id"], "00000000-0000-4000-8000-000000000099");
    assert.equal(headers["x-actor-role"], "member");
    assert.equal(headers["x-membership-status"], "ACTIVE");
    assert.equal(headers["x-workspace-id"], "ws-public-smoke");
  });
});
