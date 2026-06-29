import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  isWorkspacePlugin,
  resolveWorkspacePluginIdForType,
} from "@app-tour/workspace-sdk";

import {
  buildDenaliFieldPolicyDefinitions,
  createDenaliFinanceOutboxConsumer,
  DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
  DENALI_FIELD_POLICY_WORKSPACE_TYPE,
  DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION,
  DENALI_THEME_ADMIN_STYLESHEET,
  denaliPluginForWizardEngine,
  getDenaliWorkspacePlugin,
  migrateDenaliCanonical,
  resolveDenaliWizardDimensions,
} from "../src/index";
import { buildDenaliTourPhotoObjectKey } from "../src/photos/tour-photo-object-key";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN_DIR = join(PACKAGE_ROOT, "test/fixtures/golden");

describe("phase-6.contract scaffold (REQ-P6-004, REQ-P6-005, REQ-P6-027)", () => {
  it("exports getDenaliWorkspacePlugin", () => {
    assert.equal(typeof getDenaliWorkspacePlugin, "function");
  });

  it("plugin.id === denali and satisfies WorkspacePlugin shape", () => {
    const plugin = getDenaliWorkspacePlugin();
    assert.equal(plugin.id, "denali");
    assert.equal(isWorkspacePlugin(plugin), true);
  });

  it("theme/tokens.css exists and is referenced by plugin", () => {
    const cssPath = join(PACKAGE_ROOT, "theme", "tokens.css");
    assert.ok(readFileSync(cssPath, "utf8").includes("--ws-color-accent"));
    assert.equal(
      getDenaliWorkspacePlugin().theme?.optionalStylesheet,
      DENALI_THEME_ADMIN_STYLESHEET
    );
  });

  it("public API does not export DENALI_BREACH_PROBE", async () => {
    const mod = await import("../src/index.ts");
    assert.equal("DENALI_BREACH_PROBE" in mod, false);
  });

  it("exports metadata-only field policy bridge", () => {
    assert.equal(DENALI_FIELD_POLICY_WORKSPACE_TYPE, "denali");
    assert.equal(typeof buildDenaliFieldPolicyDefinitions, "function");
  });
});

describe("phase-6.contract behavioral (REQ-P6-018, DEC-P6-009)", () => {
  it("REQ-P6-026: workspace-sdk binds denali workspace_type to denali plugin id", () => {
    assert.equal(
      resolveWorkspacePluginIdForType("denali", DEFAULT_WORKSPACE_TYPE_BINDINGS),
      "denali"
    );
  });

  it("REQ-P6-006: field registry is non-empty and wizard engine accepts plugin", () => {
    const plugin = getDenaliWorkspacePlugin();
    assert.ok(plugin.fieldRegistry.fields.length > 0);
    const engine = PlatformWizardEngine.create(denaliPluginForWizardEngine(plugin));
    assert.equal(typeof engine.validateCanonical, "function");
  });

  it("REQ-P6-017: migrateDenaliCanonical upgrades golden tour-minimal legacy blob", () => {
    const legacy = JSON.parse(
      readFileSync(join(GOLDEN_DIR, "tour-minimal.json"), "utf8")
    ) as Record<string, unknown>;
    const migrated = migrateDenaliCanonical(DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION, legacy);
    assert.equal(migrated.schemaVersion, DENALI_CURRENT_CANONICAL_SCHEMA_VERSION);
    assert.equal((migrated.data as Record<string, unknown>).title, "Test");
  });

  it("REQ-P6-011: finance consumer factory is exported from package root", () => {
    const consumer = createDenaliFinanceOutboxConsumer({
      reader: { readPending: async () => [] },
      writer: { addEvent: async () => undefined },
    });
    assert.equal(typeof consumer.consumePending, "function");
  });

  it("REQ-P6-016: photo key builder is tenant-scoped", () => {
    const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const key = buildDenaliTourPhotoObjectKey({
      tenantId,
      tourId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      photoId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    assert.ok(key.startsWith(`${tenantId}/`));
  });

  it("REQ-P6-024: resolveDenaliWizardDimensions aligns with plugin matrix", () => {
    const plugin = getDenaliWorkspacePlugin();
    const dims = resolveDenaliWizardDimensions(plugin);
    assert.equal(dims.category, "mountain");
    assert.equal(dims.duration, "single_day");
  });

  it("REQ-P6-024b: resolveDenaliWizardDimensions follows tour kind slug", () => {
    const plugin = getDenaliWorkspacePlugin();
    const multi = resolveDenaliWizardDimensions(plugin, "default", "mountain_multi");
    assert.equal(multi.category, "mountain");
    assert.equal(multi.duration, "multi_day");
    const nature = resolveDenaliWizardDimensions(plugin, "default", "nature_day");
    assert.equal(nature.category, "nature");
    assert.equal(nature.duration, "single_day");
  });
});
