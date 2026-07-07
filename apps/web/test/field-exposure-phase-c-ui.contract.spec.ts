import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const PREVIEW_ROUTE = join(REPO_ROOT, "apps/web/app/api/exposure/engine-preview/route.ts");
const PREVIEW_CLIENT = join(REPO_ROOT, "apps/web/src/exposure/exposure-engine-preview-client.ts");
const PREVIEW_CLIENT_SPEC = join(REPO_ROOT, "apps/web/test/exposure-engine-preview-client.spec.ts");
const INTEGRATION_PANEL = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx",
);

describe("field exposure phase C UI contract", () => {
  it("documents preview-primary editor client scope", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Control Plane UI — Phase C/);
    assert.match(text, /GET \/api\/exposure\/engine-preview/);
    assert.match(text, /exposure-engine-preview-client\.spec\.ts/);
    assert.match(text, /field-exposure-phase-c-ui\.contract\.spec\.ts/);
  });

  it("ships a web BFF and parser for read-only engine preview", () => {
    const route = readFileSync(PREVIEW_ROUTE, "utf8");
    const client = readFileSync(PREVIEW_CLIENT, "utf8");

    assert.match(route, /\/exposure\/engine-preview/);
    assert.match(route, /connectionId/);
    assert.match(route, /eventType/);
    assert.match(client, /fetchExposureEnginePreview/);
    assert.match(client, /parseExposureEnginePreviewResponse/);
    assert.match(client, /samplePayload/);
    assert.doesNotMatch(client, /samplePayload:\s*\{\}/);
  });

  it("ships engine preview client for control-plane and simulation surfaces only", () => {
    const panel = readFileSync(INTEGRATION_PANEL, "utf8");
    const controlPlanePage = join(
      REPO_ROOT,
      "apps/web/app/(app)/settings/exposure/control-plane/exposure-control-plane-client.tsx",
    );
    const controlPlane = readFileSync(controlPlanePage, "utf8");

    assert.doesNotMatch(panel, /ExposureEnginePreviewPanel/);
    assert.doesNotMatch(panel, /fetchExposureEnginePreview/);
    assert.match(controlPlane, /ExposureEnginePreviewPanel/);
    assert.match(controlPlane, /enginePreviewTitle/);
  });

  it("ships parser unit coverage for samplePayload and engine-selected ids", () => {
    assert.equal(existsSync(PREVIEW_CLIENT_SPEC), true);

    const spec = readFileSync(PREVIEW_CLIENT_SPEC, "utf8");
    assert.match(spec, /parseExposureEnginePreviewResponse/);
    assert.match(spec, /samplePayload/);
    assert.match(spec, /engineSelectedFieldIds/);
  });
});
