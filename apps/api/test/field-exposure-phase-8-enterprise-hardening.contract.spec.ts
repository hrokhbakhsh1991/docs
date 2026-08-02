import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { getWorkspaceExposureCatalog } from "../src/exposure/exposure-catalog.service";
import { EXPOSURE_RESOLVER_VERSION, resolveExposureDecision } from "../src/exposure/resolve-exposure-decision";
import { REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED } from "../src/exposure/exposure-profile";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-8-guard.mjs");
const APP_SOURCE = join(REPO_ROOT, "apps/api/src/app.ts");
const SCHEMA = join(REPO_ROOT, "apps/api/prisma/schema.prisma");
const EXPOSURE_PROFILES_MIGRATION = join(
  REPO_ROOT,
  "apps/api/prisma/migrations/20260701100000_exposure_profiles/migration.sql",
);
const EXPOSURE_PAGE = join(REPO_ROOT, "apps/web/app/(app)/settings/exposure/page.tsx");
const EXPOSURE_CLIENT = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx",
);
const INTEGRATIONS_PAGE = join(REPO_ROOT, "apps/web/app/(app)/settings/integrations/page.tsx");
const INTEGRATIONS_CLIENT = join(
  REPO_ROOT,
  "apps/web/app/(app)/settings/integrations/integrations-settings-client.tsx",
);
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);
const RESOLVER = join(REPO_ROOT, "apps/api/src/exposure/resolve-exposure-decision.ts");

describe("field exposure phase 8 enterprise hardening contract", () => {
  it("documents Phase 8 governance and native catalog API contract", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /## Phase 8 — Enterprise Hardening/);
    assert.match(text, /Phase 8 complete/);
    assert.match(text, /Authoritative exposure resolver contract \(8d\)/);
    assert.match(text, /Native catalog API contract \(8c\)/);
    assert.match(text, /\/workspaces\/:workspaceId\/exposure\/catalog/);
    assert.match(text, /guard:field-exposure-phase-8/);
  });

  it("serves a native exposure catalog response independent from integration meta", async () => {
    const catalog = await getWorkspaceExposureCatalog(
      {
        tenantId: "00000000-0000-4000-8000-000000000014",
        userId: "00000000-0000-4000-8000-000000000101",
        workspaceId: "denali",
        role: "owner",
      },
      "denali",
    );

    assert.equal(catalog.workspaceType, "denali");
    assert.equal(catalog.source, "registry_deliverable_migration_seed");
    assert.ok(catalog.fields.some((field) => field.id === "title"));
    assert.ok(catalog.fields.some((field) => field.id === "denali.destination"));
  });

  it("defines persisted exposure profiles with RLS and versioning", () => {
    const schema = readFileSync(SCHEMA, "utf8");
    assert.match(schema, /model ExposureProfile/);
    assert.match(schema, /version\s+Int\s+@default\(1\)/);
    assert.match(schema, /@@map\("exposure_profiles"\)/);

    const migration = readFileSync(EXPOSURE_PROFILES_MIGRATION, "utf8");
    assert.match(migration, /CREATE TABLE IF NOT EXISTS exposure_profiles/);
    assert.match(migration, /version INTEGER NOT NULL DEFAULT 1/);
    assert.match(migration, /ALTER TABLE exposure_profiles ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /CREATE POLICY exposure_profiles_tenant_isolation/);
  });

  it("wires backend and web proxy routes for native exposure catalog", () => {
    const app = readFileSync(APP_SOURCE, "utf8");
    assert.match(app, /\/exposure\\\/catalog/);
    assert.match(app, /handleGetWorkspaceExposureCatalog/);

    const proxy = readFileSync(
      join(REPO_ROOT, "apps/web/app/api/workspaces/[workspaceId]/exposure/catalog/route.ts"),
      "utf8",
    );
    assert.match(proxy, /\/exposure\/catalog/);
    assert.match(readFileSync(RESOLVER, "utf8"), /restrictFieldExposureCandidates/);
  });

  it("standalone exposure settings reads catalog from exposure API", () => {
    const page = readFileSync(EXPOSURE_PAGE, "utf8");
    assert.match(page, /fetchWorkspaceExposureCatalogServer/);

    const client = readFileSync(EXPOSURE_CLIENT, "utf8");
    assert.match(client, /fetchWorkspaceExposureCatalog/);
    assert.match(client, /catalog\?\.fields/);
    assert.doesNotMatch(client, /meta\.exposureCandidateFields/);
  });

  it("integrations settings prefer native exposure catalog over integration meta", () => {
    const page = readFileSync(INTEGRATIONS_PAGE, "utf8");
    assert.match(page, /fetchWorkspaceExposureCatalogServer/);

    const client = readFileSync(INTEGRATIONS_CLIENT, "utf8");
    assert.match(client, /fetchWorkspaceExposureCatalog/);
    assert.match(client, /exposureCatalog\?\.fields/);
  });

  it("authoritative exposure resolver records versioned audit metadata", async () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    assert.match(dispatch, /resolveExposureDecision/);
    assert.match(dispatch, /fieldExposureDecision/);
    assert.match(dispatch, /recordFieldExposureDecisionAudited/);

    const resolved = await resolveExposureDecision({
      tenantId: "00000000-0000-0000-0000-000000000001",
      workspaceType: "denali",
      eventType: "TourCreated",
      exposureSurface: "telegram",
      payload: { title: "Alpine Day" },
      profile: {
        id: "denali.telegram.TourCreated",
        workspaceType: "denali",
        entityType: "tour",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
        defaultFieldIds: ["title"],
        source: REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
        version: "v1",
      },
      exposureIntent: null,
      engineDecisions: new Map([
        ["title", { state: "visible", reasonChain: [], appliedPolicies: [] }],
      ]),
      resolveDeliveryFieldDefinitions: async () => [],
    });

    assert.equal(resolved.decision.resolverVersion, EXPOSURE_RESOLVER_VERSION);
    assert.equal(resolved.decision.profileId, "denali.telegram.TourCreated");
    assert.equal(resolved.decision.profileVersion, "v1");
    assert.deepEqual(resolved.decision.engineSelectedFieldIds, ["title"]);
  });

  it("phase 8 guard passes on repository closure state", () => {
    assert.equal(existsSync(GUARD_SCRIPT), true);
    const result = spawnSync("node", [GUARD_SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout || "guard failed");
  });
});
