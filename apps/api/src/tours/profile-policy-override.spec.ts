import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  createCanonicalDocument,
  createStarterWorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";
import { getWorkspacePlugin as getProfileCertWorkspacePlugin } from "@app-tour/workspace-profile-cert/plugin";

import {
  runWorkspacePolicyValidationStage,
  runWorkspaceValidationPipeline,
} from "./run-workspace-validation-pipeline.js";
import { resolveWorkspacePolicyValidator } from "./workspace-policy-validation-bindings.generated.js";

function profileCertPlugin(): WorkspacePlugin {
  return getProfileCertWorkspacePlugin();
}

function policyDocument(data: Record<string, unknown>) {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["basics", "details"],
    data,
  });
}

describe("profile-policy override (CW6-05B)", () => {
  it("codegen registers profile-cert manifest workspacePolicy binding", () => {
    const validator = resolveWorkspacePolicyValidator("profile-cert");
    assert.ok(validator);
    assert.equal(typeof validator?.validate, "function");
  });

  it("fires PROFILE_CERT_POLICY_TITLE_TOO_SHORT via profile-scaffolded policy module", () => {
    const plugin = profileCertPlugin();
    const violation = runWorkspacePolicyValidationStage({
      plugin,
      document: policyDocument({ basics: { title: "ab" }, details: { summary: "ok" } }),
      workspaceType: "profile-cert",
      tenantId: "profile-cert-tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation?.code, "PROFILE_CERT_POLICY_TITLE_TOO_SHORT");
    assert.equal(violation?.stage, "workspacePolicy");
  });

  it("fires PROFILE_CERT_POLICY_BLOCKED_WORD after title length passes", () => {
    const plugin = profileCertPlugin();
    const violation = runWorkspacePolicyValidationStage({
      plugin,
      document: policyDocument({
        basics: { title: "valid blocked word" },
        details: { summary: "ok" },
      }),
      workspaceType: "profile-cert",
      tenantId: "profile-cert-tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation?.code, "PROFILE_CERT_POLICY_BLOCKED_WORD");
  });

  it("pipeline runs profile-cert policy module without host product branching", () => {
    const plugin = profileCertPlugin();
    const engine = PlatformWizardEngine.create(plugin);
    const violation = runWorkspaceValidationPipeline({
      plugin,
      engine,
      document: policyDocument({ basics: { title: "ab" }, details: { summary: "ok" } }),
      workspaceType: "profile-cert",
      tenantId: "profile-cert-tenant",
      validationMode: "draft",
      validationVariant: "default",
      dimensions: { variant: "default" },
    });
    assert.equal(violation?.code, "PROFILE_CERT_POLICY_TITLE_TOO_SHORT");
  });

  it("starter workspace without profile policy binding remains noop", () => {
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
