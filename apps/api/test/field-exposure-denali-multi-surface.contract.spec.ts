import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  DENALI_EXPOSURE_SURFACE,
  DENALI_EXPOSURE_SURFACE_DEFINITIONS,
  mapDenaliExposureSurfaceToFieldPolicySurface,
} from "@app-tour/workspace-denali/exposure";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { CATALOG_HTTP_ROUTE_MANIFEST } from "@app-tour/workspace-denali/http";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Denali multi-surface exposure contract", () => {
  it("declares all five Denali exposure surfaces with conservative defaults", () => {
    const surfaces = DENALI_EXPOSURE_SURFACE_DEFINITIONS.map((entry) => entry.surface);
    assert.deepEqual(surfaces, [
      DENALI_EXPOSURE_SURFACE.telegram,
      DENALI_EXPOSURE_SURFACE.publicList,
      DENALI_EXPOSURE_SURFACE.publicDetails,
      DENALI_EXPOSURE_SURFACE.userDashboard,
      DENALI_EXPOSURE_SURFACE.reminderFeed,
    ]);
  });

  it("maps exposure surfaces to workspace-sdk FieldPolicy surfaces", () => {
    assert.equal(mapDenaliExposureSurfaceToFieldPolicySurface("telegram"), "delivery");
    assert.equal(mapDenaliExposureSurfaceToFieldPolicySurface("public_list"), "public_website");
    assert.equal(mapDenaliExposureSurfaceToFieldPolicySurface("public_details"), "public_website");
    assert.equal(mapDenaliExposureSurfaceToFieldPolicySurface("user_dashboard"), "profile");
    assert.equal(mapDenaliExposureSurfaceToFieldPolicySurface("reminder_feed"), "profile");
  });

  it("seeds FieldPolicy rules on delivery, public_website, and profile", () => {
    const manifest = getDenaliWorkspacePlugin().fieldPolicy;
    assert.ok(manifest !== undefined);
    const surfaces = new Set(manifest.rules.map((rule) => rule.surface));
    assert.deepEqual([...surfaces].sort(), ["delivery", "profile", "public_website"]);
  });

  it("registers catalog, dashboard, and reminder feed HTTP consumers", () => {
    const paths = CATALOG_HTTP_ROUTE_MANIFEST.map((entry) => entry.path);
    assert.ok(paths.includes("/denali/catalog"));
    assert.ok(paths.includes("/denali/catalog/:tourId"));
    assert.ok(paths.includes("/denali/dashboard/tours/:tourId"));
    assert.ok(paths.includes("/denali/reminders/feed"));
  });

  it("documents Denali completion criteria in field-exposure-system.md", () => {
    const doc = readFileSync(
      join(repoRoot, "docs/architecture/field-exposure-system.md"),
      "utf8",
    );
    assert.match(doc, /Denali multi-surface exposure — completion contract/);
    assert.match(doc, /field-exposure-denali-multi-surface\.contract\.spec\.ts/);
    assert.match(doc, /denali_exposure_reminder_activations/);
    assert.match(doc, /Phase 10\.4 — Catalog exposure bindings audit/);
    assert.match(doc, /docs\/dev\/runbooks\/exposure-flags\.mdoc/);
  });

  it("wires exposure resolver and reminder ports in denali product host", () => {
    const host = readFileSync(
      join(repoRoot, "apps/api/src/http/configure-workspace-denali-product-http-host.ts"),
      "utf8",
    );
    assert.match(host, /buildDenaliExposureResolverPort/);
    assert.match(host, /buildDenaliReminderFeedPort/);
    assert.match(host, /resolveExposureResolverPort/);
    assert.match(host, /resolveReminderFeedPort/);
  });

  it("registers workspace surface exposure admin routes", () => {
    const routes = readFileSync(
      join(repoRoot, "apps/api/src/exposure/exposure.routes.ts"),
      "utf8",
    );
    assert.match(routes, /handleGetWorkspaceExposureSurfaces/);
    assert.match(routes, /handlePatchWorkspaceSurfaceExposureIntent/);
  });
});
