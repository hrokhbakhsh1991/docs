import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  getStarterWorkspacePlugin,
  resolveWorkspacePluginIdForType,
} from "@app-tour/workspace-sdk";

import {
  getOrCreateValidationEngine,
  resetValidationEngineCacheForTests,
  validateCanonicalBeforePersistSync,
} from "../src/tours/canonical-validation-sync";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin";
import {
  assertShadowValidateDenaliProductionSafety,
  isShadowValidateDenaliEnabled,
  SHADOW_VALIDATE_DENALI_ENV,
} from "../src/workspace/shadow-validate-denali";

function buildDenaliCanonicalData(roots: readonly string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const root of roots) {
    data[root] = {};
  }
  return data;
}

describe("denali-workspace-plugin.spec.ts (REQ-P6-013, REQ-P6-024, REQ-P6-025, REQ-P6-026)", () => {
  it('REQ-P6-026: resolveWorkspacePluginIdForType("denali") === "denali"', () => {
    assert.equal(
      resolveWorkspacePluginIdForType("denali", DEFAULT_WORKSPACE_TYPE_BINDINGS),
      "denali"
    );
  });

  it("REQ-P6-013: resolveWorkspacePluginForType(denali) returns denali plugin", () => {
    const plugin = resolveWorkspacePluginForType("denali");
    assert.equal(plugin.id, "denali");
    assert.equal(plugin.id, getDenaliWorkspacePlugin().id);
  });

  it("REQ-P6-025: starter workspace_type still resolves starter plugin", () => {
    const plugin = resolveWorkspacePluginForType("starter");
    assert.equal(plugin.id, getStarterWorkspacePlugin().id);
  });

  it("REQ-P6-007: validateCanonicalBeforePersistSync uses denali registry for workspace_type=denali", () => {
    resetValidationEngineCacheForTests();
    const denaliPlugin = getDenaliWorkspacePlugin();
    const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    getOrCreateValidationEngine(tenantId, "denali");
    assert.throws(
      () =>
        validateCanonicalBeforePersistSync({
          body: {
            roots: [...denaliPlugin.wizard.roots],
            data: buildDenaliCanonicalData(denaliPlugin.wizard.roots),
          },
          tenantId,
          workspaceType: "denali",
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /program\.difficultyLevel|destinationId|title/);
        return true;
      }
    );
  });

  it("REQ-P6-024: SHADOW_VALIDATE_DENALI is disabled in production config", () => {
    const priorNodeEnv = process.env.NODE_ENV;
    const priorShadow = process.env[SHADOW_VALIDATE_DENALI_ENV];
    try {
      process.env.NODE_ENV = "production";
      process.env[SHADOW_VALIDATE_DENALI_ENV] = "true";
      assert.throws(
        () => assertShadowValidateDenaliProductionSafety(),
        /SHADOW_VALIDATE_DENALI_FORBIDDEN_IN_PRODUCTION/
      );
      assert.equal(isShadowValidateDenaliEnabled(), false);
    } finally {
      process.env.NODE_ENV = priorNodeEnv;
      if (priorShadow === undefined) {
        delete process.env[SHADOW_VALIDATE_DENALI_ENV];
      } else {
        process.env[SHADOW_VALIDATE_DENALI_ENV] = priorShadow;
      }
    }
  });
});
