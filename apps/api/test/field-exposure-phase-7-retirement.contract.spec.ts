import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { buildWorkspaceIntegrationSurfaceMeta } from "../src/integrations/platform/integration-surface-meta";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-7-guard.mjs");
const SCHEMA = join(REPO_ROOT, "apps/api/prisma/schema.prisma");
const SURFACE_META = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/integration-surface-meta.ts"
);
const WEB_TYPES = join(REPO_ROOT, "apps/web/src/integrations/integrations-types.ts");
const EXPOSURE_PAGE = join(REPO_ROOT, "apps/web/app/(app)/settings/exposure/page.tsx");

describe("field exposure phase 7 retirement contract (7e–7i)", () => {
  it("architecture doc documents Phase 7 complete with native-only retirement", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /## Phase 7 — Remove Integration-Owned Selection/);
    assert.match(text, /Phase 7 complete/i);
    assert.match(text, /settings\/exposure/);
    assert.match(text, /exposure-intents/);
    assert.match(text, /guard:field-exposure-phase-7/);
  });

  it("7e — IntegrationEventPolicy is routing-only at the schema layer", () => {
    const schema = readFileSync(SCHEMA, "utf8");
    const model = schema.match(/model IntegrationEventPolicy \{[\s\S]*?\n\}/)?.[0] ?? "";
    assert.ok(model.length > 0, "IntegrationEventPolicy model must exist");
    assert.doesNotMatch(
      model,
      /selected_field_ids|selectedFieldIds|message_template|messageTemplate/
    );
    assert.doesNotMatch(schema, /model IntegrationDeliveryIntent/);
  });

  it("7f — integration surface-meta serves the exposure-owned catalog", async () => {
    const source = readFileSync(SURFACE_META, "utf8");
    assert.match(source, /buildExposureSelectableFieldCatalog/);

    const meta = await buildWorkspaceIntegrationSurfaceMeta("denali");
    const ids = meta.exposureCandidateFields.map((field) => field.id);
    assert.ok(ids.includes("title"));
    assert.ok(ids.includes("denali.destination"));
  });

  it("7g — deliveryCandidateFields alias is removed from API response", async () => {
    const meta = (await buildWorkspaceIntegrationSurfaceMeta("denali")) as Record<string, unknown>;
    assert.equal(meta.deliveryCandidateFields, undefined);
    assert.ok(Array.isArray(meta.exposureCandidateFields));
  });

  it("7h — standalone exposure settings page exists", () => {
    assert.equal(existsSync(EXPOSURE_PAGE), true);
    const page = readFileSync(EXPOSURE_PAGE, "utf8");
    assert.match(page, /ExposureSettingsClient/);
  });

  it("7g — web meta response type drops the alias but parser keeps read fallback", () => {
    const web = readFileSync(WEB_TYPES, "utf8");
    const metaType =
      web.match(/export type WorkspaceIntegrationSurfaceMetaResponse = \{[\s\S]*?\n\};/)?.[0] ?? "";
    assert.ok(metaType.length > 0);
    assert.doesNotMatch(metaType, /deliveryCandidateFields/);
    assert.match(web, /record\.deliveryCandidateFields/);
  });

  it("phase 7 guard passes on repository closure state", () => {
    assert.equal(existsSync(GUARD_SCRIPT), true);
    const result = spawnSync("node", [GUARD_SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout || "guard failed");
  });
});
