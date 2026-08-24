import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { FOUNDATION_GATE_DENALI_DIRS } from "../../../scripts/guards/foundation-gate-config.mjs";
import { cruiseDenaliViolations, findPackageBoundaryViolations } from "./lib/denali-cruise.js";
import {
  CAPABILITY_PACKAGE_ROOTS,
  scanCapabilityCouplingViolations,
  scanCapabilityCouplingViolationsInFile,
} from "./lib/capability-coupling-scan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_DIR = path.join(__dirname, "__fixtures__");

describe("foundation denali coupling contract (H-01)", () => {
  it("has foundation scan roots configured", () => {
    assert.ok(FOUNDATION_GATE_DENALI_DIRS.length > 0);
  });

  it("depcruise no-denali-product-ids passes for every foundation package root", () => {
    const violations: string[] = [];

    for (const root of FOUNDATION_GATE_DENALI_DIRS) {
      const errors = cruiseDenaliViolations(REPO_ROOT, root);
      for (const err of errors) {
        violations.push(
          `${root}: ${err.rule?.name ?? "no-denali-product-ids"} ${err.from ?? "?"} → ${err.to ?? "denali"}`,
        );
      }
    }

    assert.equal(
      violations.length,
      0,
      violations.length
        ? `denali product import violations:\n${violations.join("\n")}`
        : undefined,
    );
  });

  it("package-boundary proof passes for a legal workspace-sdk fixture", () => {
    const legalFile = path.join(FIXTURE_DIR, "workspace-sdk-legal.ts");
    assert.ok(fs.existsSync(legalFile), `missing fixture: ${legalFile}`);
    const violations = findPackageBoundaryViolations(
      REPO_ROOT,
      [legalFile],
      "packages/workspaces/denali",
      ["@app-tour/workspace-denali"],
    );
    assert.deepEqual(violations, []);
  });

  it("package-boundary proof fails for Denali source and package imports", () => {
    const breachFile = path.join(FIXTURE_DIR, "denali-breach.ts");
    assert.ok(fs.existsSync(breachFile), `missing fixture: ${breachFile}`);

    const violations = findPackageBoundaryViolations(
      REPO_ROOT,
      [breachFile],
      "packages/workspaces/denali",
      ["@app-tour/workspace-denali"],
    );

    assert.ok(
      violations.length >= 4,
      `expected source/package import violations from denali-breach.ts; got: ${JSON.stringify(violations)}`,
    );
    assert.deepEqual(
      new Set(violations.map((violation) => violation.kind)),
      new Set(["import", "require", "dynamic-import"]),
    );
  });
});

describe("capability package denali coupling (CW7-15)", () => {
  it("depcruise no-denali-product-ids passes for reusable capability package roots", () => {
    const violations: string[] = [];
    for (const relRoot of CAPABILITY_PACKAGE_ROOTS) {
      const errors = cruiseDenaliViolations(REPO_ROOT, relRoot);
      for (const err of errors) {
        violations.push(
          `${relRoot}: ${err.rule?.name ?? "no-denali-product-ids"} ${err.from ?? "?"} → ${err.to ?? "denali"}`,
        );
      }
    }
    assert.equal(
      violations.length,
      0,
      violations.length
        ? `capability denali import violations:\n${violations.join("\n")}`
        : undefined,
    );
  });

  it("capability modules have zero workspace-id branch / fallback patterns", () => {
    const violations = scanCapabilityCouplingViolations(REPO_ROOT, CAPABILITY_PACKAGE_ROOTS);
    assert.deepEqual(violations, []);
  });

  it("negative fixture trips capability coupling pattern scan", () => {
    const breachFile = "packages/workspace-sdk/test/__fixtures__/capability-denali-breach.ts";
    assert.ok(fs.existsSync(path.join(REPO_ROOT, breachFile)), `missing fixture: ${breachFile}`);
    const violations = scanCapabilityCouplingViolationsInFile(REPO_ROOT, breachFile);
    assert.ok(violations.length >= 4, JSON.stringify(violations));
    const kinds = new Set(violations.map((violation) => violation.kind));
    assert.ok(kinds.has("workspace-type-branch"));
    assert.ok(kinds.has("plugin-id-branch"));
    assert.ok(kinds.has("workspace-type-fallback"));
    assert.ok(kinds.has("manifest-id-denali-fallback"));
  });

  it("generated pricing capabilities file is excluded from capability source scan roots", () => {
    const generated = "packages/workspace-sdk/src/catalog/workspace-pricing-capabilities.generated.ts";
    assert.ok(fs.existsSync(path.join(REPO_ROOT, generated)));
    const violations = scanCapabilityCouplingViolationsInFile(REPO_ROOT, generated);
    assert.deepEqual(violations, []);
  });
});
