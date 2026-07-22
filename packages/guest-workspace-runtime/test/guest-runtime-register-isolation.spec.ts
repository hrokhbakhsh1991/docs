/**
 * Gap Closure C.1 — guest-runtime register isolation.
 * Urban request must not execute/register denali; product packages stay dynamic-import-only.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearWorkspaceIntakePluginRegistryForTests,
  clearWorkspaceRegistrationFlowRegistryForTests,
  listWorkspaceIntakePluginIds,
  listWorkspaceRegistrationFlowPluginIds,
} from "@app-tour/workspace-sdk";

import {
  invokeWorkspaceIntakeRegister,
} from "../src/workspace-plugin-register-manifest.generated.ts";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");

const STATIC_PRODUCT_IMPORT =
  /^import\s+.*from\s+["']@app-tour\/workspace-(denali|urban|starter|guest-club)/;

afterEach(() => {
  clearWorkspaceIntakePluginRegistryForTests();
  clearWorkspaceRegistrationFlowRegistryForTests();
});

describe("guest-runtime-register-isolation.spec.ts — Phase C.1", () => {
  it("C1-AUDIT-01 register manifest switches use dynamic import of per-plugin registrars", () => {
    const source = readFileSync(
      join(SRC, "workspace-plugin-register-manifest.generated.ts"),
      "utf8"
    );
    assert.match(source, /await import\("\.\/register-urban\.generated"\)/);
    assert.match(source, /await import\("\.\/register-denali\.generated"\)/);
    assert.doesNotMatch(source, /from\s+"\.\/register-denali\.generated"/);
    assert.doesNotMatch(source, /from\s+"\.\/register-urban\.generated"/);
  });

  it("C1-AUDIT-02 per-plugin registrars never statically import product packages", () => {
    const generated = readdirSync(SRC).filter(
      (name) => name.startsWith("register-") && name.endsWith(".generated.ts")
    );
    assert.ok(generated.length >= 4, `expected register-*.generated.ts, got ${generated.length}`);

    for (const fileName of generated) {
      const content = readFileSync(join(SRC, fileName), "utf8");
      for (const [index, line] of content.split("\n").entries()) {
        assert.equal(
          STATIC_PRODUCT_IMPORT.test(line.trim()),
          false,
          `${fileName}:${index + 1} must not statically import product packages`
        );
      }
      assert.match(
        content,
        /await import\("@app-tour\/workspace-/,
        `${fileName} must lazy-load product packages`
      );
    }
  });

  it("C1-RT-01 urban intake register does not register denali", async () => {
    await invokeWorkspaceIntakeRegister("urban");

    const intakeIds = listWorkspaceIntakePluginIds();
    assert.deepEqual([...intakeIds].sort(), ["urban"]);
    assert.deepEqual([...listWorkspaceRegistrationFlowPluginIds()], []);
  });

  it("C1-RT-02 denali intake appears only after explicit register", async () => {
    await invokeWorkspaceIntakeRegister("urban");
    assert.deepEqual([...listWorkspaceIntakePluginIds()].sort(), ["urban"]);

    await invokeWorkspaceIntakeRegister("denali");
    assert.deepEqual([...listWorkspaceIntakePluginIds()].sort(), ["denali", "urban"]);
  });
});
