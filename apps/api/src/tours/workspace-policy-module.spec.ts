import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  createCanonicalDocument,
  createStarterWorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";
import { getWorkspacePlugin as getPolicyCertWorkspacePlugin } from "@app-tour/workspace-policy-cert/plugin";

import {
  runWorkspacePolicyValidationStage,
  runWorkspaceValidationPipeline,
} from "./run-workspace-validation-pipeline.js";
import { resolveWorkspacePolicyValidator } from "./workspace-policy-validation-bindings.generated.js";

function policyCertPlugin(): WorkspacePlugin {
  return getPolicyCertWorkspacePlugin();
}

function policyDocument(data: Record<string, unknown>) {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["basics", "details"],
    data,
  });
}

describe("workspace-policy-module (CW8-03)", () => {
  it("codegen registers policy-cert manifest workspacePolicy binding", () => {
    const validator = resolveWorkspacePolicyValidator("policy-cert");
    assert.ok(validator);
    assert.equal(typeof validator?.validate, "function");
  });

  it("fires POLICY_CERT_TITLE_TOO_SHORT via manifest policy module", () => {
    const plugin = policyCertPlugin();
    const violation = runWorkspacePolicyValidationStage({
      plugin,
      document: policyDocument({ basics: { title: "ab" }, details: { summary: "ok" } }),
      workspaceType: "policy-cert",
      tenantId: "policy-cert-tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation?.code, "POLICY_CERT_TITLE_TOO_SHORT");
    assert.equal(violation?.stage, "workspacePolicy");
  });

  it("fires POLICY_CERT_BLOCKED_WORD after title length passes", () => {
    const plugin = policyCertPlugin();
    const violation = runWorkspacePolicyValidationStage({
      plugin,
      document: policyDocument({
        basics: { title: "valid blocked word" },
        details: { summary: "ok" },
      }),
      workspaceType: "policy-cert",
      tenantId: "policy-cert-tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation?.code, "POLICY_CERT_BLOCKED_WORD");
  });

  it("pipeline runs policy module without host product branching", () => {
    const plugin = policyCertPlugin();
    const engine = PlatformWizardEngine.create(plugin);
    const violation = runWorkspaceValidationPipeline({
      plugin,
      engine,
      document: policyDocument({ basics: { title: "ab" }, details: { summary: "ok" } }),
      workspaceType: "policy-cert",
      tenantId: "policy-cert-tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation?.code, "POLICY_CERT_TITLE_TOO_SHORT");
  });

  it("legacy starter workspace has no manifest policy binding", () => {
    assert.equal(resolveWorkspacePolicyValidator("starter"), undefined);
    const starter = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
    const engine = PlatformWizardEngine.create(starter);
    const violation = runWorkspaceValidationPipeline({
      plugin: starter,
      engine,
      document: policyDocument({ basics: { title: "ab" }, details: { summary: "blocked" } }),
      workspaceType: "starter",
      tenantId: "starter-tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation, null);
  });
});
