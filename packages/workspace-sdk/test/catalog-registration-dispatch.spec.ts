import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { buildCatalogRegistrationUpstreamRequest } from "../src/catalog/build-catalog-registration-upstream-request";
import { resolveCatalogRegistrationApiPath } from "../src/catalog/resolve-catalog-registration-api-path";
import { supportsCatalogRegistration } from "../src/catalog/resolve-catalog-registration-support";
import {
  resolveIntakeSchema,
  IntakePluginNotRegisteredError,
} from "../src/catalog/resolve-intake-schema";
import {
  clearWorkspaceIntakePluginRegistryForTests,
  registerWorkspaceIntakePlugin,
} from "../src/catalog/workspace-intake-plugin-registry";
import {
  denaliCatalogIntakeFixture,
  urbanCatalogIntakeFixture,
} from "./fixtures/catalog-intake-plugins";

function bootstrapIntakePluginsForTests(): void {
  clearWorkspaceIntakePluginRegistryForTests();
  registerWorkspaceIntakePlugin({
    id: "denali",
    catalogIntake: denaliCatalogIntakeFixture,
  });
  registerWorkspaceIntakePlugin({
    id: "urban",
    catalogIntake: urbanCatalogIntakeFixture,
  });
}

describe("catalog-registration-dispatch (registry)", () => {
  before(() => {
    bootstrapIntakePluginsForTests();
  });

  const basePayload = {
    tourId: "tour-1",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "",
    partySize: 2,
    notes: "",
    nationalId: "1234567890",
    fatherName: "Byron",
    birthDate: "1815-12-10",
  } as const;

  it("SDK-REG-01 denali upstream path and body", () => {
    const schema = resolveIntakeSchema("denali");
    assert.equal(schema.features.transportIntake, true);
    assert.equal(schema.features.idempotencyKey, true);
    assert.equal(resolveCatalogRegistrationApiPath("denali"), "/denali/registrations");

    const built = buildCatalogRegistrationUpstreamRequest(
      "denali",
      {
        ...basePayload,
        registrantTarget: "self",
      },
      { idempotencyKey: "test-denali-idem-1" }
    );
    assert.equal(built.path, "/denali/registrations");
    assert.match(JSON.stringify(built.body), /"nationalId":"1234567890"/);
    assert.equal(built.extraHeaders?.["Idempotency-Key"], "test-denali-idem-1");
  });

  it("SDK-REG-01b denali mints Idempotency-Key when client omits it", () => {
    const built = buildCatalogRegistrationUpstreamRequest("denali", {
      ...basePayload,
      registrantTarget: "self",
    });
    assert.match(built.extraHeaders?.["Idempotency-Key"] ?? "", /^portal-denali-reg-/);
  });

  it("SDK-REG-02 urban upstream requires email", () => {
    const schema = resolveIntakeSchema("urban");
    assert.equal(schema.features.idempotencyKey, true);
    assert.throws(
      () =>
        buildCatalogRegistrationUpstreamRequest("urban", {
          ...basePayload,
          email: "",
        }),
      /EMAIL_REQUIRED/
    );
  });

  it("SDK-REG-03 starter is not registered for catalog intake", () => {
    assert.equal(supportsCatalogRegistration("starter"), false);
    assert.throws(
      () => buildCatalogRegistrationUpstreamRequest("starter", basePayload),
      (error: unknown) => error instanceof IntakePluginNotRegisteredError
    );
  });
});
