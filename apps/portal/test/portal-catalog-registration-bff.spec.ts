/**
 * EPH Track VI — catalog registration BFF typed errors
 * @see docs/phase-19/platform-portal-registration-intake.mdoc § BFF error taxonomy
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-catalog-registration-bff (EPH VI)", () => {
  it("REG-BFF-01 registration route exposes typed build failures (not REGISTRATION_CLOSED mask)", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/catalog/registrations/route.ts"),
      "utf8"
    );
    assert.match(route, /buildCatalogRegistrationUpstreamRequest/);
    assert.match(route, /CatalogRegistrationPayloadInvalidError/);
    assert.match(route, /IntakePluginNotRegisteredError/);
    assert.match(route, /REGISTRATION_UPSTREAM_BUILD_FAILED/);
    assert.doesNotMatch(route, /REGISTRATION_CLOSED.*buildCatalogRegistrationUpstreamRequest/s);
  });
});
