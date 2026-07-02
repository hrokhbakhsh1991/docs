/**
 * SEO-5 — validate-json-ld golden fixture runner.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES_DIR = join(REPO_ROOT, "scripts/test/fixtures/jsonld");

function runValidator(args) {
  return spawnSync(process.execPath, [join(REPO_ROOT, "scripts/validate-json-ld.mjs"), ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

describe("validate-json-ld (SEO-5)", () => {
  it("SEO5-VAL-01 --all-fixtures passes for trunk profiles", () => {
    const result = runValidator(["--all-fixtures"]);
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "validate-json-ld failed"
    );
    assert.match(result.stdout, /PASS/);
  });

  it("SEO5-VAL-02 each golden profile file is referenced by manifest golden", () => {
    const manifestGolden = JSON.parse(
      readFileSync(join(REPO_ROOT, "scripts/test/fixtures/workspace-guest-seo.golden.json"), "utf8")
    );
    const profiles = new Set(
      Object.values(manifestGolden).map((entry) => entry.richResultsProfile)
    );
    for (const profile of profiles) {
      const result = runValidator(["--profile", profile]);
      assert.equal(result.status, 0, `profile ${profile}: ${result.stderr || result.stdout}`);
    }
  });

  it("SEO5-VAL-03 fixture directory contains only known profile ids", () => {
    const onDisk = readdirSync(FIXTURES_DIR)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""))
      .sort();
    assert.deepEqual(onDisk, ["event-stub-v1", "event-v1", "tourist-trip-v1"]);
  });
});
