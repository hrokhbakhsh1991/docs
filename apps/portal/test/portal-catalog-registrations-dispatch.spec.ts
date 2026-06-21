/**
 * P4-B — portal catalog registrations dispatch contract + headers
 * @see docs/phase-17/platform-portal-registration.mdoc (PR-10b/c)
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
  it("PR-10b route dispatches denali registrations with contact payload", () => {
    const source = readFileSync(ROUTE_PATH, "utf8");
    assert.match(source, /bootstrap\.pluginId === "denali"/);
    assert.match(source, /`\$\{apiBase\}\/denali\/registrations`/);
    assert.match(source, /contact:\s*\{/);
  });

  it("PR-10c route dispatches urban registrations with Idempotency-Key", () => {
    const source = readFileSync(ROUTE_PATH, "utf8");
    assert.match(source, /bootstrap\.pluginId === "urban"/);
    assert.match(source, /`\$\{apiBase\}\/urban\/registrations`/);
    assert.match(source, /Idempotency-Key/);
    assert.match(source, /idempotency-key/);
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
    });
    assert.equal(headers["x-user-id"], "00000000-0000-4000-8000-000000000099");
    assert.equal(headers["x-actor-role"], "member");
    assert.equal(headers["x-membership-status"], "ACTIVE");
  });
});
