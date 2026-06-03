import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { FOUNDATION_GATE_DENALI_DIRS } from "../../../scripts/guards/foundation-gate-config.mjs";
import { cruiseDenaliBreachFixture, cruiseDenaliViolations } from "./lib/denali-cruise.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const DENALI_BREACH_FIXTURE_DIR = path.join(__dirname, "__fixtures__");

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

  it("no-denali-product-ids fails on intentional denali-breach fixture", () => {
    const breachFile = path.join(DENALI_BREACH_FIXTURE_DIR, "denali-breach.ts");
    assert.ok(fs.existsSync(breachFile), `missing fixture: ${breachFile}`);

    const errors = cruiseDenaliBreachFixture(REPO_ROOT);
    const denaliRuleHits = errors.filter((e) => e.rule?.name === "no-denali-product-ids");

    assert.ok(
      denaliRuleHits.length > 0,
      `expected no-denali-product-ids violation from denali-breach.ts; got: ${JSON.stringify(errors)}`,
    );
  });
});
