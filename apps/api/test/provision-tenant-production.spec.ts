import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import { assertProductionCertifiedWorkspaceType } from "../src/internal/assert-production-certified-workspace.ts";
import { ProvisioningDevOnlyError } from "../src/internal/provisioning-guard.ts";
import { WorkspaceNotCertifiedForProductionError } from "../src/internal/provisioning.errors.ts";
import { ProvisioningService } from "../src/internal/provisioning.service.ts";

describe("P1-N-044: provisionTenantProduction", () => {
  const service = new ProvisioningService();
  const originalNodeEnv = process.env.NODE_ENV;

  after(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("provisionTenant throws dev guard in production", async () => {
    process.env.NODE_ENV = "production";

    await assert.rejects(
      async () =>
        service.provisionTenant({
          subdomain: "test-club",
          tenantId: "00000000-0000-4000-8000-000000000099",
          workspaceType: "denali",
        }),
      (err: Error) => {
        assert.ok(err instanceof ProvisioningDevOnlyError);
        assert.match(err.message, /forbidden/i);
        return true;
      }
    );
  });

  it("production method exists without dev guard on the class", () => {
    process.env.NODE_ENV = "production";
    assert.ok(typeof service.provisionTenantProduction === "function");
  });

  it("requires explicit workspaceType for unknown tenant identities", async () => {
    process.env.NODE_ENV = "production";

    await assert.rejects(
      () =>
        service.provisionTenantProduction({
          subdomain: "unknown-workspace-type",
          tenantId: "00000000-0000-4000-8000-000000000098",
        }),
      /PROVISIONING_WORKSPACE_TYPE_REQUIRED/
    );
  });

  it("does not silently default unknown tenant identities to starter", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/internal/provisioning.service.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /workspaceType[^;\n]*\?\?\s*["']starter["']/);
    assert.match(source, /PROVISIONING_WORKSPACE_TYPE_REQUIRED/);
  });
});

describe("Phase H2: assertProductionCertifiedWorkspaceType", () => {
  it("allows denali (certified reference workspace)", () => {
    assert.doesNotThrow(() => assertProductionCertifiedWorkspaceType("denali"));
  });

  it("rejects harbor stub workspace (PSR-6b demote until durable path)", () => {
    assert.throws(
      () => assertProductionCertifiedWorkspaceType("harbor"),
      (err: Error) => {
        assert.ok(err instanceof WorkspaceNotCertifiedForProductionError);
        assert.equal(err.code, "WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION");
        assert.equal(err.workspaceType, "harbor");
        assert.equal(err.pluginId, "harbor");
        return true;
      }
    );
  });

  it("rejects urban stub workspace", () => {
    assert.throws(
      () => assertProductionCertifiedWorkspaceType("urban"),
      (err: Error) => {
        assert.ok(err instanceof WorkspaceNotCertifiedForProductionError);
        assert.equal(err.code, "WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION");
        assert.equal(err.workspaceType, "urban");
        assert.equal(err.pluginId, "urban");
        return true;
      }
    );
  });

  it("rejects starter stub workspace", () => {
    assert.throws(
      () => assertProductionCertifiedWorkspaceType("starter"),
      WorkspaceNotCertifiedForProductionError
    );
  });

  it("rejects guest-club stub workspace", () => {
    assert.throws(
      () => assertProductionCertifiedWorkspaceType("guest-club"),
      (err: Error) => {
        assert.ok(err instanceof WorkspaceNotCertifiedForProductionError);
        assert.equal(err.pluginId, "guest-club");
        return true;
      }
    );
  });

  it("rejects unknown workspace type before certification lookup", () => {
    assert.throws(
      () => assertProductionCertifiedWorkspaceType("unknown-workspace"),
      /WORKSPACE_PLUGIN_NOT_BOUND:unknown-workspace/
    );
  });
});
