import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUARD = path.join(PKG_ROOT, "scripts/guard-boundary.mjs");

describe("tour-core boundary contract (CW5-01)", () => {
  it("guard-boundary script PASS", () => {
    const r = spawnSync(process.execPath, [GUARD], { cwd: PKG_ROOT, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  it("package.json dependencies obey DEC-CW-07", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"));
    const deps = Object.keys(pkg.dependencies ?? {});
    assert.deepEqual(deps, ["@app-tour/booking-http-contracts"]);
  });
});
