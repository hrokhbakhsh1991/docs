import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const BINDINGS = join(
  REPO_ROOT,
  "packages/workspaces/urban/src/catalog/urban-catalog-exposure-bindings.ts",
);
const CATALOG_SERVICE = join(
  REPO_ROOT,
  "packages/workspaces/urban/src/http/catalog.service.ts",
);
const URBAN_HOST = join(REPO_ROOT, "apps/api/src/http/configure-urban-http-host.ts");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");

describe("field exposure Urban catalog redaction contract", () => {
  it("documents urban catalog redaction integration path", () => {
    const doc = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(doc, /Urban catalog redaction/);
    assert.match(doc, /field-exposure-urban-catalog-redaction\.contract\.spec\.ts/);
    assert.match(doc, /urban-catalog-exposure\.spec\.ts/);
  });

  it("binds urban registry field ids to catalog card redaction steps", () => {
    const bindings = readFileSync(BINDINGS, "utf8");
    assert.match(bindings, /URBAN_CATALOG_CARD_EXPOSURE_BINDINGS/);
    assert.match(bindings, /applyUrbanCatalogCardExposure/);
    assert.match(bindings, /fieldId: "tour\.city"/);
    assert.match(bindings, /fieldId: "tour\.coverImageUrl"/);
  });

  it("applies exposure resolver output in Urban catalog HTTP service", () => {
    const service = readFileSync(CATALOG_SERVICE, "utf8");
    assert.match(service, /applyCatalogExposure/);
    assert.match(service, /resolveVisibleFieldIds/);
    assert.match(service, /applyUrbanCatalogCardExposure/);
  });

  it("wires Urban exposure resolver port in product HTTP host", () => {
    const host = readFileSync(URBAN_HOST, "utf8");
    assert.match(host, /buildUrbanExposureResolverPort/);
    assert.match(host, /resolveExposureResolverPort/);
  });

  it("falls back to seeded defaults when Prisma unavailable (DB-less smoke)", () => {
    const resolver = readFileSync(
      join(REPO_ROOT, "apps/api/src/http/configure-urban-surface-exposure.ts"),
      "utf8",
    );
    assert.match(resolver, /tryResolvePersistedExposureProfile/);
    assert.match(resolver, /tryFindExposureIntent/);
  });
});
