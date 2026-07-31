/**
 * PSR-4b-api-deps-sync — apps/api workspace product deps sync helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildApiDependencies,
  collectApiHostManifestPackages,
  isApiHostRegistryOnlyFixtureManifest,
  partitionApiHostManifestPackages,
  stripApiHostProductWorkspaceDeps,
} from "../codegen/workspace-registry/domains/theme.mjs";

const FIXTURES = [
  {
    id: "starter",
    package: "@app-tour/workspace-starter",
  },
  {
    id: "denali",
    package: "@app-tour/workspace-denali",
  },
  {
    id: "finance-ws2",
    package: "@app-tour/workspace-finance-ws2",
    workspaceFinance: { registryOnly: true },
  },
  {
    id: "booking-ws2",
    package: "@app-tour/workspace-booking-ws2",
    workspaceBooking: { registryOnly: true },
  },
];

describe("api host product deps codegen (PSR-4b-api-deps-sync)", () => {
  it("collectApiHostManifestPackages includes registryOnly fixtures", () => {
    const products = collectApiHostManifestPackages(FIXTURES);
    assert.deepEqual(products, [
      "@app-tour/workspace-booking-ws2",
      "@app-tour/workspace-denali",
      "@app-tour/workspace-finance-ws2",
      "@app-tour/workspace-starter",
    ]);
  });

  it("partitionApiHostManifestPackages separates registryOnly fixtures (retain-on-API)", () => {
    const parts = partitionApiHostManifestPackages(FIXTURES);
    assert.deepEqual(parts.registryOnlyFixtures, [
      "@app-tour/workspace-booking-ws2",
      "@app-tour/workspace-finance-ws2",
    ]);
    assert.deepEqual(parts.nonRegistryOnly, [
      "@app-tour/workspace-denali",
      "@app-tour/workspace-starter",
    ]);
    assert.equal(isApiHostRegistryOnlyFixtureManifest(FIXTURES[2]), true);
    assert.equal(isApiHostRegistryOnlyFixtureManifest(FIXTURES[0]), false);
  });

  it("buildApiDependencies syncs all manifests and keeps platform + sdk", () => {
    const next = buildApiDependencies(
      {
        "@app-tour/platform-core": "workspace:*",
        "@app-tour/workspace-sdk": "workspace:*",
        "@app-tour/workspace-finance-ws4": "workspace:*",
        zod: "^3.24.2",
      },
      collectApiHostManifestPackages(FIXTURES),
    );
    assert.equal(next["@app-tour/platform-core"], "workspace:*");
    assert.equal(next["@app-tour/workspace-sdk"], "workspace:*");
    assert.equal(next.zod, "^3.24.2");
    assert.equal(next["@app-tour/workspace-denali"], "workspace:*");
    assert.equal(next["@app-tour/workspace-finance-ws2"], "workspace:*");
    assert.equal(next["@app-tour/workspace-finance-ws4"], undefined);
    assert.deepEqual(
      Object.keys(next).filter((n) => n.startsWith("@app-tour/workspace-") && n !== "@app-tour/workspace-sdk"),
      [
        "@app-tour/workspace-booking-ws2",
        "@app-tour/workspace-denali",
        "@app-tour/workspace-finance-ws2",
        "@app-tour/workspace-starter",
      ],
    );
  });

  it("stripApiHostProductWorkspaceDeps keeps sdk", () => {
    const next = stripApiHostProductWorkspaceDeps({
      "@app-tour/workspace-sdk": "workspace:*",
      "@app-tour/workspace-denali": "workspace:*",
      typescript: "5.9.3",
    });
    assert.deepEqual(next, {
      "@app-tour/workspace-sdk": "workspace:*",
      typescript: "5.9.3",
    });
  });
});
