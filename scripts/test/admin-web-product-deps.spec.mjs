/**
 * Wave I.8 — admin web product deps sync helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAdminWebDevDependencies,
  collectAdminHostProductPackages,
  stripAdminHostProductWorkspaceDeps,
} from "../codegen/workspace-registry/domains/theme.mjs";

const FIXTURES = [
  {
    id: "starter",
    package: "@app-tour/workspace-starter",
  },
  {
    id: "denali",
    package: "@app-tour/workspace-denali",
    themeStylesheets: ["theme.css"],
  },
  {
    id: "finance-ws2",
    package: "@app-tour/workspace-finance-ws2",
    workspaceFinance: { registryOnly: true },
  },
  {
    id: "booking-ws2",
    package: "@app-tour/workspace-booking-ws2",
  },
];

describe("admin web product deps codegen (Wave I.8)", () => {
  it("collectAdminHostProductPackages skips registryOnly", () => {
    const products = collectAdminHostProductPackages(FIXTURES);
    assert.deepEqual(products, [
      "@app-tour/workspace-booking-ws2",
      "@app-tour/workspace-denali",
      "@app-tour/workspace-starter",
    ]);
  });

  it("buildAdminWebDevDependencies syncs products and keeps platform deps", () => {
    const next = buildAdminWebDevDependencies(
      {
        "@app-tour/config": "workspace:*",
        "@app-tour/workspace-finance-ws4": "workspace:*",
        typescript: "5.9.3",
      },
      collectAdminHostProductPackages(FIXTURES)
    );
    assert.equal(next["@app-tour/config"], "workspace:*");
    assert.equal(next.typescript, "5.9.3");
    assert.equal(next["@app-tour/workspace-finance-ws4"], undefined);
    assert.equal(next["@app-tour/workspace-denali"], "workspace:*");
    assert.equal(next["@app-tour/workspace-starter"], "workspace:*");
    assert.equal(next["@app-tour/workspace-booking-ws2"], "workspace:*");
  });

  it("stripAdminHostProductWorkspaceDeps removes product keys from dependencies", () => {
    const next = stripAdminHostProductWorkspaceDeps({
      "@app-tour/workspace-sdk": "workspace:*",
      "@app-tour/workspace-starter": "workspace:*",
      next: "^15.1.8",
    });
    assert.deepEqual(next, {
      "@app-tour/workspace-sdk": "workspace:*",
      next: "^15.1.8",
    });
  });
});
