import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { expandAuthorManifest } from "../codegen/workspace-registry/domains/profile-expansion.mjs";
import {
  assertWizardResumeManifest,
  resolveWizardResumeManifest,
} from "../codegen/workspace-registry/domains/wizard-resume.mjs";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

describe("wizard-resume manifest (CW5-10)", () => {
  it("CW5-10-01 resolves denali module binding", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "packages/workspaces/denali/workspace.manifest.json"),
        "utf8"
      )
    );
    assertWizardResumeManifest(manifest);
    const block = resolveWizardResumeManifest(manifest);
    assert.equal(block?.mode, "module");
    assert.equal(block?.export, "resolveDenaliInitialStepIndexFromHostInput");
  });

  it("CW5-10-02 starter-outdoor profile expands to noop wizardResume", () => {
    const catalog = new Map([
      [
        "starter-outdoor",
        JSON.parse(
          readFileSync(join(REPO_ROOT, "profiles/starter-outdoor.profile.json"), "utf8")
        ),
      ],
    ]);
    const { effective } = expandAuthorManifest(
      {
        id: "cert-club",
        profile: "starter-outdoor",
        package: "@app-tour/workspace-cert-club",
        workspaceTypes: ["cert-club"],
        plugin: { entry: "./plugin", export: "getWorkspacePlugin" },
      },
      catalog
    );
    assert.equal(resolveWizardResumeManifest(effective)?.mode, "noop");
  });

  it("CW5-10-03 rejects invalid wizardResume mode", () => {
    assert.throws(
      () =>
        assertWizardResumeManifest({
          id: "bad",
          wizardResume: { mode: "fieldInference" },
        }),
      /wizardResume\.mode/
    );
  });
});
