import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const BINDINGS = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/catalog/denali-catalog-exposure-bindings.ts",
);
const CATALOG_SERVICE = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/http/catalog.service.ts",
);
const DENALI_HOST = join(
  REPO_ROOT,
  "apps/api/src/http/configure-product-http-hosts.ts",
);
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");

describe("field exposure Denali catalog redaction contract (10.3)", () => {
  it("documents catalog redaction integration path", () => {
    const doc = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(doc, /Denali catalog redaction/);
    assert.match(doc, /field-exposure-denali-catalog-redaction\.contract\.spec\.ts/);
    assert.match(doc, /4-integration\/field-exposure-denali-catalog-redaction\.spec\.ts/);
    assert.match(doc, /4-integration\/field-exposure-denali-reminder-feed\.spec\.ts/);
  });

  it("binds registry field ids to catalog card redaction steps", () => {
    const bindings = readFileSync(BINDINGS, "utf8");
    assert.match(bindings, /DENALI_CATALOG_CARD_EXPOSURE_BINDINGS/);
    assert.match(bindings, /applyDenaliCatalogCardExposure/);
    assert.match(bindings, /fieldId: "title"/);
    assert.match(bindings, /fieldId: "denali\.datetime"/);
  });

  it("applies exposure resolver output in Denali catalog HTTP service", () => {
    const service = readFileSync(CATALOG_SERVICE, "utf8");
    assert.match(service, /applyCatalogExposure/);
    assert.match(service, /resolveVisibleFieldIds/);
    assert.match(service, /applyDenaliCatalogCardExposure/);
  });

  it("wires Denali exposure resolver port in product HTTP host", () => {
    const host = readFileSync(DENALI_HOST, "utf8");
    assert.match(host, /buildDenaliExposureResolverPort/);
    assert.match(host, /resolveExposureResolverPort/);
  });

  it("falls back to seeded defaults when Prisma unavailable (DB-less smoke)", () => {
    const resolver = readFileSync(
      join(REPO_ROOT, "apps/api/src/exposure/resolve-denali-surface-exposure.ts"),
      "utf8",
    );
    assert.match(resolver, /tryResolvePersistedExposureProfile/);
    assert.match(resolver, /tryFindExposureIntent/);
  });
});
