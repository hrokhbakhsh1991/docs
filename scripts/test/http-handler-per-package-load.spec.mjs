/**
 * Wave G.b — HTTP handler loaders must be per-package, not multi-product eager.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { generateWorkspaceHttpHandlerLoaders } from "../codegen/workspace-registry/domains/http-routes.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const FIXTURES = [
  {
    id: "denali",
    package: "@app-tour/workspace-denali",
    httpRoutes: {
      loadHandlersFromPackage: true,
      handlerPackage: "@app-tour/workspace-denali/host/http",
      groups: [
        {
          staticHandlers: { "GET /denali/catalog": "handleGetDenaliCatalog" },
          paramHandlers: {},
        },
      ],
    },
  },
  {
    id: "urban",
    package: "@app-tour/workspace-urban",
    httpRoutes: {
      loadHandlersFromPackage: true,
      handlerPackage: "@app-tour/workspace-urban/host/http",
      groups: [
        {
          staticHandlers: { "GET /urban/catalog": "handleGetUrbanCatalog" },
          paramHandlers: {},
        },
      ],
    },
  },
];

describe("http-handler-per-package-load.spec.mjs — Wave G.b", () => {
  it("G.b-01 codegen emits ensureWorkspaceHttpHandler + per-package loader", () => {
    const src = generateWorkspaceHttpHandlerLoaders(FIXTURES);
    assert.match(src, /export async function ensureWorkspaceHttpHandler/);
    assert.match(src, /export async function loadWorkspaceHttpHandlersForPackage/);
    assert.match(src, /WORKSPACE_HTTP_HANDLER_PACKAGE_BY_KEY/);
    assert.match(src, /case "@app-tour\/workspace-denali\/host\/http"/);
    assert.match(src, /case "@app-tour\/workspace-urban\/host\/http"/);
    assert.match(src, /loadWorkspaceHttpPackageHandlers/);
  });

  it("G.b-02 generated repo artifact uses per-package switch (not sequential multi-await in ensure)", () => {
    const generated = readFileSync(
      join(REPO_ROOT, "apps/api/src/http/workspace-http-handler-loaders.generated.ts"),
      "utf8"
    );
    assert.match(generated, /export async function ensureWorkspaceHttpHandler/);
    assert.match(generated, /workspaceHttpHandlerPackageCache/);
    const ensureStart = generated.indexOf("export async function ensureWorkspaceHttpHandler");
    const ensureEnd = generated.indexOf(
      "export async function loadWorkspaceHttpPackageHandlers",
      ensureStart
    );
    assert.ok(ensureStart >= 0 && ensureEnd > ensureStart);
    const ensureBody = generated.slice(ensureStart, ensureEnd);
    assert.doesNotMatch(ensureBody, /for \(const pkg of WORKSPACE_HTTP_HANDLER_PACKAGES\)/);
    assert.match(ensureBody, /loadWorkspaceHttpHandlersForPackage\(pkg\)/);
  });

  it("G.b-03 app.ts hot path uses resolveWorkspaceHttpHandler", () => {
    const app = readFileSync(join(REPO_ROOT, "apps/api/src/app.ts"), "utf8");
    assert.match(app, /resolveWorkspaceHttpHandler/);
    assert.doesNotMatch(app, /buildWorkspaceRouteHandlers/);
    assert.doesNotMatch(app, /loadWorkspaceHttpPackageHandlers/);
  });
});
