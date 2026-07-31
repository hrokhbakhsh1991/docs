import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("DG-4.0 harbor G1 profile", () => {
  it("manifest matches Product Profile C deltas (city + policies)", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "workspace.manifest.json"), "utf8"),
    ) as {
      readonly guestConformance: { readonly productionTier: string };
      readonly catalogPresentation: {
        readonly listFeatures: { readonly cityFilter: boolean };
        readonly detailSections: { readonly policies: boolean };
      };
    };
    assert.equal(manifest.guestConformance.productionTier, "stub");
    assert.equal(manifest.catalogPresentation.listFeatures.cityFilter, true);
    assert.equal(manifest.catalogPresentation.detailSections.policies, true);
  });

  it("HTTP stubs use P-lib guest-smoke factory (no hand-rolled 501)", () => {
    const http = readFileSync(join(root, "src/http/harbor-catalog-http.ts"), "utf8");
    assert.match(http, /createWorkspaceGuestSmokeHttpHandlers/);
    assert.match(http, /catalogPort/);
    assert.doesNotMatch(http, /function sendGuestStub/);
    const manifestTs = readFileSync(join(root, "src/http/routes-manifest.ts"), "utf8");
    assert.match(manifestTs, /WorkspaceHttpMethod/);
  });
});
